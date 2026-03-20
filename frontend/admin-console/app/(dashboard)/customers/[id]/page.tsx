'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { Phone, Mail, MapPin, Calendar, AlertCircle, Loader } from 'lucide-react'

interface CustomerDetailView {
  customerId: string
  accountNumber: string
  name: string
  email: string
  phone: string
  serviceId: string
  planName: string
  planCode: string
  status: string
  createdAt: string
  lastPaymentDate?: string
  dueAmount: number
  lastInvoiceAmount: number
  lastPaymentStatus: string
  address: string
  city: string
  state: string
  pincode: string
  devices: any[]
  tickets: any[]
}

function mapCustomerDetail(item: any): CustomerDetailView {
  const address = item.address || {}
  const billingSnapshot = item.billingSnapshot || {}

  return {
    customerId: item.customerId,
    accountNumber: item.accountNumber || '-',
    name: item.fullName || item.customerId,
    email: item.email || '-',
    phone: item.phone || '-',
    serviceId: item.serviceId || '-',
    planName: item.planName || item.planCode || 'Unassigned',
    planCode: item.planCode || '-',
    status: item.operationalStatus || 'unknown',
    createdAt: item.createdAt,
    lastPaymentDate: billingSnapshot.lastPaidAt,
    dueAmount: Number(billingSnapshot.dueAmount || 0),
    lastInvoiceAmount: Number(billingSnapshot.lastInvoiceAmount || 0),
    lastPaymentStatus: billingSnapshot.lastPaymentStatus || 'unknown',
    address: [address.addressLine1, address.addressLine2, address.locality].filter(Boolean).join(', ') || 'No address available',
    city: address.city || '-',
    state: address.state || '-',
    pincode: address.pincode || '-',
    devices: Array.isArray(item.devices) ? item.devices : [],
    tickets: Array.isArray(item.tickets) ? item.tickets : [],
  }
}

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  const [customer, setCustomer] = useState<CustomerDetailView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadCustomer()
  }, [customerId])

  async function loadCustomer() {
    setIsLoading(true)
    try {
      const response = await apiClient.getCustomer(customerId)
      if (response.data.success && response.data.data) {
        setCustomer(mapCustomerDetail(response.data.data))
      }
    } catch (error) {
      toast.error('Failed to load customer')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCustomerAction(action: 'suspend' | 'resume' | 'retry') {
    setIsActionLoading(true)
    try {
      let response
      if (action === 'suspend') {
        response = await apiClient.suspendCustomer(customerId)
      } else if (action === 'resume') {
        response = await apiClient.resumeCustomer(customerId)
      } else {
        response = await apiClient.retryProvisioning(customerId)
      }

      if (response?.data.success) {
        toast.success(action === 'retry' ? 'Provisioning retry queued' : `Customer ${action} request queued`)
        setShowConfirm(null)
        loadCustomer()
      }
    } catch (error) {
      toast.error(`Failed to ${action} customer`)
      console.error(error)
    } finally {
      setIsActionLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading customer...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-muted-foreground mb-4">Customer not found</p>
        <button onClick={() => router.back()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground mt-1">Customer ID: {customer.customerId}</p>
          <p className="text-xs font-mono text-muted-foreground mt-1">Account: {customer.accountNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(customer.status)}`}>{customer.status}</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border p-6 bg-foreground/2.5">
          <h3 className="font-semibold mb-4 text-balance">Contact Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium">
                  {customer.city}, {customer.state}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-6 bg-foreground/2.5">
          <h3 className="font-semibold mb-4">Address</h3>
          <p className="text-sm mb-3">{customer.address}</p>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">PIN Code</p>
              <p className="font-medium">{customer.pincode}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service ID</p>
              <p className="font-medium">{customer.serviceId}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-lg border border-border p-6 bg-foreground/2.5">
          <h3 className="font-semibold mb-4 text-sm">Current Plan</h3>
          <p className="text-2xl font-bold mb-2">{customer.planName}</p>
          <p className="text-muted-foreground text-sm mb-4">{customer.planCode}</p>
          <p className={`text-xs px-2 py-1 rounded w-fit ${getStatusColor(customer.status)}`}>{customer.status}</p>
        </div>

        <div className="rounded-lg border border-border p-6 bg-foreground/2.5">
          <h3 className="font-semibold mb-4 text-sm">Billing Snapshot</h3>
          <div className="space-y-1 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Last Invoice</p>
              <p className="font-medium">{formatCurrency(customer.lastInvoiceAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Payment Status</p>
              <p className="font-medium capitalize">{customer.lastPaymentStatus}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border p-6 bg-foreground/2.5">
          <h3 className="font-semibold mb-4 text-sm">Account Balance</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Outstanding Due</p>
              <p className={`text-lg font-bold ${customer.dueAmount > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(customer.dueAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attached Devices</p>
              <p className="text-lg font-bold">{customer.devices.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-lg border border-border p-6 bg-foreground/2.5">
        <h3 className="font-semibold mb-4">Account Timeline</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="text-muted-foreground">Account Created</p>
              <p className="font-medium">{formatDate(customer.createdAt)}</p>
            </div>
          </div>
          {customer.lastPaymentDate && (
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="text-muted-foreground">Last Payment</p>
                <p className="font-medium">{formatDate(customer.lastPaymentDate)}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div className="text-sm">
              <p className="text-muted-foreground">Recent Tickets</p>
              <p className="font-medium">{customer.tickets.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-lg border border-border p-6 bg-foreground/2.5">
        <h3 className="font-semibold mb-4">Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {customer.status === 'active' ? (
            <button onClick={() => setShowConfirm('suspend')} disabled={isActionLoading} className="px-4 py-2 rounded-lg bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/30 text-sm font-medium disabled:opacity-50">
              {isActionLoading && showConfirm === 'suspend' ? 'Processing...' : 'Suspend'}
            </button>
          ) : (
            <button onClick={() => setShowConfirm('resume')} disabled={isActionLoading} className="px-4 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 text-sm font-medium disabled:opacity-50">
              {isActionLoading && showConfirm === 'resume' ? 'Processing...' : 'Resume'}
            </button>
          )}

          <button onClick={() => setShowConfirm('retry')} disabled={isActionLoading} className="px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 text-sm font-medium disabled:opacity-50">
            {isActionLoading && showConfirm === 'retry' ? 'Processing...' : 'Retry Provisioning'}
          </button>

          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 border border-border text-sm font-medium">
            Back
          </button>
        </div>

        {showConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-lg bg-red-600/10 border border-red-600/30">
            <p className="text-sm mb-3">
              Are you sure you want to <strong>{showConfirm}</strong> this customer?
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleCustomerAction(showConfirm as 'suspend' | 'resume' | 'retry')} disabled={isActionLoading} className="px-4 py-2 rounded text-sm font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-50">
                {isActionLoading ? 'Processing...' : 'Confirm'}
              </button>
              <button onClick={() => setShowConfirm(null)} disabled={isActionLoading} className="px-4 py-2 rounded text-sm font-medium bg-foreground/10 text-foreground hover:bg-foreground/20 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
