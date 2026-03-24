'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ShieldCheck } from 'lucide-react'
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
      console.log('[login] Error:', error.message)
      toast.error('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="dashboard-shell flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="card flex min-h-[680px] flex-col justify-between p-8 md:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8224E3]/30 bg-[#8224E3]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#8224E3]">
              <ShieldCheck className="h-4 w-4" />
              Secure access
            </div>
            <h1 className="mt-6 text-5xl font-black tracking-[-0.05em] text-white md:text-6xl">
              Neon-grade control for
              <span className="text-[#8224E3]"> fiber operations.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/60">
              Manage customers, field teams, devices, tickets, and billing from a sharper JustFiber admin cockpit.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Billing intelligence', 'Collection, invoices, notes, and recovery from one layer.'],
              ['Field visibility', 'Bookings, installers, activation jobs, and serviceability zones.'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-lg font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card flex min-h-[680px] flex-col justify-between p-8 md:p-10">
          <div>
            <div className="text-2xl font-black tracking-tight text-white">
              Just<span className="text-[#8224E3]">Fiber</span>
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.25em] text-white/40">Admin sign in</div>

            <div className="mt-10 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Login</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin"
                  className="input w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  className="input w-full"
                />
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full py-4 text-base">
                {isLoading ? 'Signing in...' : 'Enter Admin Console'}
              </button>

              <Link href="/" className="btn-secondary w-full py-4 text-base">
                View Landing Page <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <p className="mt-10 text-xs uppercase tracking-[0.18em] text-white/35">Authorized personnel only</p>
        </form>
      </div>
    </div>
  )
}
