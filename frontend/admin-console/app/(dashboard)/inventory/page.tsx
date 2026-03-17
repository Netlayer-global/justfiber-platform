'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { Package, AlertCircle, TrendingDown } from 'lucide-react'

interface InventoryOverview {
  totalItems: number
  lowStockItems: number
  totalValue: number
}

export default function InventoryPage() {
  const [overview, setOverview] = useState<InventoryOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('items')

  useEffect(() => {
    loadInventoryData()
  }, [])

  async function loadInventoryData() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/foundation/inventory/overview')
      if (response.data.success) {
        setOverview(response.data.data)
      }
    } catch (error) {
      toast.error('Failed to load inventory data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground mt-1">
          Manage stock, vendors, and inventory movements
        </p>
      </div>

      {/* Stats */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Total Items"
            value={overview.totalItems}
            icon={<Package className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            title="Low Stock Items"
            value={overview.lowStockItems}
            icon={<AlertCircle className="w-5 h-5" />}
            color="warning"
          />
          <StatsCard
            title="Inventory Value"
            value={`₹${overview.totalValue.toLocaleString('en-IN')}`}
            icon={<TrendingDown className="w-5 h-5" />}
            color="secondary"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {['items', 'vendors', 'locations'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 font-medium transition-colors border-b-2',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card">
        <p className="text-muted-foreground text-center py-12">
          {activeTab === 'items' && 'Inventory items management'}
          {activeTab === 'vendors' && 'Vendor management'}
          {activeTab === 'locations' && 'Storage location management'}
        </p>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
