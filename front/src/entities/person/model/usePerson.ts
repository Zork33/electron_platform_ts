/**
 * Person entity composable
 * Использует переиспользуемый useCrud
 */
import { computed } from 'vue'
import { useCrud } from '@/shared/lib/crud'
import { personApi } from '@/shared/api'
import type { Person, CreatePersonRequest, UpdatePersonRequest } from './types'

export function usePerson() {
  // Базовый CRUD через переиспользуемый composable
  const crud = useCrud<Person, CreatePersonRequest, UpdatePersonRequest>({
    apiClient: personApi,
    entityName: 'person',
    supportsSoftDelete: true
  })

  // Дополнительные хелперы специфичные для Person
  const getFullName = (person: Person): string => {
    const parts = [person.first_name]
    if (person.middle_name) parts.push(person.middle_name)
    if (person.last_name) parts.push(person.last_name)
    return parts.join(' ')
  }

  const formatBirthDate = (birthDate: string | null): string | null => {
    if (!birthDate) return null
    return new Date(birthDate).toLocaleDateString('ru-RU')
  }

  // Computed для удобства
  const personsWithFullName = computed(() => 
    crud.items.value.map((person: Person) => ({
      ...person,
      fullName: getFullName(person)
    }))
  )

  return {
    // Базовый CRUD
    ...crud,
    
    // Специфичные хелперы
    getFullName,
    formatBirthDate,
    personsWithFullName
  }
}
