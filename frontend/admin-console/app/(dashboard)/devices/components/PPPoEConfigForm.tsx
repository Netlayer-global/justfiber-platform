'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, Eye, EyeOff } from 'lucide-react'

interface PPPoEConfigFormProps {
  deviceId: string
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
  initialData?: {
    username?: string
    password?: string
  }
}

export function PPPoEConfigForm({
  deviceId,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
  initialData,
}: PPPoEConfigFormProps) {
  const [formData, setFormData] = useState({
    username: initialData?.username || '',
    password: initialData?.password || '',
    enableNat: true,
    serviceName: '',
    acName: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.username || !formData.password) {
      setError('Username and password are required')
      return
    }

    try {
      await onSave({
        ...formData,
        deviceId,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save PPPoE configuration')
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
          <h2 className="text-lg font-semibold">PPPoE Configuration</h2>
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

          <div>
            <label className="block text-sm font-medium mb-2">Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="user@isp"
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password *</label>
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

          <div>
            <label className="block text-sm font-medium mb-2">Service Name</label>
            <input
              type="text"
              value={formData.serviceName}
              onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
              placeholder="(Optional)"
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">AC Name</label>
            <input
              type="text"
              value={formData.acName}
              onChange={(e) => setFormData({ ...formData, acName: e.target.value })}
              placeholder="(Optional)"
              disabled={isLoading}
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border text-foreground placeholder-muted-foreground disabled:opacity-50"
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-foreground/5">
            <input
              type="checkbox"
              id="enableNat"
              checked={formData.enableNat}
              onChange={(e) => setFormData({ ...formData, enableNat: e.target.checked })}
              disabled={isLoading}
              className="rounded"
            />
            <label htmlFor="enableNat" className="text-sm font-medium cursor-pointer">
              Enable NAT
            </label>
          </div>

          <div className="bg-blue-600/10 border border-blue-600/30 rounded-lg p-3 text-xs text-blue-400">
            <p className="font-semibold mb-1">PPPoE Credentials</p>
            <p>These will be configured on the device to establish connection with the ISP.</p>
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
