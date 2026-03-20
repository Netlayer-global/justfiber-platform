'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export interface Admin {
  id: string
  username?: string
  email: string
  fullName?: string
  name?: string
  role?: string
  roles?: string[]
  permissions?: string[]
}

interface AuthContextType {
  admin: Admin | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCurrentAdmin = async () => {
    const response = await apiClient.getMe()
    const adminData = response.data?.data || response.data

    if (response.data?.success === false || !adminData?.id) {
      throw new Error('Unable to load admin profile')
    }

    setAdmin(adminData as Admin)
  }

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('adminToken')
        if (!token) {
          setIsLoading(false)
          return
        }

        await loadCurrentAdmin()
      } catch (err) {
        console.error('[v0] Auth check failed:', err)
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminRefreshToken')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (login: string, password: string) => {
    try {
      setError(null)
      setIsLoading(true)
      const response = await apiClient.login(login, password)

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Login failed')
      }

      const { accessToken, refreshToken } = response.data.data
      apiClient.setToken(accessToken, refreshToken)
      await loadCurrentAdmin()
      router.push('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    apiClient.logout()
    setAdmin(null)
    router.push('/auth/login')
  }

  return (
    <AuthContext.Provider value={{ admin, isLoading, isAuthenticated: !!admin, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
