// Deterministic gradient placeholder for titles without poster art.
const GRADIENTS = [
  'linear-gradient(150deg,#E8F0E4,#D6E6CF)',
  'linear-gradient(150deg,#E3EAF4,#CFD9E8)',
  'linear-gradient(150deg,#EDE7E0,#DED3C6)',
  'linear-gradient(150deg,#F0E4EC,#E4CFE0)',
  'linear-gradient(150deg,#E4EEF0,#CFE2E6)',
]

export function posterGradient(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}
