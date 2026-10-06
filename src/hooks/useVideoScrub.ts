import { useEffect, useRef, useState, type RefObject } from 'react'
import MP4Box from 'mp4box'

// Tuning constants — do not change blindly.
const LERP_TAU = 8
const SNAP = 0.002
const LRU_MAX = 24
const LEAD = 24
const WATCHDOG = 60000

interface BankFrame {
  ts: number // microseconds
  blob: Blob
}

interface Options {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
  containerRef: RefObject<HTMLElement>
  src: string
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Binary search on frame timestamps (compared in microseconds).
function nearestIndex(bank: BankFrame[], tUs: number): number {
  let lo = 0
  let hi = bank.length - 1
  if (tUs <= bank[0].ts) return 0
  if (tUs >= bank[hi].ts) return hi
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (bank[mid].ts < tUs) lo = mid + 1
    else hi = mid - 1
  }
  const a = bank[lo - 1]
  const b = bank[lo]
  return tUs - a.ts <= b.ts - tUs ? lo - 1 : lo
}

export function useVideoScrub({ videoRef, canvasRef, containerRef, src }: Options) {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [canvasLive, setCanvasLive] = useState(false)

  const bankRef = useRef<BankFrame[]>([])
  const lruRef = useRef<Map<number, ImageBitmap | null>>(new Map())
  const currentRef = useRef(0)
  const durRef = useRef(0)
  const readyRef = useRef(false)
  const revertedRef = useRef(false)
  const paintedRef = useRef(false)
  const buildingRef = useRef(false)

  // ------------------------------------------------------------------
  // rAF loop: lerp toward the scroll target, then draw the nearest
  // decoded frame (or fall back to seeking the <video> element).
  // ------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()

    const onMeta = () => {
      durRef.current = video.duration || 0
      video.pause()
    }
    video.addEventListener('loadedmetadata', onMeta)
    if (video.readyState >= 1) onMeta()

    const getProgress = () => {
      const el = containerRef.current
      if (!el) return 0
      const span = el.offsetHeight - window.innerHeight
      return span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0
    }

    const ensureBitmap = (idx: number): Promise<ImageBitmap | null> => {
      const lru = lruRef.current
      if (lru.has(idx)) return Promise.resolve(lru.get(idx) ?? null)
      const frame = bankRef.current[idx]
      if (!frame) return Promise.resolve(null)
      return createImageBitmap(frame.blob)
        .then((bmp) => {
          lru.set(idx, bmp)
          while (lru.size > LRU_MAX) {
            const first = lru.keys().next().value as number
            const b = lru.get(first)
            if (b) b.close()
            lru.delete(first)
          }
          return bmp
        })
        .catch(() => {
          lru.set(idx, null)
          return null
        })
    }

    const drawNearest = (t: number) => {
      const canvas = canvasRef.current
      const bank = bankRef.current
      if (!canvas || bank.length === 0) return
      const i = nearestIndex(bank, t * 1e6)
      for (let k = Math.max(0, i - 1); k <= Math.min(bank.length - 1, i + 2); k++) {
        void ensureBitmap(k)
      }
      const bmp = lruRef.current.get(i)
      if (bmp) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
          if (!paintedRef.current) {
            paintedRef.current = true
            setCanvasLive(true)
          }
        }
      }
    }

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now

      const p = getProgress()
      setScrollProgress(p)

      const dur = durRef.current
      if (dur > 0) {
        const target = p * dur
        if (reduced) {
          currentRef.current = target
        } else {
          currentRef.current += (target - currentRef.current) * (1 - Math.exp(-dt * LERP_TAU))
          if (Math.abs(target - currentRef.current) < SNAP) currentRef.current = target
        }

        if (readyRef.current) {
          drawNearest(currentRef.current)
        } else if (!revertedRef.current) {
          // Fallback: seek the video element directly.
          if (!video.seeking && Math.abs(video.currentTime - currentRef.current) > 0.01) {
            try {
              video.currentTime = currentRef.current
            } catch {
              /* ignore */
            }
          }
        }
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('loadedmetadata', onMeta)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------------
  // Frame bank: fetch the mp4, decode every frame with WebCodecs and
  // cache them as webp blobs so scrubbing never waits on the network.
  // Skipped entirely under reduced-motion or without VideoDecoder.
  // ------------------------------------------------------------------
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    if (typeof VideoDecoder === 'undefined') return

    let cancelled = false
    let watchdog = 0
    buildingRef.current = true

    const revert = () => {
      if (cancelled) return
      revertedRef.current = true
      readyRef.current = false
      buildingRef.current = false
      setCanvasLive(false)
    }

    const run = async () => {
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error('fetch failed')
        const ab = (await res.arrayBuffer()) as ArrayBuffer & { fileStart: number }
        ab.fileStart = 0

        const frames: BankFrame[] = []

        const decode = (hardware: 'prefer-hardware' | 'prefer-software') =>
          new Promise<void>((resolve) => {
            const file = MP4Box.createFile()
            const all: any[] = []
            let decoder: VideoDecoder | null = null
            let encoded = 0
            let decoded = 0
            let debounce = 0
            let failed = false

            const finish = () => {
              if (debounce) clearTimeout(debounce)
              resolve()
            }

            const feed = async () => {
              if (!decoder) return
              for (let i = 0; i < all.length; i++) {
                if (cancelled || failed) break
                while (encoded - decoded > LEAD) await sleep(8)
                const s = all[i]
                try {
                  decoder.decode(
                    new EncodedVideoChunk({
                      type: s.is_sync ? 'key' : 'delta',
                      timestamp: (s.cts * 1e6) / s.timescale,
                      duration: (s.duration * 1e6) / s.timescale,
                      data: s.data
                    })
                  )
                  encoded++
                } catch {
                  failed = true
                  break
                }
              }
              try {
                await decoder.flush()
              } catch {
                /* ignore */
              }
              finish()
            }

            file.onError = () => {
              failed = true
              finish()
            }

            file.onReady = (info: any) => {
              const track = info.videoTracks && info.videoTracks[0]
              if (!track) {
                failed = true
                finish()
                return
              }

              let description: Uint8Array | undefined
              try {
                const trak = file.getTrackById(track.id)
                for (const entry of trak.mdia.minf.stbl.stsd.entries) {
                  const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C
                  if (box) {
                    const ds = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN)
                    box.write(ds)
                    description = new Uint8Array(ds.buffer, 8)
                    break
                  }
                }
              } catch {
                /* ignore — codec may need no description */
              }

              decoder = new VideoDecoder({
                output: (frame: VideoFrame) => {
                  decoded++
                  try {
                    const off = new OffscreenCanvas(1920, 1080)
                    const ctx = off.getContext('2d')
                    if (ctx) ctx.drawImage(frame, 0, 0, 1920, 1080)
                    const ts = frame.timestamp
                    frame.close()
                    off
                      .convertToBlob({ type: 'image/webp', quality: 0.82 })
                      .then((blob) => {
                        frames.push({ ts, blob })
                      })
                      .catch(() => {})
                  } catch {
                    try {
                      frame.close()
                    } catch {
                      /* ignore */
                    }
                  }
                },
                error: () => {
                  failed = true
                  finish()
                }
              })

              try {
                decoder.configure({
                  codec: track.codec,
                  description,
                  hardwareAcceleration: hardware
                } as VideoDecoderConfig)
              } catch {
                failed = true
                finish()
                return
              }

              file.setExtractionOptions(track.id, null, { nbSamples: 200 })
              file.start()
            }

            file.onSamples = (_id: number, _user: unknown, samples: any[]) => {
              for (const s of samples) all.push(s)
              if (debounce) clearTimeout(debounce)
              debounce = window.setTimeout(() => void feed(), 400)
            }

            try {
              file.appendBuffer(ab)
              file.flush()
            } catch {
              failed = true
              finish()
            }
          })

        await decode('prefer-hardware')
        if (!cancelled && frames.length === 0) {
          await decode('prefer-software')
        }
        if (cancelled) return

        frames.sort((a, b) => a.ts - b.ts)
        if (frames.length === 0) {
          revert()
          return
        }
        bankRef.current = frames
        readyRef.current = true
        buildingRef.current = false
        clearTimeout(watchdog)
      } catch {
        revert()
      }
    }

    const onLoad = () => void run()
    if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })

    watchdog = window.setTimeout(revert, WATCHDOG)

    return () => {
      cancelled = true
      clearTimeout(watchdog)
      window.removeEventListener('load', onLoad)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return { scrollProgress, canvasLive }
}
