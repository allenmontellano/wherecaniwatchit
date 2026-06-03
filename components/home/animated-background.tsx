'use client'

import { motion, useReducedMotion } from 'framer-motion'

// Soft cloud puffs: white core fading to a faint blue tint at the edge.
// Positioned so several are partially visible at the screen edges, varied in size.
const CLOUDS = [
  // large — top-left, hugging the corner
  { w: 760, h: 520, top: '-12%', left: '-10%', xDrift: 90,  yDrift: 30,  duration: 38, delay: 0  },
  // large — bottom-right, partially off-screen
  { w: 720, h: 500, top: '62%',  left: '70%',  xDrift: -80, yDrift: -36, duration: 44, delay: 4  },
  // medium — top-right edge
  { w: 540, h: 380, top: '-8%',  left: '74%',  xDrift: 70,  yDrift: 24,  duration: 32, delay: 9  },
  // medium — center-left edge
  { w: 500, h: 360, top: '46%',  left: '-12%', xDrift: 86,  yDrift: -22, duration: 36, delay: 14 },
  // small — upper-center drifting accent
  { w: 380, h: 280, top: '8%',   left: '40%',  xDrift: -60, yDrift: 30,  duration: 30, delay: 18 },
] as const

// White core → 10% blue edge. Page stays white; only the cloud fringe shows colour.
const CLOUD_GRADIENT =
  'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.9) 0%, rgba(43,114,232,0.08) 72%, rgba(43,114,232,0) 100%)'

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
            background: CLOUD_GRADIENT,
            filter: 'blur(70px)',
            willChange: 'transform',
          }}
          animate={reduced ? {} : { x: [0, c.xDrift, 0], y: [0, c.yDrift, 0] }}
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
