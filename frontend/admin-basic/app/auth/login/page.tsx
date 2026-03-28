'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, ShieldCheck, Workflow } from 'lucide-react'
import { adminAPI, getAuthToken, setAuthSession } from '@/lib/api'
import { toast } from 'sonner'

function NetworkVisual() {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-[28px] border border-slate-200 bg-[#f5f9ff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,125,255,0.28),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(117,79,255,0.1),transparent_20%),linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="absolute left-10 top-10 h-24 w-24 rounded-[26px] border border-[#2d7dff]/30 bg-white shadow-[0_0_45px_rgba(45,125,255,0.12)]" />
      <div className="absolute left-24 top-40 h-28 w-36 rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]" />
      <div className="absolute right-14 top-20 h-20 w-20 rounded-[22px] border border-slate-200 bg-white" />
      <div className="absolute right-20 bottom-16 h-24 w-40 rounded-[28px] border border-[#2d7dff]/20 bg-white shadow-[0_0_35px_rgba(45,125,255,0.12)]" />
      <div className="absolute bottom-28 left-12 h-16 w-16 rounded-[18px] border border-slate-200 bg-white" />

      <div className="absolute left-[120px] top-[148px] h-[2px] w-[190px] bg-gradient-to-r from-[#2d7dff] to-transparent" />
      <div className="absolute left-[280px] top-[132px] h-[140px] w-[2px] bg-gradient-to-b from-[#2d7dff] to-transparent" />
      <div className="absolute left-[140px] bottom-[116px] h-[2px] w-[290px] bg-gradient-to-r from-[#2d7dff]/80 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-8">
        <div className="max-w-sm">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">JustFiber Admin</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">Control your ISP stack from one clean console.</div>
          <div className="mt-3 text-sm leading-7 text-slate-500">
            Billing, customers, plans, devices, installers, and service operations in one secure workspace.
          </div>
        </div>
      </div>
    </div>
  )
}

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
    <div className="dashboard-shell flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="grid w-full max-w-7xl overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.12)] lg:grid-cols-[1.3fr_0.7fr]">
        <div className="hidden p-6 lg:block">
          <NetworkVisual />
        </div>

        <div className="flex min-h-[720px] flex-col justify-between border-l border-slate-200 bg-white p-8 md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2d7dff]/30 bg-[#2d7dff]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#78aaff]">
              <ShieldCheck className="h-4 w-4" />
              Secure sign in
            </div>

            <div className="mt-8 text-4xl font-semibold tracking-tight text-slate-900">Admin login</div>
            <p className="mt-3 max-w-sm text-sm leading-7 text-slate-500">
              Sign in to manage plans, customers, billing, field operations, and network devices.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Username or email</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin@justfiber.in"
                  className="input h-14 w-full rounded-[18px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-600">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="input h-14 w-full rounded-[18px]"
                />
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary h-14 w-full rounded-[18px] text-base">
                {isLoading ? 'Signing in...' : 'Enter admin console'}
              </button>
            </form>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Plans', value: 'Commercial control', icon: Workflow },
              { label: 'Billing', value: 'Invoices and payments', icon: LockKeyhole },
              { label: 'Access', value: 'Authorized users only', icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <Icon className="h-4 w-4 text-[#78aaff]" />
                  <div className="mt-4 text-sm font-medium text-slate-900">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.value}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
