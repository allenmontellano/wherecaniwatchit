'use client'

import { motion, useReducedMotion } from 'framer-motion'

// Clouds: discrete positions so they read as separate blobs, not a full-page tint
// Using 0.12 opacity (temporarily high) so we can confirm animation is working
const CLOUDS = [
  // top-left large blob
  { w: 700, h: 500, top: -100, left: -80,  xDrift: 120, duration: 34, delay: 0  },
  // bottom-right
  { w: 600, h: 420, top: 480,  left: 900,  xDrift: 100, duration: 40, delay: 6  },
  // top-right
  { w: 500, h: 360, top: -60,  left: 1100, xDrift: 80,  duration: 28, delay: 12 },
  // center-left mid
  { w: 440, h: 320, top: 300,  left: -120, xDrift: 110, duration: 36, delay: 18 },
] as const

export function AnimatedBackground() {
  const reduced = useReducedMotion()

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0, backgroundColor: '#FFFFFF' }}
      aria-hidden="true"
    >
      {CLOUDS.map((c, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            width: c.w,
            height: c.h,
            top: c.top,
            left: c.left,
            borderRadius: '50%',
            backgroundColor: 'rgba(43, 114, 232, 0.12)',
            filter: 'blur(90px)',
            willChange: 'transform',
          }}
          animate={reduced ? {} : { x: [0, c.xDrift] }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Grain texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.025,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
