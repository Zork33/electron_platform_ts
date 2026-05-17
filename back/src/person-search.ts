import type { Person } from './types.js'

export interface PersonSearchResult extends Person {
  score: number
}

export function searchPersons(
  persons: Person[],
  query: string,
  limit = 10,
  scoreThreshold?: number | null
): PersonSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase()
  return persons
    .map((person) => {
      const haystack = [person.last_name, person.first_name, person.middle_name, person.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const score = normalizedQuery ? scoreText(normalizedQuery, haystack) : 0
      return { ...person, score }
    })
    .filter((person) => {
      if (!normalizedQuery) return true
      if (typeof scoreThreshold === 'number' && Number.isFinite(scoreThreshold)) {
        return person.score >= scoreThreshold
      }
      return person.score > 0
    })
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, Math.max(1, limit))
}

function scoreText(query: string, text: string): number {
  const queryVector = buildVector(query)
  const textVector = buildVector(text)
  let dot = 0
  let queryNorm = 0
  let textNorm = 0
  for (const [token, weight] of queryVector.entries()) {
    queryNorm += weight * weight
    const textWeight = textVector.get(token) ?? 0
    dot += weight * textWeight
  }
  for (const weight of textVector.values()) {
    textNorm += weight * weight
  }
  if (!dot || !queryNorm || !textNorm) return 0
  return dot / (Math.sqrt(queryNorm) * Math.sqrt(textNorm))
}

function buildVector(text: string): Map<string, number> {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const vector = new Map<string, number>()
  if (!normalized) return vector
  const padded = `  ${normalized}  `
  for (let index = 0; index < padded.length - 2; index += 1) {
    const token = padded.slice(index, index + 3)
    vector.set(token, (vector.get(token) ?? 0) + 1)
  }
  return vector
}
