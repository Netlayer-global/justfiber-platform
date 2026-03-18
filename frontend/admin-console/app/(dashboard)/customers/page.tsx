'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'
import { getStatusColor, formatDate } from '@/lib/utils'
import { Search, Plus, MoreVertical, Eye, Pause, Play, RotateCcw } from 'lucide-react'
import { Customer } from '@/lib/types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean
    type: string
    customerId?: string
  }>({ isOpen: false, type: '' })

  useEffect(() => {
    loadCustomers()
  }, [searchQuery])

  async function loadCustomers() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getCustomers(1, 50, searchQuery)
      if (response.data.success) {
        setCustomers(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load customers')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCustomerAction(action: string, customerId: string) {
    try {
      let response
      if (action === 'suspend') {
        response = await adminAPI.suspendCustomer(customerId)
      } else if (action === 'resume') {
        response = await adminAPI.resumeCustomer(customerId)
      } else if (action === 'retry') {
        response = await adminAPI.retryProvisioning(customerId)
      } else {
        return
      }

      if (response?.data.success) {
        toast.success(`Customer ${action}ed successfully`)
        loadCustomers()
        setActionModal({ isOpen: false, type: '' })
        setShowDetailDrawer(false)
      }
    } catch (error) {
      toast.error(`Failed to ${action} customer`)
      console.error(error)
    }
  }

  const columnHelper = createColumnHelper<Customer>()
  const columns = [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => <div className="font-medium text-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('plan', {
      header: 'Plan',
      cell: (info) => <div className="text-sm font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`badge ${getStatusColor(info.getValue())}`}>
          {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
        </span>
      ),
    }),
    columnHelper.accessor('totalBilled', {
      header: 'Total Billed',
      cell: (info) => <div className="text-sm">₹{info.getValue().toLocaleString('en-IN')}</div>,
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${info.row.original.id}`}
            className="p-2 hover:bg-muted rounded transition-colors"
            aria-label="View details"
          >
            <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </Link>
          <div className="relative group">
            <button className="p-2 hover:bg-muted rounded transition-colors">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
              {info.row.original.status === 'active' && (
                <button
                  onClick={() => {
                    setActionModal({
                      isOpen: true,
                      type: 'suspend',
                      customerId: info.row.original.id,
                    })
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm text-destructive"
                >
                  <Pause className="w-4 h-4" />
                  Suspend
                </button>
              )}
              {info.row.original.status === 'suspended' && (
                <button
                  onClick={() => {
                    setActionModal({
                      isOpen: true,
                      type: 'resume',
                      customerId: info.row.original.id,
                    })
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm text-green-400"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
              )}
              <button
                onClick={() => {
                  setActionModal({
                    isOpen: true,
                    type: 'retry',
                    customerId: info.row.original.id,
                  })
                }}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm text-foreground"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Provisioning
              </button>
            </div>
          </div>
        </div>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer accounts and subscriptions
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          className="input-field pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable columns={columns} data={customers} isLoading={isLoading} />

      {/* Detail Drawer */}
      {selectedCustomer && (
        <DetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          title={selectedCustomer.name}
        >
          <div className="space-y-6">
            {/* Customer Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Personal Information</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground">{selectedCustomer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="text-foreground">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`badge ${getStatusColor(selectedCustomer.status)} inline-block mt-1`}>
                    {selectedCustomer.status.charAt(0).toUpperCase() + selectedCustomer.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Billing Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Billing Information</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-foreground font-medium">{selectedCustomer.plan}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Billed</p>
                  <p className="text-foreground font-medium">
                    ₹{selectedCustomer.totalBilled.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Payment</p>
                  <p className="text-foreground">{formatDate(selectedCustomer.lastPayment)}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-border pt-6">
              <button
                onClick={() => {
                  setActionModal({
                    isOpen: true,
                    type: selectedCustomer.status === 'active' ? 'suspend' : 'resume',
                    customerId: selectedCustomer.id,
                  })
                }}
                className="w-full btn-secondary text-sm"
              >
                {selectedCustomer.status === 'active' ? 'Suspend Account' : 'Resume Account'}
              </button>
              <button
                onClick={() => {
                  setActionModal({
                    isOpen: true,
                    type: 'retry',
                    customerId: selectedCustomer.id,
                  })
                }}
                className="w-full btn-ghost text-sm"
              >
                Retry Provisioning
              </button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* Action Modal */}
      <ActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, type: '' })}
        onConfirm={() =>
          actionModal.customerId && handleCustomerAction(actionModal.type, actionModal.customerId)
        }
        title={
          actionModal.type === 'suspend'
            ? 'Suspend Customer?'
            : actionModal.type === 'resume'
              ? 'Resume Customer?'
              : 'Retry Provisioning?'
        }
        description={
          actionModal.type === 'suspend'
            ? 'This will suspend the customer account and their service.'
            : actionModal.type === 'resume'
              ? 'This will reactivate the customer account.'
              : 'This will attempt to reprovision the customer account.'
        }
        confirmText={actionModal.type === 'suspend' ? 'Suspend' : actionModal.type === 'resume' ? 'Resume' : 'Retry'}
        isDestructive={actionModal.type === 'suspend'}
      />
    </div>
  )
}
