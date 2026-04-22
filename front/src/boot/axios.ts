import { defineBoot } from '#q-app/wrappers';
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import { getAccessToken, setAccessToken, removeAccessToken, setAccessTokenExpiresAt, removeAccessTokenExpiresAt, isTokenExpiringSoon } from '../shared/lib/cookies';

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
    $api: AxiosInstance;
  }
}

// Получаем базовый URL из переменных окружения
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Создаем основной API instance для нашего backend
const api = axios.create({
  baseURL: `${API_BASE_URL}/user-api`,  // URL нашего FastAPI сервера
  headers: {
    'Content-Type': 'application/json'
  }
});

// Создаем отдельный API instance для dev endpoints
const devApi = axios.create({
  baseURL: API_BASE_URL,  // URL нашего FastAPI сервера без префикса
  headers: {
    'Content-Type': 'application/json'
  }
});

// Extend AxiosRequestConfig to include our custom _retry property
interface AxiosRequestConfigWithRetry extends AxiosRequestConfig {
  _retry?: boolean;
}

// Переменная для предотвращения множественных одновременных refresh запросов
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string | null) => void;
  reject: (reason: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

// Функция обновления токена
const refreshAccessToken = async (): Promise<string | null> => {
  const currentAccessToken = getAccessToken();
  if (!currentAccessToken) {
    throw new Error('Access token not found');
  }

  // Отправляем текущий access_token в Authorization header
  const refreshResponse = await axios.post(
    `${API_BASE_URL}/user-api/auth/access-token-refresh`,
    null,
    {
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`
      }
    }
  );

  const newAccessToken = refreshResponse.data.access_token;
  const newExpiresAt = refreshResponse.data.expires_at;

  // Сохраняем новый access_token и expires_at
  if (newAccessToken && newExpiresAt) {
    setAccessToken(newAccessToken, refreshResponse.data.session_expires_days || 7);
    setAccessTokenExpiresAt(newExpiresAt, refreshResponse.data.session_expires_days || 7);
  }

  return newAccessToken;
};

// Список публичных эндпоинтов, которые не требуют авторизации
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login-confirm-code-start',
  '/auth/login-confirm-code-finish',
  '/auth/registration-confirm-code-start',
  '/auth/registration-confirm-code-finish',
  '/auth/access-token-refresh'
];

// Проверяет, является ли URL публичным эндпоинтом авторизации
const isPublicAuthEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return PUBLIC_AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// Общая функция для создания request interceptor
const createRequestInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.request.use(async (config) => {
    const accessToken = getAccessToken();
    
    // Пропускаем публичные эндпоинты авторизации
    if (isPublicAuthEndpoint(config.url)) {
      return config;
    }
    
    if (accessToken) {
      // Проверяем, не истекает ли токен в ближайшие 5 минут
      if (isTokenExpiringSoon(5) && !isRefreshing) {
        try {
          isRefreshing = true;
          const newToken = await refreshAccessToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          processQueue(err, null);
          throw error;
        } finally {
          isRefreshing = false;
        }
      } else {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    
    return config;
  });
};

// Общая функция для создания response interceptor (обработка 401)
const createResponseInterceptor = (axiosInstance: AxiosInstance) => {
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const axiosError = error as AxiosError;
      const originalRequest = axiosError.config as AxiosRequestConfigWithRetry;

      if (axiosError.response?.status === 401 && originalRequest && !originalRequest._retry) {
        if (isRefreshing) {
          // Если refresh уже в процессе, добавляем запрос в очередь
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => {
            return axiosInstance(originalRequest);
          }).catch((err: Error) => {
            return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newAccessToken = await refreshAccessToken();

          // Обновляем заголовок авторизации для оригинального запроса
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);

          // Повторяем оригинальный запрос
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          const err = refreshError instanceof Error ? refreshError : new Error(String(refreshError));
          processQueue(err, null);

          // Очищаем access_token и перенаправляем на авторизацию
          removeAccessToken();
          removeAccessTokenExpiresAt();

          if (window.location.pathname !== '/auth' &&
              !window.location.pathname.startsWith('/auth/')) {
            window.location.href = '/auth';
          }
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  );
};

// Применяем interceptors к обоим API instances
createRequestInterceptor(api);
createResponseInterceptor(api);
createRequestInterceptor(devApi);
createResponseInterceptor(devApi);

export default defineBoot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios;
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$api = api;
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
});

export { api, devApi };
