'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader } from 'lucide-react'

export default function AllUsersDetailPage() {
  const params = useParams<{ customerId: string }>()
  const router = useRouter()
  const customerId = params.customerId

  useEffect(() => {
    if (!customerId) return
    router.replace(`/customers/${customerId}`)
  }, [customerId, router])

  return (
    <div className="card p-10 text-center">
      <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      <p className="mt-4 text-sm text-slate-500">Opening customer workspace...</p>
    </div>
  )
}
