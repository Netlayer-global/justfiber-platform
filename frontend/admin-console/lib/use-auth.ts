import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
}

interface UseAuthReturn {
  user: AdminUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const response = await apiClient.getMe()
        if (response.data && response.data.success !== false) {
          setUser(response.data.data || response.data)
        } else {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminRefreshToken')
        }
      } catch (error) {
        console.error('[v0] Auth check failed:', error)
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminRefreshToken')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setIsLoading(true)
        const response = await apiClient.login(email, password)

        if (!response.data.success) {
          throw new Error(response.data.error || response.data.message || 'Login failed')
        }

        const { accessToken, refreshToken, user: userData } = response.data.data

        // Save tokens
        apiClient.setToken(accessToken, refreshToken)

        // Set user
        setUser(userData)

        toast.success('Login successful')
        router.push('/dashboard')
      } catch (error: any) {
        console.error('[v0] Login error:', error)
        toast.error(error.message || 'Login failed')
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [router]
  )

  const logout = useCallback(() => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminRefreshToken')
    setUser(null)
    router.push('/auth/login')
    toast.success('Logged out')
  }, [router])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  }
}
