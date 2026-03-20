'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getAuthToken } from '@/lib/api'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/auth/login')
    }
  }, [router])

  return null
}
