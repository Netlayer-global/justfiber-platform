'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    const token = api.getToken()
    if (!token) {
      router.push('/auth/login')
    }
  }, [router])

  return <>{children}</>
}
