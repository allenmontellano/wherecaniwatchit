export type AppEnv = 'production' | 'staging'

export function appEnv(): AppEnv {
  return process.env.NEXT_PUBLIC_ENV === 'staging' ? 'staging' : 'production'
}

export function isStaging(): boolean {
  return appEnv() === 'staging'
}
