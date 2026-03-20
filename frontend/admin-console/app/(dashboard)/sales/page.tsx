'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { Users, TrendingUp, Target, DollarSign } from 'lucide-react'

interface SalesOverview {
  totalLeads: number
  conversions: number
  conversionRate: number
  totalBookings: number
  revenue: number
}

export default function SalesPage() {
  const [overview, setOverview] = useState<SalesOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSalesData()
  }, [])

  async function loadSalesData() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/sales/overview')
      if (response.data.success) {
        setOverview(response.data.data)
      }
    } catch (error) {
      toast.error('Failed to load sales data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sales Operations</h1>
        <p className="text-muted-foreground mt-1">
          Track leads, bookings, and sales performance
        </p>
      </div>

      {/* Stats */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Leads"
            value={overview.totalLeads}
            icon={<Users className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            title="Conversions"
            value={overview.conversions}
            icon={<TrendingUp className="w-5 h-5" />}
            color="success"
          />
          <StatsCard
            title="Conversion Rate"
            value={`${overview.conversionRate}%`}
            icon={<Target className="w-5 h-5" />}
            color="secondary"
          />
          <StatsCard
            title="Booking Revenue"
            value={`₹${overview.revenue.toLocaleString('en-IN')}`}
            icon={<DollarSign className="w-5 h-5" />}
            color="warning"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card cursor-pointer hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-foreground mb-2">Leads</h3>
          <p className="text-sm text-muted-foreground">View and manage sales leads</p>
        </div>
        <div className="card cursor-pointer hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-foreground mb-2">Bookings</h3>
          <p className="text-sm text-muted-foreground">Manage customer bookings and KYC</p>
        </div>
        <div className="card cursor-pointer hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-foreground mb-2">Sales Agents</h3>
          <p className="text-sm text-muted-foreground">View agent performance metrics</p>
        </div>
        <div className="card cursor-pointer hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-foreground mb-2">Performance</h3>
          <p className="text-sm text-muted-foreground">Detailed performance analytics</p>
        </div>
      </div>
    </div>
  )
}
