'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Mail, LogIn } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const token = localStorage.getItem('adminToken')
    if (token) {
      router.push('/dashboard')
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }

    try {
      setIsLoading(true)
      const response = await apiClient.login(email, password)

      if (!response.data.success) {
        throw new Error(response.data.error || 'Login failed')
      }

      const { accessToken, refreshToken } = response.data.data
      apiClient.setToken(accessToken, refreshToken)

      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('[v0] Login error:', error)
      toast.error(error.response?.data?.error || error.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      {/* Background grid effect */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 102, 204, 0.1) 25%, rgba(0, 102, 204, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 102, 204, 0.1) 75%, rgba(0, 102, 204, 0.1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 102, 204, 0.1) 25%, rgba(0, 102, 204, 0.1) 26%, transparent 27%, transparent 74%, rgba(0, 102, 204, 0.1) 75%, rgba(0, 102, 204, 0.1) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="card p-8 space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3 text-center"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 border border-primary/20 mx-auto">
              <LogIn className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">JustFiber Admin</h1>
              <p className="text-sm text-muted-foreground mt-1">Operations Console</p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label className="label flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@justfiber.com"
                disabled={isLoading}
                className="input-field"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="label flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? '✕' : '●'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-6 text-base font-semibold"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
              ) : (
                'Sign In'
              )}
            </button>
          </motion.form>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-xs text-muted-foreground space-y-2"
          >
            <p>Admin Console Access Only</p>
            <p className="text-border">Authorized Personnel Only</p>
          </motion.div>
        </div>

        {/* Development hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 rounded bg-muted/30 border border-border/50 text-xs text-muted-foreground text-center"
        >
          Test credentials available in backend configuration
        </motion.div>
      </motion.div>
    </div>
  )
}
