import { ref } from 'vue'
import { personApi } from '@/shared/api'
import type { Person } from '@/shared/api'

export interface PersonOption {
  label: string
  value: number
  person: Person
}

export function personToOption(person: Person): PersonOption {
  return {
    label: [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' '),
    value: person.id,
    person,
  }
}

export function usePersonSearch() {
  const personOptions = ref<PersonOption[]>([])
  const personSearchLoading = ref(false)

  const searchPersons = async (val: string, update: (fn: () => void) => void) => {
    personSearchLoading.value = true
    try {
      const filters = val.trim()
        ? JSON.stringify([
            { field: 'first_name', operator: 'ILIKE', value: `%${val}%` },
            'OR',
            { field: 'last_name', operator: 'ILIKE', value: `%${val}%` },
          ])
        : undefined
      const persons = await personApi.list({
        limit: 20,
        ...(filters ? { filters } : {}),
      } as Parameters<typeof personApi.list>[0] & { filters?: string })
      update(() => {
        personOptions.value = persons.map(personToOption)
      })
    } catch {
      update(() => {
        personOptions.value = []
      })
    } finally {
      personSearchLoading.value = false
    }
  }

  return { personOptions, personSearchLoading, searchPersons }
}
