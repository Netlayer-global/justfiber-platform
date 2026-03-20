'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { apiPost } from '@/lib/api'
import { saveSession } from '@/lib/auth'
import { toast } from 'sonner'
import { AlertCircle, Loader2, Mail, Lock, Terminal } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    try {
      const response = await apiPost('/api/v1/admin/auth/login', {
        email: data.email,
        password: data.password,
      })

      if (response.data.success && response.data.data) {
        const session = {
          user: response.data.data.user,
          token: response.data.data.accessToken,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        }
        saveSession(session)
        toast.success('Login successful')
        router.push('/dashboard')
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Login failed. Please try again.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center glow-cyan">
            <Terminal className="w-6 h-6 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
          <p className="text-sm text-muted-foreground mt-1">JustFiber Operations & Support</p>
        </div>
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            id="email"
            type="email"
            placeholder="admin@justfiber.in"
            className="input-field pl-10"
            {...register('email')}
          />
        </div>
        {errors.email && (
          <div className="flex items-center gap-2 text-sm text-destructive mt-1">
            <AlertCircle className="w-4 h-4" />
            {errors.email.message}
          </div>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            className="input-field pl-10"
            {...register('password')}
          />
        </div>
        {errors.password && (
          <div className="flex items-center gap-2 text-sm text-destructive mt-1">
            <AlertCircle className="w-4 h-4" />
            {errors.password.message}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>

      {/* Footer Info */}
      <p className="text-center text-xs text-muted-foreground">
        Access restricted to authorized administrators only
      </p>
    </form>
  )
}
