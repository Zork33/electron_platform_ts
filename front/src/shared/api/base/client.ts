/**
 * Базовый API клиент
 */
import type { AxiosInstance } from 'axios'
import type { ListParams } from './types'

export class BaseApiClient {
  constructor(protected axios: AxiosInstance) {}

  /**
   * Обработка ошибок API
   */
  protected handleError(error: unknown): never {
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { data?: unknown } }
      const errorData = axiosError.response?.data
      if (errorData) {
        throw new Error(JSON.stringify(errorData))
      }
    }
    throw error instanceof Error ? error : new Error(String(error))
  }

  /**
   * GET запрос
   */
  protected async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.axios.get<T>(url, { params })
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * POST запрос
   */
  protected async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.axios.post<T>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * PATCH запрос
   */
  protected async patch<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.axios.patch<T>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * PUT запрос
   */
  protected async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response = await this.axios.put<T>(url, data)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * DELETE запрос
   */
  protected async deleteRequest<T>(url: string): Promise<T> {
    try {
      const response = await this.axios.delete<T>(url)
      return response.data
    } catch (error) {
      return this.handleError(error)
    }
  }
}

/**
 * Базовый CRUD клиент
 */
export class BaseCrudClient<
  TEntity,
  TCreateDTO = Partial<TEntity>,
  TUpdateDTO = Partial<TEntity>
> extends BaseApiClient {
  constructor(
    axios: AxiosInstance,
    protected baseUrl: string
  ) {
    super(axios)
  }

  /**
   * Получить список
   */
  async list(params?: ListParams): Promise<TEntity[]> {
    return this.get<TEntity[]>(`${this.baseUrl}`, params as Record<string, unknown>)
  }

  /**
   * Получить по ID
   */
  async getById(id: number): Promise<TEntity> {
    return this.get<TEntity>(`${this.baseUrl}/${id}`)
  }

  /**
   * Создать
   */
  async create(data: TCreateDTO): Promise<TEntity> {
    return this.post<TEntity>(`${this.baseUrl}`, data)
  }

  /**
   * Обновить
   */
  async update(id: number, data: TUpdateDTO): Promise<TEntity> {
    return this.put<TEntity>(`${this.baseUrl}/${id}`, data)
  }

  /**
   * Удалить
   */
  async deleteById(id: number): Promise<TEntity> {
    return this.deleteRequest<TEntity>(`${this.baseUrl}/${id}`)
  }
}
