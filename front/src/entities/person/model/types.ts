/**
 * Person entity types
 * Реэкспорт из shared/api для удобства
 */
export type { 
  Person, 
  CreatePersonRequest, 
  UpdatePersonRequest
  // PersonListResponse // deprecated - бэкенд возвращает просто массив
} from '@/shared/api/person'
