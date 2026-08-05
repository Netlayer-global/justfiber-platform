'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { BngNode, IpPoolRange } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Trash2, CheckCircle, XCircle, RefreshCw, Plus } from 'lucide-react'

type SubTab = 'bng' | 'pools'

export default function RadiusManagerPage() {
  const [activeTab, setActiveTab] = useState<SubTab>('bng')
  const [bngNodes, setBngNodes] = useState<BngNode[]>([])
  const [ipPools, setIpPools] = useState<IpPoolRange[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modals
  const [bngModalOpen, setBngModalOpen] = useState(false)
  const [poolModalOpen, setPoolModalOpen] = useState(false)

  // Form states
  const [bngForm, setBngForm] = useState({
    nodeCode: '',
    displayName: '',
    description: '',
    radiusClientIp: '',
    additionalRadiusClientIps: '',
    useCoa: true,
    coaHost: '',
    coaPort: 3799,
    coaSecret: '',
    managementIp: '',
    routerOsUsername: '',
    routerOsPassword: '',
    apiPort: 8728,
    vendor: 'mikrotik',
  })

  const [poolForm, setPoolForm] = useState({
    name: '',
    startIp: '',
    endIp: '',
    networkCidr: '',
    type: 'public' as 'public' | 'private',
    format: 'range' as 'range' | 'cidr',
    zone: 'default',
  })

  useEffect(() => {
    void loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'bng') {
        const res = await adminAPI.getBngNodes()
        if (res.success && res.data) setBngNodes(res.data)
      } else {
        const res = await adminAPI.getIpPools()
        if (res.success && res.data) setIpPools(res.data)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load RADIUS configuration')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveBng(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('save-bng')
    try {
      const payload = {
        nodeCode: bngForm.nodeCode,
        displayName: bngForm.displayName,
        notes: bngForm.description,
        radiusClientIp: bngForm.radiusClientIp,
        coaPort: bngForm.coaPort,
        coaSecret: bngForm.coaSecret || undefined,
        coaHost: bngForm.coaHost || undefined,
        useCoa: bngForm.useCoa,
        managementIp: bngForm.managementIp || undefined,
        routerOsUsername: bngForm.routerOsUsername || undefined,
        routerOsPassword: bngForm.routerOsPassword || undefined,
        apiPort: bngForm.apiPort || 8728,
        vendor: bngForm.vendor as 'mikrotik' | 'juniper' | 'huawei' | 'other',
        status: 'active' as const,
        additionalRadiusClientIps: bngForm.additionalRadiusClientIps
          ? bngForm.additionalRadiusClientIps.split(',').map((x) => x.trim()).filter(Boolean)
          : [],
      }
      const res = await adminAPI.saveBngNode(payload)
      if (res.success) {
        toast.success('BNG Node saved successfully')
        setBngModalOpen(false)
        setBngForm({
          nodeCode: '',
          displayName: '',
          description: '',
          radiusClientIp: '',
          additionalRadiusClientIps: '',
          useCoa: true,
          coaHost: '',
          coaPort: 3799,
          coaSecret: '',
          managementIp: '',
          routerOsUsername: '',
          routerOsPassword: '',
          apiPort: 8728,
          vendor: 'mikrotik',
        })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save BNG node')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving BNG node')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSavePool(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('save-pool')
    try {
      const payload = {
        name: poolForm.name,
        type: poolForm.type,
        format: poolForm.format,
        ipFrom: poolForm.format === 'range' ? poolForm.startIp : undefined,
        ipTo: poolForm.format === 'range' ? poolForm.endIp : undefined,
        networkCidr: poolForm.format === 'cidr' ? poolForm.networkCidr : undefined,
        zone: poolForm.zone || 'default',
        active: true,
      }
      const res = await adminAPI.saveIpPool(payload)
      if (res.success) {
        toast.success('IP Pool saved successfully')
        setPoolModalOpen(false)
        setPoolForm({
          name: '',
          startIp: '',
          endIp: '',
          networkCidr: '',
          type: 'public',
          format: 'range',
          zone: 'default',
        })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save IP pool')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving IP pool')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleTestBng(nodeCode: string) {
    setActionLoading(`test-${nodeCode}`)
    try {
      const res = await adminAPI.testBngNode(nodeCode)
      if (res.success && (res.data?.checks?.coa?.ok || res.data?.checks?.api?.ok)) {
        toast.success(`BNG ${nodeCode} online and operational.`)
      } else {
        toast.error(`BNG ${nodeCode} test failed: ${res.data?.checks?.coa?.reason || res.data?.checks?.api?.reason || 'unreachable'}`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Network connection test failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSyncBng(nodeCode: string) {
    setActionLoading(`sync-${nodeCode}`)
    try {
      const res = await adminAPI.syncBngNodeFreeradius(nodeCode)
      if (res.success) {
        toast.success(`FreeRADIUS client sync triggered for BNG ${nodeCode}`)
        await loadData()
      } else {
        toast.error(res.error || 'Sync failed')
      }
    } catch (e) {
      console.error(e)
      toast.error('FreeRADIUS sync request failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteBng(nodeCode: string) {
    if (!confirm('Are you sure you want to delete this BNG node?')) return
    setActionLoading(`delete-bng-${nodeCode}`)
    try {
      const res = await adminAPI.deleteBngNode(nodeCode)
      if (res.success) {
        toast.success('BNG node deleted')
        await loadData()
      } else {
        toast.error(res.error || 'Failed to delete BNG node')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error deleting BNG node')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeletePool(poolId: string) {
    if (!confirm('Are you sure you want to delete this IP Pool?')) return
    setActionLoading(`delete-pool-${poolId}`)
    try {
      const res = await adminAPI.deleteIpPool(poolId)
      if (res.success) {
        toast.success('IP pool deleted')
        await loadData()
      } else {
        toast.error(res.error || 'Failed to delete IP pool')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error deleting IP pool')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RADIUS & Subnet Manager"
        description="Provision BNG (Broadband Network Gateway) nodes, register NAS clients, and partition IP address pools."
        eyebrow="Network"
        actions={
          activeTab === 'bng' ? (
            <Button variant="primary" onClick={() => setBngModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add BNG Node
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setPoolModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add IP Pool
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('bng')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'bng'
              ? 'border-purple-600 text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-100'
          }`}
        >
          Routers & BNG Nodes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pools')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'pools'
              ? 'border-purple-600 text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-100'
          }`}
        >
          IP Address Pools
        </button>
      </div>

      {/* Main Content Card */}
      <div className="card p-6">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading RADIUS topology...</p>
          </div>
        ) : activeTab === 'bng' ? (
          /* BNG Nodes List */
          bngNodes.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              No BNG / NAS routers registered. Onboard a router to begin accepting PPPoE sessions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4">BNG Router</th>
                    <th className="p-4">RADIUS IP</th>
                    <th className="p-4">COA Port</th>
                    <th className="p-4">Sync Status</th>
                    <th className="p-4 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {bngNodes.map((node) => (
                    <tr key={node.nodeCode} className="hover:bg-zinc-900/20">
                      <td className="p-4">
                        <div className="font-semibold text-zinc-100">{node.displayName}</div>
                        <div className="font-mono text-xs text-zinc-500">{node.nodeCode}</div>
                      </td>
                      <td className="p-4 font-mono text-zinc-300">
                        {node.radiusClientIp}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">{node.coaPort || 3799}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          node.freeradiusClientSync?.synced
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {node.freeradiusClientSync?.synced ? (
                            <>
                              <CheckCircle className="h-3 w-3" /> Synced
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" /> Pending Sync
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleTestBng(node.nodeCode)}
                          loading={actionLoading === `test-${node.nodeCode}`}
                        >
                          Ping Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleSyncBng(node.nodeCode)}
                          loading={actionLoading === `sync-${node.nodeCode}`}
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                        >
                          Sync RADIUS
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteBng(node.nodeCode)}
                          loading={actionLoading === `delete-bng-${node.nodeCode}`}
                          icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* IP Pools list */
          ipPools.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              No IP pools partitioned. Create a pool to allocate IP subnets dynamically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4">IP Pool</th>
                    <th className="p-4">Subnet Details</th>
                    <th className="p-4">Format</th>
                    <th className="p-4">Zone</th>
                    <th className="p-4 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {ipPools.map((pool) => (
                    <tr key={pool.id} className="hover:bg-zinc-900/20">
                      <td className="p-4">
                        <div className="font-semibold text-zinc-100">{pool.name}</div>
                        <div className="font-mono text-xs text-zinc-500">{pool.id}</div>
                      </td>
                      <td className="p-4 font-mono text-zinc-300">
                        {pool.format === 'range' ? `${pool.ipFrom} — ${pool.ipTo}` : pool.networkCidr}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">{pool.format?.toUpperCase()}</td>
                      <td className="p-4 text-zinc-400">{pool.zone || '—'}</td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeletePool(pool.id)}
                          loading={actionLoading === `delete-pool-${pool.id}`}
                          icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Add BNG Modal */}
      <Modal
        open={bngModalOpen}
        onClose={() => setBngModalOpen(false)}
        title="Register BNG Router / NAS"
        description="Register a Broadband Network Gateway router to push FreeRADIUS configurations."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBngModalOpen(false)} disabled={actionLoading === 'save-bng'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleSaveBng(e)} loading={actionLoading === 'save-bng'}>
              Add BNG Node
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveBng} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="BNG Code"
              placeholder="e.g. DEL-BNG-01"
              value={bngForm.nodeCode}
              onChange={(e) => setBngForm({ ...bngForm, nodeCode: e.target.value })}
              required
            />
            <Input
              label="Router Display Name"
              placeholder="e.g. Okhla Gateway"
              value={bngForm.displayName}
              onChange={(e) => setBngForm({ ...bngForm, displayName: e.target.value })}
              required
            />
            <Select
              label="Hardware Vendor"
              value={bngForm.vendor}
              onChange={(e) => setBngForm({ ...bngForm, vendor: e.target.value })}
            >
              <option value="mikrotik">MikroTik RouterOS</option>
              <option value="juniper">Juniper JunOS</option>
              <option value="huawei">Huawei VRP</option>
              <option value="other">Generic / Other</option>
            </Select>
            <Input
              label="RADIUS Client IP Address"
              placeholder="e.g. 10.50.0.1"
              value={bngForm.radiusClientIp}
              onChange={(e) => setBngForm({ ...bngForm, radiusClientIp: e.target.value })}
              required
            />
            <Input
              label="Additional RADIUS IPs (comma-separated)"
              placeholder="e.g. 10.50.0.2, 10.50.0.3"
              value={bngForm.additionalRadiusClientIps}
              onChange={(e) => setBngForm({ ...bngForm, additionalRadiusClientIps: e.target.value })}
            />
            <Select
              label="Enable RADIUS CoA"
              value={bngForm.useCoa ? "true" : "false"}
              onChange={(e) => setBngForm({ ...bngForm, useCoa: e.target.value === "true" })}
            >
              <option value="true">Yes, enable CoA</option>
              <option value="false">No, disable CoA</option>
            </Select>
            {bngForm.useCoa && (
              <>
                <Input
                  label="CoA Host IP (optional)"
                  placeholder="Defaults to RADIUS Client IP"
                  value={bngForm.coaHost}
                  onChange={(e) => setBngForm({ ...bngForm, coaHost: e.target.value })}
                />
                <Input
                  label="CoA Port"
                  type="number"
                  placeholder="e.g. 3799"
                  value={bngForm.coaPort}
                  onChange={(e) => setBngForm({ ...bngForm, coaPort: parseInt(e.target.value) || 3799 })}
                  required
                />
                <Input
                  label="CoA Secret / Shared Key"
                  placeholder="Shared secret for disconnects"
                  type="password"
                  value={bngForm.coaSecret}
                  onChange={(e) => setBngForm({ ...bngForm, coaSecret: e.target.value })}
                  required={bngForm.useCoa}
                />
              </>
            )}
            <Input
              label="Management IP / API Host"
              placeholder="e.g. 192.168.10.2"
              value={bngForm.managementIp}
              onChange={(e) => setBngForm({ ...bngForm, managementIp: e.target.value })}
            />
            <Input
              label="API Port"
              type="number"
              placeholder="e.g. 8728"
              value={bngForm.apiPort}
              onChange={(e) => setBngForm({ ...bngForm, apiPort: parseInt(e.target.value) || 8728 })}
            />
            <Input
              label="Router Username"
              placeholder="API / RouterOS User"
              value={bngForm.routerOsUsername}
              onChange={(e) => setBngForm({ ...bngForm, routerOsUsername: e.target.value })}
            />
            <Input
              label="Router Password"
              placeholder="API / RouterOS Password"
              type="password"
              value={bngForm.routerOsPassword}
              onChange={(e) => setBngForm({ ...bngForm, routerOsPassword: e.target.value })}
            />
          </div>
          <Input
            label="Location Description & Notes"
            placeholder="Notes regarding this router deployment"
            value={bngForm.description}
            onChange={(e) => setBngForm({ ...bngForm, description: e.target.value })}
          />
        </form>
      </Modal>

      {/* Add IP Pool Modal */}
      <Modal
        open={poolModalOpen}
        onClose={() => setPoolModalOpen(false)}
        title="Partition IP Subnet Pool"
        description="Configure a new IP address range for DHCP or static allocation."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPoolModalOpen(false)} disabled={actionLoading === 'save-pool'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleSavePool(e)} loading={actionLoading === 'save-pool'}>
              Create IP Pool
            </Button>
          </>
        }
      >
        <form onSubmit={handleSavePool} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Pool Display Name"
              placeholder="e.g. Okhla Customers Subnet"
              value={poolForm.name}
              onChange={(e) => setPoolForm({ ...poolForm, name: e.target.value })}
              required
            />
            <Select
              label="Pool Type"
              value={poolForm.type}
              onChange={(e) => setPoolForm({ ...poolForm, type: e.target.value as 'public' | 'private' })}
            >
              <option value="public">Public Subnet</option>
              <option value="private">Private (CGNAT) Subnet</option>
            </Select>
            <Select
              label="IP Format"
              value={poolForm.format}
              onChange={(e) => setPoolForm({ ...poolForm, format: e.target.value as 'range' | 'cidr' })}
            >
              <option value="range">Range (Start IP - End IP)</option>
              <option value="cidr">CIDR (e.g. 10.0.0.0/24)</option>
            </Select>
            {poolForm.format === 'range' ? (
              <>
                <Input
                  label="Subnet Start IP"
                  placeholder="e.g. 172.16.10.10"
                  value={poolForm.startIp}
                  onChange={(e) => setPoolForm({ ...poolForm, startIp: e.target.value })}
                  required
                />
                <Input
                  label="Subnet End IP"
                  placeholder="e.g. 172.16.10.250"
                  value={poolForm.endIp}
                  onChange={(e) => setPoolForm({ ...poolForm, endIp: e.target.value })}
                  required
                />
              </>
            ) : (
              <Input
                label="CIDR Network Block"
                placeholder="e.g. 172.16.10.0/24"
                value={poolForm.networkCidr}
                onChange={(e) => setPoolForm({ ...poolForm, networkCidr: e.target.value })}
                required
              />
            )}
            <Input
              label="Sub-Zone Code"
              placeholder="e.g. default"
              value={poolForm.zone}
              onChange={(e) => setPoolForm({ ...poolForm, zone: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
