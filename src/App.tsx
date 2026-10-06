import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, ArrowDown, ChevronUp, Info, X } from 'lucide-react'
import { useVideoScrub } from '@/hooks/useVideoScrub'

const DARK = '#1D3045'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4'

const NAV = [
  'VECTRUS ENERGY',
  'VECTRUS UPSTREAM',
  'VECTRUS MARKETS',
  'VECTRUS SYSTEMS',
  'VECTRUS+'
]

const EASE = 'cubic-bezier(0.16,1,0.3,1)'

function Stagger({
  show,
  delay = 0,
  className,
  children
}: {
  show: boolean
  delay?: number
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={className}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s ${EASE} ${delay}ms, transform 0.8s ${EASE} ${delay}ms`
      }}
    >
      {children}
    </div>
  )
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { scrollProgress: p, canvasLive } = useVideoScrub({
    videoRef,
    canvasRef,
    containerRef,
    src: VIDEO_URL
  })

  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const isLight = p > 0.55

  // Sequential text sections — the previous one fully fades out before the next appears.
  const s1 = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08)
  const s2 =
    p < 0.32 ? 0 : p < 0.4 ? (p - 0.32) / 0.08 : p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.08)
  const s3 = p < 0.67 ? 0 : p < 0.75 ? (p - 0.67) / 0.08 : 1

  const navColor = isLight ? '#ffffff' : DARK

  return (
    <div ref={containerRef} className="relative h-[500vh]">
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Decoded-frame canvas fades in over the video once the bank is live. */}
        <canvas
          ref={canvasRef}
          width={1920}
          height={1080}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{ opacity: canvasLive ? 1 : 0 }}
        />

        <div className="absolute inset-0 pointer-events-none">
          {/* ---------------- Navbar ---------------- */}
          <nav className="absolute top-0 left-0 right-0 z-50 pointer-events-auto">
            <div className="flex items-center justify-between px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6">
              {/* Desktop link cluster */}
              <div
                className="hidden lg:flex items-center gap-8 xl:gap-10"
                style={{ color: navColor, transition: 'color .5s' }}
              >
                {NAV.map((label, i) => (
                  <a
                    key={label}
                    href="#"
                    className="relative text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70"
                    style={{
                      opacity: mounted ? 1 : 0,
                      transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
                      transition: `opacity 0.6s ${EASE} ${i * 80 + 100}ms, transform 0.6s ${EASE} ${i * 80 + 100}ms`
                    }}
                  >
                    {label}
                    {i === 0 && (
                      <span
                        className="absolute left-0 right-0 -bottom-3 h-0.5"
                        style={{ background: 'currentColor' }}
                      />
                    )}
                  </a>
                ))}
              </div>

              {/* Mobile hamburger */}
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
                className="lg:hidden flex flex-col gap-[5px]"
                style={{ color: navColor, transition: 'color .5s' }}
              >
                <span className="block w-6 h-0.5 bg-current" />
                <span className="block w-6 h-0.5 bg-current" />
                <span className="block w-4 h-0.5 bg-current" />
              </button>

              {/* Right cluster */}
              <div
                className="hidden sm:flex items-center gap-6"
                style={{
                  color: navColor,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(-12px)',
                  transition:
                    `opacity 0.6s ${EASE} 500ms, transform 0.6s ${EASE} 500ms, color .5s`
                }}
              >
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs tracking-[0.2em] uppercase font-medium"
                >
                  NEWS
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'currentColor' }}
                  >
                    <Info size={10} color={isLight ? DARK : '#ffffff'} />
                  </span>
                </a>
                <span className="hidden lg:inline text-xs tracking-[0.2em] uppercase font-medium">
                  MENU
                </span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="lg:hidden text-xs tracking-[0.2em] uppercase font-medium"
                >
                  MENU
                </button>
              </div>
            </div>
          </nav>

          {/* ---------------- Section 1 — hero ---------------- */}
          <section
            className="absolute inset-0 flex items-center px-6 sm:px-8 md:px-20 lg:px-32"
            style={{ opacity: s1, transition: 'opacity 0.1s ease-out' }}
          >
            <div className="w-full">
              <Stagger show={s1 > 0.3} delay={0}>
                <h1
                  className="font-light uppercase leading-[1.2]"
                  style={{ fontSize: 'clamp(2rem,5vw,5rem)', color: DARK }}
                >
                  Advancing resources for a cleaner future
                </h1>
              </Stagger>
              <Stagger show={s1 > 0.3} delay={150}>
                <p className="mt-6 text-sm tracking-[0.3em] uppercase" style={{ color: '#1D304590' }}>
                  Sustainable power with purpose
                </p>
              </Stagger>
            </div>
            <Stagger show={s1 > 0.3} delay={300} className="absolute bottom-12 right-6 sm:right-8 md:right-12">
              <a
                href="#"
                className="w-12 h-12 rounded-full border flex items-center justify-center hover:opacity-70"
                style={{ borderColor: '#1D304580' }}
              >
                <ArrowRight size={18} color={DARK} />
              </a>
            </Stagger>
          </section>

          {/* ---------------- Section 2 — center ---------------- */}
          <section
            className="absolute inset-0 flex items-center justify-center px-6 sm:px-8"
            style={{ opacity: s2, transition: 'opacity 0.1s ease-out' }}
          >
            <div className="max-w-[900px] text-center">
              <Stagger show={s2 > 0.3} delay={0}>
                <h2
                  className="font-extralight tracking-wide leading-[1.3] uppercase"
                  style={{ fontSize: 'clamp(1.5rem,4.5vw,4.5rem)', color: DARK }}
                >
                  We build lasting partnerships with vision{' '}
                  <span style={{ color: '#1D3045CC' }}>and precision</span>{' '}
                  <span style={{ color: '#1D304580' }}>across every frontier</span>
                </h2>
              </Stagger>
            </div>

            <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
              <Stagger show={s2 > 0.3} delay={200}>
                <a
                  href="#"
                  className="w-12 h-12 rounded-full border flex items-center justify-center"
                  style={{ borderColor: '#1D304566' }}
                >
                  <ArrowDown size={18} color={DARK} />
                </a>
              </Stagger>
              <Stagger show={s2 > 0.3} delay={350} className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: DARK }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1D304566' }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1D304566' }} />
                </div>
              </Stagger>
              <Stagger show={s2 > 0.3} delay={500} className="mt-2">
                <a
                  href="#"
                  className="w-10 h-10 rounded-full border flex items-center justify-center"
                  style={{ borderColor: '#1D30454D' }}
                >
                  <ChevronUp size={16} color="#1D3045CC" />
                </a>
              </Stagger>
            </div>
          </section>

          {/* ---------------- Section 3 — right, light type ---------------- */}
          <section
            className="absolute inset-0 flex items-center justify-end px-6 sm:px-8 md:px-20 lg:px-32"
            style={{ opacity: s3, transition: 'opacity 0.1s ease-out' }}
          >
            <div className="max-w-2xl text-left">
              <Stagger show={s3 > 0.3} delay={0}>
                <p className="text-white/60 text-lg tracking-wide mb-4">Halder | Nordvik</p>
              </Stagger>
              <Stagger show={s3 > 0.3} delay={150}>
                <h2
                  className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8"
                  style={{ fontSize: 'clamp(2rem,4vw,4rem)' }}
                >
                  Fueling ambition,
                  <br />
                  shaping tomorrow.
                </h2>
              </Stagger>
              <Stagger show={s3 > 0.3} delay={300}>
                <div className="flex items-center gap-4">
                  <span className="text-sm tracking-[0.3em] text-white/80 uppercase">
                    Contact Nordvik
                  </span>
                  <a
                    href="#"
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform duration-300"
                  >
                    <ArrowRight size={16} color="#1f2937" />
                  </a>
                </div>
              </Stagger>
            </div>
          </section>
        </div>
      </div>

      {/* ---------------- Mobile menu overlay ---------------- */}
      <div
        className={`fixed inset-0 z-[100] ${menuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        style={{
          background: DARK,
          transition: 'opacity .5s cubic-bezier(0.4,0,0.2,1), visibility .5s cubic-bezier(0.4,0,0.2,1)'
        }}
      >
        <div
          className={`h-full flex flex-col ${menuOpen ? 'translate-y-0' : '-translate-y-8'}`}
          style={{ transition: 'transform .5s cubic-bezier(0.4,0,0.2,1)' }}
        >
          <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:border-white"
            >
              <X size={18} color="#ffffff" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col justify-center px-8 sm:px-12">
            {NAV.map((label, i) => (
              <a
                key={label}
                href="#"
                onClick={() => setMenuOpen(false)}
                className="py-3 text-2xl sm:text-3xl font-light tracking-wide uppercase"
                style={{
                  color: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  opacity: menuOpen ? 1 : 0,
                  transform: menuOpen ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity .5s ease ${i * 60}ms, transform .5s ease ${i * 60}ms, color .2s`
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center justify-between px-8 sm:px-12 pb-10 text-xs tracking-[0.2em] uppercase text-white/60">
            <a href="#">NEWS</a>
            <a href="#">CONTACT</a>
          </div>
        </div>
      </div>
    </div>
  )
}
