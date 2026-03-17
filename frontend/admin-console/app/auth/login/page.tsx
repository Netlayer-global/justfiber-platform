'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { getSession } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // If already logged in, redirect to dashboard
    const session = getSession()
    if (session && Date.now() < session.expiresAt) {
      router.push('/dashboard')
    }
  }, [router])

  return <LoginForm />
}
