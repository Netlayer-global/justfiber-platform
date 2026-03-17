import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

let apiClient: AxiosInstance | null = null

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor to add auth token
  client.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired or invalid - redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_session')
          localStorage.removeItem('admin_token')
          window.location.href = '/auth/login'
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = createApiClient()
  }
  return apiClient
}

// Convenience methods
export async function apiGet<T>(url: string, config?: any) {
  const client = getApiClient()
  return client.get<T>(url, config)
}

export async function apiPost<T>(url: string, data?: any, config?: any) {
  const client = getApiClient()
  return client.post<T>(url, data, config)
}

export async function apiPatch<T>(url: string, data?: any, config?: any) {
  const client = getApiClient()
  return client.patch<T>(url, data, config)
}

export async function apiDelete<T>(url: string, config?: any) {
  const client = getApiClient()
  return client.delete<T>(url, config)
}
