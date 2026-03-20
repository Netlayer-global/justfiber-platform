'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, AlertCircle } from 'lucide-react'
import { Invoice } from '@/lib/types'

interface InvoiceFormProps {
  invoice?: Invoice
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
}

export function InvoiceForm({
  invoice,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    customerId: invoice?.customerId || '',
    amount: invoice?.amount || 0,
    dueDate: invoice?.dueDate || '',
    description: '',
    paymentTerms: '30',
  })

  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.customerId || formData.amount <= 0 || !formData.dueDate) {
      setError('Please fill all required fields')
      return
    }

    try {
      await onSave(formData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save invoice')
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-border rounded-lg max-w-md w-full max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
          <h2 className="text-lg font-semibold">{invoice ? 'Edit Invoice' : 'Create Invoice'}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-foreground/10 rounded transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex gap-3 p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Customer ID *</label>
            <input
              type="text"
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              placeholder="CUST-001"
              disabled={!!invoice || isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              placeholder="0.00"
              min="0"
              step="0.01"
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Due Date *</label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
            >
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="45">45 days</option>
              <option value="60">60 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Invoice description..."
              rows={3}
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
