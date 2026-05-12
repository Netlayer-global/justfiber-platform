'use client'

import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface CashCollectionSectionProps {
  customer: Customer
}

export function CashCollectionSection({ customer }: CashCollectionSectionProps) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const outstanding = Number(
    (customer.invoiceSummary as any)?.dueAmount ??
    (customer.billingSnapshot as any)?.dueAmount ??
    0
  )
  const numAmount = parseFloat(amount) || 0
  const amountValid = numAmount >= 1 && numAmount <= outstanding
  const hasJazeUser = Boolean(customer.jazeUserId)
  const isValid = amountValid && hasJazeUser

  function getAmountError(): string | undefined {
    if (!amount) return undefined
    if (numAmount < 1) return 'Amount must be at least ₹1'
    if (numAmount > outstanding) return `Amount cannot exceed outstanding (${formatCurrency(outstanding)})`
    return undefined
  }

  function getNotesHint(): string {
    return `${notes.length}/500 characters`
  }

  return (
    <Card padding="none">
      <CardHeader>
        <CardTitle>Collect Cash Payment</CardTitle>
      </CardHeader>
      <div className="p-5 space-y-4">
        {/* Customer info summary */}
        <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold text-slate-900">{customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Outstanding</span>
            <span className="font-semibold text-slate-900">{formatCurrency(outstanding)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Jaze ID</span>
            <span className="font-mono text-slate-700">
              {customer.jazeUserId || <span className="text-rose-500 font-normal">Not linked</span>}
            </span>
          </div>
        </div>

        {!hasJazeUser && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Cash collection is unavailable — this customer has no linked Jaze account. Activate via an installer first.
          </div>
        )}

        {/* Amount input */}
        <Input
          label="Amount (₹)"
          type="number"
          name="cash-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
          max={outstanding}
          step="0.01"
          placeholder={outstanding > 0 ? `1 – ${outstanding.toFixed(2)}` : '0.00'}
          error={getAmountError()}
          disabled={!hasJazeUser || outstanding <= 0}
        />

        {/* Notes textarea */}
        <Textarea
          label="Notes (optional)"
          name="cash-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          maxLength={500}
          placeholder="Receipt #, collector name, or other context..."
          hint={getNotesHint()}
          disabled={!hasJazeUser}
        />

        {/* Submit button */}
        <Button
          variant="primary"
          disabled={!isValid || loading}
          onClick={() => setShowConfirm(true)}
          icon={<Banknote className="h-4 w-4" />}
        >
          {loading ? 'Processing...' : 'Collect Cash'}
        </Button>

        {/* Result feedback */}
        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {result.message}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Cash Collection"
        description="Please review the details below before recording this payment."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} loading={loading}>
              Confirm Payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold text-slate-900">{customer.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Amount</span>
            <span className="font-semibold text-slate-900">{formatCurrency(numAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Payment Method</span>
            <span className="font-semibold text-slate-900">Cash</span>
          </div>
          {notes && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Notes</span>
              <span className="text-slate-700 text-right max-w-[60%]">{notes}</span>
            </div>
          )}
        </div>
      </Modal>
    </Card>
  )

  async function handleSubmit() {
    if (!isValid || !customer.customerId) return
    setLoading(true)
    setResult(null)
    try {
      const res = await adminAPI.collectCashPayment({
        customerId: customer.customerId,
        amount: numAmount,
        method: 'cash',
        notes: notes || undefined,
      })
      if (res.success && res.data) {
        setResult({
          success: true,
          message: `Payment recorded. TXN: ${res.data.transactionId || '—'} · Amount: ${formatCurrency(res.data.amount)} · Method: ${res.data.method}`,
        })
        setAmount('')
        setNotes('')
      } else {
        setResult({
          success: false,
          message: (typeof res.error === 'string' ? res.error : null) || 'Payment failed. Please try again.',
        })
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }
}
