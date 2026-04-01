'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { adminAPI, getAuthToken, setAuthSession } from '@/lib/api'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (getAuthToken()) {
      router.replace('/dashboard')
    }
  }, [router])

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
        setAuthSession(res.data.accessToken, res.data.refreshToken)
        const meRes = await adminAPI.getCurrentAdmin()
        if (meRes.success && meRes.data && typeof window !== 'undefined') {
          window.localStorage.setItem('justfiber-admin-zone-code', meRes.data.zoneCode || '')
          window.localStorage.setItem('justfiber-admin-zone-label', meRes.data.zoneName || '')
          window.localStorage.setItem('justfiber-admin-can-access-all-zones', meRes.data.canAccessAllZones ? '1' : '0')
          if (meRes.data.zoneCode && !meRes.data.canAccessAllZones) {
            window.localStorage.setItem('justfiber-active-zone-key', meRes.data.zoneCode)
            window.localStorage.setItem('justfiber-active-zone-label', meRes.data.zoneName || meRes.data.zoneCode)
          }
        }
        toast.success('Logged in')
        router.replace('/dashboard')
      } else {
        toast.error(typeof res.error === 'string' ? res.error : 'Login failed')
      }
    } catch (error: any) {
      console.log('[login] Error:', error?.message || error)
      toast.error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="modernize-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-[500px]">
        <div className="absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top,rgba(210,241,223,0.8),rgba(211,215,250,0.65),rgba(186,216,244,0.6))] opacity-70 blur-3xl" />

        <div className="relative rounded-[18px] border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.08)] md:p-10">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5d87ff] text-lg font-semibold text-white">
                J
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">JustFiber</div>
                <div className="text-sm text-slate-500">Admin Console</div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</div>
            <p className="mt-2 text-sm text-slate-500">Manage billing, customers, field teams, and network operations.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Username or email</label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="admin@justfiber.in"
                className="input h-12 w-full rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="input h-12 w-full rounded-lg"
              />
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary h-12 w-full rounded-lg text-sm font-semibold shadow-none">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-2 rounded-lg bg-[#ecf2ff] px-4 py-3 text-sm text-[#5d87ff]">
            <ShieldCheck className="h-4 w-4" />
            Authorized admin access only
          </div>
        </div>
      </div>
    </div>
  )
}
