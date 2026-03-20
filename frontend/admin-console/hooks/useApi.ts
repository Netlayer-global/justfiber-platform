import { useState, useCallback } from 'react'
import { AxiosError } from 'axios'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

type ApiErrorPayload = {
  error?: {
    message?: string
  }
}

export function useApi() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const request = useCallback(
    async <T,>(
      method: 'get' | 'post' | 'patch' | 'delete',
      url: string,
      data?: any,
      config?: any
    ): Promise<T | null> => {
      setIsLoading(true)
      setError(null)

      try {
        let response

        switch (method) {
          case 'get':
            response = await apiGet<T>(url, config)
            break
          case 'post':
            response = await apiPost<T>(url, data, config)
            break
          case 'patch':
            response = await apiPatch<T>(url, data, config)
            break
          case 'delete':
            response = await apiDelete<T>(url, config)
            break
          default:
            throw new Error('Invalid method')
        }

        return response.data
      } catch (err) {
        const axiosError = err as AxiosError<ApiErrorPayload>
        const errorMessage =
          axiosError.response?.data?.error?.message || axiosError.message || 'An error occurred'
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return { isLoading, error, request }
}
