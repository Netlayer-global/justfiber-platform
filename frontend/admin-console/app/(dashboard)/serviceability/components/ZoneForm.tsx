'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Trash2 } from 'lucide-react'

interface ZoneFormProps {
  zone?: any
  onClose: () => void
  onSave: (data: any) => void
  areaTypeConfig: Record<string, { label: string }>
}

export default function ZoneForm({ zone, onClose, onSave, areaTypeConfig }: ZoneFormProps) {
  const [formData, setFormData] = useState({
    zoneName: zone?.zoneName || '',
    city: zone?.city || '',
    state: zone?.state || '',
    areaType: zone?.areaType || 'active_service',
    technologyType: zone?.technologyType || 'fiber',
    status: zone?.status || 'active',
    priority: zone?.priority || 1,
    notes: zone?.notes || '',
    pinCodes: zone?.pinCodes || [],
    subZone: zone?.subZone || '',
    franchiseCode: zone?.franchiseCode || '',
  })

  const [pinCodeInput, setPinCodeInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddPinCode = () => {
    if (pinCodeInput && !formData.pinCodes.includes(pinCodeInput)) {
      setFormData({
        ...formData,
        pinCodes: [...formData.pinCodes, pinCodeInput],
      })
      setPinCodeInput('')
    }
  }

  const handleRemovePinCode = (pinCode: string) => {
    setFormData({
      ...formData,
      pinCodes: formData.pinCodes.filter((p: string) => p !== pinCode),
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSave(formData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end"
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full max-w-2xl bg-card border-t border-border rounded-t-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{zone ? 'Edit Zone' : 'Create Serviceability Zone'}</h2>
            <p className="text-sm text-muted-foreground mt-1">Define service coverage area boundaries and attributes</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">1</span>
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Zone Name</label>
                <input
                  type="text"
                  value={formData.zoneName}
                  onChange={(e) => setFormData({ ...formData, zoneName: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Downtown Core"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Area Type</label>
                <select
                  value={formData.areaType}
                  onChange={(e) => setFormData({ ...formData, areaType: e.target.value })}
                  className="input-field"
                >
                  {Object.entries(areaTypeConfig).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Lagos"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Lagos State"
                />
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">2</span>
              Technical Details
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Technology</label>
                <select
                  value={formData.technologyType}
                  onChange={(e) => setFormData({ ...formData, technologyType: e.target.value })}
                  className="input-field"
                >
                  <option value="fiber">Fiber</option>
                  <option value="wireless">Wireless</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input-field"
                >
                  <option value="active">Active</option>
                  <option value="planned">Planned</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Priority</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Service Areas */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">3</span>
              PIN Code Coverage
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={pinCodeInput}
                onChange={(e) => setPinCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPinCode()
                    e.preventDefault()
                  }
                }}
                className="input-field flex-1"
                placeholder="Enter PIN code and press Enter"
              />
              <button
                onClick={handleAddPinCode}
                className="btn-secondary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {formData.pinCodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.pinCodes.map((pinCode: string) => (
                  <div
                    key={pinCode}
                    className="px-3 py-1.5 rounded bg-primary/20 text-primary text-sm font-medium flex items-center gap-2"
                  >
                    {pinCode}
                    <button
                      onClick={() => handleRemovePinCode(pinCode)}
                      className="hover:bg-primary/30 rounded p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs">4</span>
              Additional Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Sub-Zone (Optional)</label>
                <input
                  type="text"
                  value={formData.subZone}
                  onChange={(e) => setFormData({ ...formData, subZone: e.target.value })}
                  className="input-field"
                  placeholder="Sub-zone identifier"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Franchise Code (Optional)</label>
                <input
                  type="text"
                  value={formData.franchiseCode}
                  onChange={(e) => setFormData({ ...formData, franchiseCode: e.target.value })}
                  className="input-field"
                  placeholder="Franchise identifier"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field resize-none"
                rows={3}
                placeholder="Additional notes about this zone..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="btn-ghost px-6"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.zoneName}
            className="btn-primary px-6 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : zone ? 'Update Zone' : 'Create Zone'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
