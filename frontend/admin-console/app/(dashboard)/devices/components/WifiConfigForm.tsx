'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Eye, EyeOff } from 'lucide-react'

interface WifiConfigFormProps {
  deviceId: string
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
  initialData?: {
    ssid24?: string
    ssid5?: string
    password?: string
  }
}

export function WifiConfigForm({
  deviceId,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  initialData,
}: WifiConfigFormProps) {
  const [formData, setFormData] = useState({
    ssid24: initialData?.ssid24 || 'JustFiber-24',
    ssid5: initialData?.ssid5 || 'JustFiber-5',
    password: initialData?.password || '',
    txPower24: '20',
    txPower5: '20',
    channel24: 'auto',
    channel5: 'auto',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    try {
      await onSave({
        ...formData,
        deviceId,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save WiFi configuration')
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
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background">
          <h2 className="text-lg font-semibold">WiFi Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-foreground/10 rounded" disabled={isLoading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">2.4GHz SSID</label>
              <input
                type="text"
                value={formData.ssid24}
                onChange={(e) => setFormData({ ...formData, ssid24: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">5GHz SSID</label>
              <input
                type="text"
                value={formData.ssid5}
                onChange={(e) => setFormData({ ...formData, ssid5: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">WiFi Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">2.4GHz TX Power (dBm)</label>
              <select
                value={formData.txPower24}
                onChange={(e) => setFormData({ ...formData, txPower24: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              >
                <option value="15">15 dBm</option>
                <option value="17">17 dBm</option>
                <option value="20">20 dBm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">5GHz TX Power (dBm)</label>
              <select
                value={formData.txPower5}
                onChange={(e) => setFormData({ ...formData, txPower5: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              >
                <option value="15">15 dBm</option>
                <option value="17">17 dBm</option>
                <option value="20">20 dBm</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">2.4GHz Channel</label>
              <select
                value={formData.channel24}
                onChange={(e) => setFormData({ ...formData, channel24: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              >
                <option value="auto">Auto</option>
                <option value="1">1</option>
                <option value="6">6</option>
                <option value="11">11</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">5GHz Channel</label>
              <select
                value={formData.channel5}
                onChange={(e) => setFormData({ ...formData, channel5: e.target.value })}
                disabled={isLoading}
                className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground disabled:opacity-50"
              >
                <option value="auto">Auto</option>
                <option value="36">36</option>
                <option value="40">40</option>
                <option value="44">44</option>
                <option value="48">48</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/20 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
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
