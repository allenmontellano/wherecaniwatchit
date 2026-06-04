import type { Title } from './database'

export interface SyncedResult {
  title: Title
  availabilityByRegion: Record<string, string[]>
}
