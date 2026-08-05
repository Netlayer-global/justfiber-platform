'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { AdminUserSummary, AdminRoleSummary } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Users, Shield, UserX, Lock, Plus, Key, RefreshCw, Edit2 } from 'lucide-react'

export default function StaffPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [roles, setRoles] = useState<AdminRoleSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Selected user for password reset
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null)

  // Form states
  const [newPassword, setNewPassword] = useState('')
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    zoneCode: '',
    canAccessAllZones: false
  })

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [userRes, roleRes] = await Promise.all([
        adminAPI.getAdminUsers(1, 100),
        adminAPI.getAdminRoles()
      ])

      if (userRes.success && userRes.data?.items) {
        setUsers(userRes.data.items)
      }
      if (roleRes.success && roleRes.data) {
        setRoles(roleRes.data)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load staff list')
    } finally {
      setLoading(false)
    }
  }

  // Filter users
  const filteredUsers = users.filter((u) => {
    const q = query.toLowerCase()
    const matchesQuery =
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)

    const matchesStatus = !statusFilter || u.status === statusFilter

    return matchesQuery && matchesStatus
  })

  // Stats
  const activeCount = users.filter((u) => u.status === 'active').length
  const disabledCount = users.filter((u) => u.status === 'disabled').length
  const lockedCount = users.filter((u) => u.status === 'locked').length

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!newUser.role) {
      toast.error('Please assign at least one role')
      return
    }
    setSaving(true)
    try {
      const res = await adminAPI.createAdminUser({
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email || undefined,
        password: newUser.password,
        phone: newUser.phone || undefined,
        roles: [newUser.role],
        zoneCode: newUser.zoneCode || undefined,
        canAccessAllZones: newUser.canAccessAllZones
      })

      if (res.success) {
        toast.success('Staff user created successfully')
        setAddModalOpen(false)
        setNewUser({
          username: '',
          fullName: '',
          email: '',
          password: '',
          phone: '',
          role: '',
          zoneCode: '',
          canAccessAllZones: false
        })
        await load()
      } else {
        toast.error(res.error || 'Failed to create user')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error creating user')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser?.id || !newPassword) return
    setSaving(true)
    try {
      const res = await adminAPI.resetAdminUserPassword(selectedUser.id, newPassword)
      if (res.success) {
        toast.success(`Password reset for ${selectedUser.username}`)
        setResetModalOpen(false)
        setNewPassword('')
        setSelectedUser(null)
      } else {
        toast.error(res.error || 'Failed to reset password')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error resetting password')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(user: AdminUserSummary, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active'
    try {
      const res = await adminAPI.updateAdminUserStatus(user.id, nextStatus)
      if (res.success) {
        toast.success(`Status updated for ${user.username}`)
        await load()
      } else {
        toast.error(res.error || 'Failed to update status')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error updating status')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Accounts"
        description="Manage admin logins, designate organizational roles, and configure system permissions."
        eyebrow="Administration"
        actions={
          <Button variant="primary" onClick={() => setAddModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Add Staff Member
          </Button>
        }
      />

      {/* Metric Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Staff" value={users.length} icon={Users} iconColor="purple" />
        <StatCard label="Active Accounts" value={activeCount} icon={Shield} iconColor="emerald" />
        <StatCard label="Disabled Accounts" value={disabledCount} icon={UserX} iconColor="amber" />
        <StatCard label="Locked Accounts" value={lockedCount} icon={Lock} iconColor="rose" />
      </div>

      {/* Query Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search staff by name, username or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-48">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="locked">Locked</option>
          </Select>
        </div>
        <Button variant="ghost" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>
          Reload
        </Button>
      </div>

      {/* Staff List Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            No staff records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="p-4">User</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Zone Access</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/30">
                    <td className="p-4">
                      <div className="font-semibold text-zinc-100">{u.fullName}</div>
                      <div className="font-mono text-xs text-zinc-500">@{u.username}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-zinc-300">{u.email}</div>
                      <div className="text-xs text-zinc-500">{u.phone || 'No phone'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles?.map((r) => (
                          <Badge key={r} variant="brand">
                            {r.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      {u.canAccessAllZones ? (
                        <span className="text-xs text-emerald-400 font-semibold">ALL ZONES</span>
                      ) : (
                        <span className="text-xs text-zinc-300">{u.zoneName || u.zoneCode || 'HQ'}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        u.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : u.status === 'disabled'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          u.status === 'active'
                            ? 'bg-emerald-400'
                            : u.status === 'disabled'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`} />
                        {u.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(u)
                          setResetModalOpen(true)
                        }}
                        icon={<Key className="h-3.5 w-3.5 text-amber-500" />}
                      >
                        Reset PW
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleToggleStatus(u, u.status)}
                        icon={<Edit2 className="h-3.5 w-3.5 text-zinc-400" />}
                      >
                        {u.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Staff Member"
        description="Onboard a new employee/administrator account with secure credentials."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleAddUser(e)} loading={saving}>
              Create Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Username"
              placeholder="e.g. johndoe"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              required
            />
            <Input
              label="Full Name"
              placeholder="e.g. John Doe"
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              required
            />
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. john@netlayer.in"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            />
            <Input
              label="Secure Password"
              type="password"
              placeholder="Minimum 8 characters"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              placeholder="e.g. 9876543210"
              value={newUser.phone}
              onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            />
            <Select
              label="Designated Role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              required
            >
              <option value="">Select a role...</option>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name || r.code.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="allZones"
              checked={newUser.canAccessAllZones}
              onChange={(e) => setNewUser({ ...newUser, canAccessAllZones: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
            />
            <label htmlFor="allZones" className="text-sm font-medium text-zinc-300">
              Grant Global access to all Sub-Zones / Franchises
            </label>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset Staff Password"
        description={`Set a new secure password for account @${selectedUser?.username || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleResetPassword(e)} loading={saving}>
              Reset Password
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <Input
            label="New Secure Password"
            type="password"
            placeholder="Minimum 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  )
}
