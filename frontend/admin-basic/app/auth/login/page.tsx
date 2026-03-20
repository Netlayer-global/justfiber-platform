'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminAPI, setAuthToken } from '@/lib/api'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!login || !password) {
      toast.error('Please enter credentials')
      return
    }

    try {
      setIsLoading(true)
      const res = await adminAPI.login(login, password)
      if (res.success && res.data?.accessToken) {
        setAuthToken(res.data.accessToken)
        toast.success('Logged in')
        router.push('/dashboard')
      } else {
        toast.error(res.error || 'Login failed')
      }
    } catch (error: any) {
      console.log('[v0] Login error:', error.message)
      toast.error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md card p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#f0f4f8]">JustFiber Admin</h1>
          <p className="text-[#b4bcc4]">ISP Operations Console</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#f0f4f8]">Login</label>
          <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="admin" className="input w-full" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[#f0f4f8]">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input w-full" />
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full">
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-xs text-center text-[#b4bcc4]">Authorized Personnel Only</p>
      </form>
    </div>
  )
}
