export const nowIso = (): string => new Date().toISOString()

export const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

export const minutesFromNow = (minutes: number): string =>
  new Date(Date.now() + minutes * 60 * 1000).toISOString()
