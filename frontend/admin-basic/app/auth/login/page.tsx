'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Search, ShieldCheck, Workflow } from 'lucide-react'
import { adminAPI, getAuthToken, setAuthSession } from '@/lib/api'
import { toast } from 'sonner'

function NetworkVisual() {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(91,108,255,0.14),transparent_24%),linear-gradient(180deg,#fbfcff_0%,#f2f5fb_100%)]" />
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="absolute left-8 top-8 right-8 flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
          <div className="text-sm font-medium text-slate-700">JustFiber HQ</div>
        </div>
        <div className="text-sm font-semibold text-[#5B6CFF]">Admin</div>
      </div>

      <div className="absolute left-8 top-28 w-[220px] rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          Search settings
        </div>
        <div className="mt-5 space-y-3">
          {['Dashboard', 'Customers', 'Billing', 'Installers'].map((label, index) => (
            <div
              key={label}
              className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                index === 1
                  ? 'bg-[linear-gradient(135deg,#5B6CFF_0%,#7C4DFF_100%)] text-white'
                  : 'bg-slate-50 text-slate-600'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-10 top-28 left-[320px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-slate-900">Operations</div>
          <div className="rounded-full bg-[#5B6CFF]/10 px-4 py-2 text-sm font-medium text-[#5B6CFF]">Live</div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ['Customers', '2,148'],
            ['Pending jobs', '82'],
            ['Invoices', '514'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-8">
        <div className="max-w-sm">
          <div className="text-xs uppercase tracking-[0.28em] text-slate-400">JustFiber Admin</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">Control your ISP stack from one modern workspace.</div>
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
    <div className="modernize-shell flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="grid w-full max-w-7xl overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.1)] lg:grid-cols-[1.35fr_0.65fr]">
        <div className="hidden p-6 lg:block">
          <NetworkVisual />
        </div>

        <div className="flex min-h-[720px] flex-col justify-between border-l border-slate-200 bg-white p-8 md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5B6CFF]/20 bg-[#5B6CFF]/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-[#5B6CFF]">
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
                  <Icon className="h-4 w-4 text-[#5B6CFF]" />
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
