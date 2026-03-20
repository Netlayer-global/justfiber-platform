'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export interface Admin {
  id: string
  email: string
  name: string
  role: string
}

interface AuthContextType {
  admin: Admin | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('adminToken')
        if (!token) {
          setIsLoading(false)
          return
        }

        const response = await apiClient.getMe()
        if (response.data?.success && response.data?.data) {
          setAdmin(response.data.data as Admin)
        } else {
          localStorage.removeItem('adminToken')
        }
      } catch (err) {
        console.error('[v0] Auth check failed:', err)
        localStorage.removeItem('adminToken')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setError(null)
      setIsLoading(true)
      const response = await apiClient.login(email, password)

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Login failed')
      }

      const { accessToken, admin: adminData } = response.data.data
      apiClient.setToken(accessToken)
      setAdmin(adminData)
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
    apiClient.clearToken()
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
