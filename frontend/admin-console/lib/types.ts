// Authentication types
export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'superadmin'
  permissions: string[]
  createdAt: string
}

export interface AdminSession {
  user: AdminUser
  token: string
  expiresAt: number
}

export interface AuthResponse {
  success: boolean
  data?: {
    accessToken: string
    user: AdminUser
  }
  error?: {
    message: string
    code: string
  }
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: {
    page: number
    limit: number
    total: number
  }
}

export interface ApiError {
  success: false
  error: {
    message: string
    code: string
    details?: Record<string, any>
  }
}
