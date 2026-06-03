'use client'

import { motion, useReducedMotion } from 'framer-motion'

const CLOUDS = [
  { w: 720, h: 480, top: '-5%',  left: '-8%',  duration: 32, delayX: 0,  delayY: 0  },
  { w: 600, h: 400, top: '55%',  left: '62%',  duration: 38, delayX: 8,  delayY: 4  },
  { w: 480, h: 320, top: '20%',  left: '70%',  duration: 26, delayX: 3,  delayY: 12 },
  { w: 400, h: 280, top: '72%',  left: '-2%',  duration: 42, delayX: 14, delayY: 7  },
  { w: 320, h: 220, top: '40%',  left: '38%',  duration: 30, delayX: 6,  delayY: 18 },
]

export function AnimatedBackground() {
  const reduced = useReducedMotion()

  return (
    <>
      {/* Cloud blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {CLOUDS.map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: c.w,
              height: c.h,
              top: c.top,
              left: c.left,
              background:
                'radial-gradient(ellipse at center, rgba(43,114,232,0.09) 0%, rgba(43,114,232,0.04) 55%, transparent 100%)',
              filter: 'blur(48px)',
            }}
            animate={
              reduced
                ? {}
                : {
                    x: [0, 60, 20, 80, 0],
                    y: [0, 25, -10, 15, 0],
                  }
            }
            transition={{
              duration: c.duration,
              delay: c.delayX * 0.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      {/* Grain texture */}
      <div className="grain" aria-hidden="true" />
    </>
  )
}
