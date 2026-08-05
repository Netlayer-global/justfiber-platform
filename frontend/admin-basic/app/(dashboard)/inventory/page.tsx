'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Package,
  Warehouse,
  Truck,
  Plus,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Move,
  Tag
} from 'lucide-react'

type TabType = 'overview' | 'items' | 'locations' | 'vendors'

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Data States
  const [overview, setOverview] = useState({
    locations: 0,
    vendors: 0,
    totalItems: 0,
    inStock: 0,
    assigned: 0,
    installed: 0,
    faulty: 0,
  })
  const [locations, setLocations] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  // Search/Filters
  const [itemQuery, setItemQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  // Modals
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [locModalOpen, setLocModalOpen] = useState(false)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)

  // Selected item for movement
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  // Forms
  const [itemForm, setItemForm] = useState({
    itemCode: '',
    serialNumber: '',
    macAddress: '',
    category: 'ont',
    brand: '',
    model: '',
    locationCode: 'default',
    status: 'in_stock',
    purchasePrice: 0,
    warrantyExpiryDate: '',
  })

  const [locForm, setLocForm] = useState({
    locationCode: '',
    name: '',
    locationType: 'warehouse',
    address: '',
  })

  const [vendorForm, setVendorForm] = useState({
    vendorCode: '',
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
  })

  const [moveForm, setMoveForm] = useState({
    toLocationCode: '',
    note: '',
  })

  useEffect(() => {
    void loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    try {
      if (activeTab === 'overview') {
        const res = await adminAPI.getInventoryOverview()
        if (res.success && res.data) setOverview(res.data)
      } else if (activeTab === 'locations') {
        const res = await adminAPI.getInventoryLocations()
        if (res.success && res.data) setLocations(res.data)
      } else if (activeTab === 'vendors') {
        const res = await adminAPI.getVendors()
        if (res.success && res.data) setVendors(res.data)
      } else if (activeTab === 'items') {
        const [itemsRes, locsRes] = await Promise.all([
          adminAPI.getInventoryItems(1, 100, {
            category: categoryFilter || undefined,
            status: statusFilter || undefined,
            locationCode: locationFilter || undefined,
          }),
          adminAPI.getInventoryLocations(),
        ])
        if (itemsRes.success && itemsRes.data) setItems(itemsRes.data)
        if (locsRes.success && locsRes.data) setLocations(locsRes.data)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to load inventory logs')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('create-item')
    try {
      const res = await adminAPI.createInventoryItem(itemForm)
      if (res.success) {
        toast.success('Inventory item registered')
        setItemModalOpen(false)
        setItemForm({
          itemCode: '',
          serialNumber: '',
          macAddress: '',
          category: 'ont',
          brand: '',
          model: '',
          locationCode: 'default',
          status: 'in_stock',
          purchasePrice: 0,
          warrantyExpiryDate: '',
        })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save item')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving inventory item')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('create-loc')
    try {
      const res = await adminAPI.createInventoryLocation(locForm)
      if (res.success) {
        toast.success('Inventory location registered')
        setLocModalOpen(false)
        setLocForm({
          locationCode: '',
          name: '',
          locationType: 'warehouse',
          address: '',
        })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save location')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving location')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateVendor(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('create-vendor')
    try {
      const res = await adminAPI.createVendor(vendorForm)
      if (res.success) {
        toast.success('Vendor profile created')
        setVendorModalOpen(false)
        setVendorForm({
          vendorCode: '',
          name: '',
          contactPerson: '',
          email: '',
          phone: '',
        })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save vendor')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving vendor')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMoveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedItem?.itemCode) return
    setActionLoading('move-item')
    try {
      const res = await adminAPI.moveInventoryItem(selectedItem.itemCode, moveForm.toLocationCode, moveForm.note)
      if (res.success) {
        toast.success('Item dispatched/moved successfully')
        setMoveModalOpen(false)
        setSelectedItem(null)
        setMoveForm({ toLocationCode: '', note: '' })
        await loadData()
      } else {
        toast.error(res.error || 'Failed to move item')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error moving item')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Assets"
        description="Track physical hardware stock, allocate ONUs to client lines, and coordinate logistics warehouse movement."
        eyebrow="Operations"
        actions={
          activeTab === 'items' ? (
            <Button variant="primary" onClick={() => setItemModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add Item
            </Button>
          ) : activeTab === 'locations' ? (
            <Button variant="primary" onClick={() => setLocModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add Warehouse/Vehicle
            </Button>
          ) : activeTab === 'vendors' ? (
            <Button variant="primary" onClick={() => setVendorModalOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Add Vendor
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-4">
        <TabHeader active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
        <TabHeader active={activeTab === 'items'} onClick={() => setActiveTab('items')} label="Stock Inventory" />
        <TabHeader active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} label="Warehouses & Vehicles" />
        <TabHeader active={activeTab === 'vendors'} onClick={() => setActiveTab('vendors')} label="Vendors" />
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
          <p className="mt-2 text-sm text-zinc-500">Loading asset logs...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Registered Items" value={overview.totalItems} icon={Package} iconColor="purple" />
                <StatCard label="In Stock (Warehouse)" value={overview.inStock} icon={Warehouse} iconColor="emerald" />
                <StatCard label="Assigned (Technicians)" value={overview.assigned} icon={Truck} iconColor="amber" />
                <StatCard label="Faulty / Defective" value={overview.faulty} icon={AlertTriangle} iconColor="rose" />
              </div>

              {/* Quick Info Alerts */}
              <div className="card p-6 grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" /> Stock Status Distribution
                  </h3>
                  <div className="mt-4 space-y-3">
                    <ProgressBar label="In Stock" count={overview.inStock} total={overview.totalItems} color="bg-emerald-500" />
                    <ProgressBar label="Assigned to Field" count={overview.assigned} total={overview.totalItems} color="bg-amber-500" />
                    <ProgressBar label="Installed at Client" count={overview.installed} total={overview.totalItems} color="bg-purple-500" />
                    <ProgressBar label="Faulty" count={overview.faulty} total={overview.totalItems} color="bg-rose-500" />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300">Quick Inventory Stats</h3>
                    <p className="text-xs text-zinc-500 mt-1">Summary of supply locations and vendors.</p>
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Warehouses / Vehicles</span>
                        <span className="font-semibold text-zinc-100">{overview.locations}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Registered Vendors</span>
                        <span className="font-semibold text-zinc-100">{overview.vendors}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setActiveTab('items')} icon={<ArrowRight className="h-4 w-4" />}>
                    Manage Stock Inventory
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Item Query & Filters */}
              <div className="card p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search serial number, item code, brand..."
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-40">
                  <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); void loadData(); }}>
                    <option value="">All Categories</option>
                    <option value="ont">ONT / ONU</option>
                    <option value="router">WiFi Router</option>
                    <option value="splitter">Splitter</option>
                    <option value="cable">Cable Spool</option>
                    <option value="accessory">Accessory</option>
                  </Select>
                </div>
                <div className="w-full md:w-40">
                  <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); void loadData(); }}>
                    <option value="">All Statuses</option>
                    <option value="in_stock">In Stock</option>
                    <option value="assigned">Assigned</option>
                    <option value="installed">Installed</option>
                    <option value="faulty">Faulty</option>
                  </Select>
                </div>
                <Button variant="ghost" onClick={() => void loadData()} icon={<RefreshCw className="h-4 w-4" />}>
                  Reload
                </Button>
              </div>

              {/* Items List Table */}
              <div className="card overflow-hidden">
                {items.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500">
                    No matching inventory items found. Add items to track device stock.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                          <th className="p-4">Item Details</th>
                          <th className="p-4">Serial / MAC</th>
                          <th className="p-4">Category</th>
                          <th className="p-4">Location</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {items
                          .filter((it) => {
                            const q = itemQuery.toLowerCase()
                            return (
                              it.itemCode.toLowerCase().includes(q) ||
                              (it.serialNumber || '').toLowerCase().includes(q) ||
                              (it.brand || '').toLowerCase().includes(q) ||
                              (it.model || '').toLowerCase().includes(q)
                            )
                          })
                          .map((it) => (
                            <tr key={it.itemCode} className="hover:bg-zinc-900/10">
                              <td className="p-4">
                                <div className="font-semibold text-zinc-100">{it.brand} {it.model}</div>
                                <div className="font-mono text-xs text-zinc-500">{it.itemCode}</div>
                              </td>
                              <td className="p-4 font-mono text-zinc-300">
                                <div>S/N: {it.serialNumber || '—'}</div>
                                <div className="text-xs text-zinc-500">MAC: {it.macAddress || '—'}</div>
                              </td>
                              <td className="p-4">
                                <Badge variant="neutral">{it.category?.toUpperCase()}</Badge>
                              </td>
                              <td className="p-4 text-zinc-400">
                                {it.locationCode || 'Warehouse'}
                              </td>
                              <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  it.status === 'in_stock'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : it.status === 'assigned'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : it.status === 'installed'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    it.status === 'in_stock'
                                      ? 'bg-emerald-400'
                                      : it.status === 'assigned'
                                      ? 'bg-amber-400'
                                      : it.status === 'installed'
                                      ? 'bg-purple-400'
                                      : 'bg-rose-400'
                                  }`} />
                                  {it.status?.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(it)
                                    setMoveForm({ toLocationCode: it.locationCode || 'default', note: '' })
                                    setMoveModalOpen(true)
                                  }}
                                  icon={<Move className="h-4 w-4" />}
                                >
                                  Dispatch / Move
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'locations' && (
            /* Locations list */
            <div className="card overflow-hidden">
              {locations.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  No stock locations configured. Onboard warehouses, service centers, or installer vans.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <th className="p-4">Location</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Address</th>
                        <th className="p-4">Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {locations.map((loc) => (
                        <tr key={loc.locationCode} className="hover:bg-zinc-900/10">
                          <td className="p-4">
                            <div className="font-semibold text-zinc-100">{loc.name}</div>
                          </td>
                          <td className="p-4">
                            <Badge variant="neutral">{loc.locationType?.toUpperCase()}</Badge>
                          </td>
                          <td className="p-4 text-zinc-300">{loc.address || '—'}</td>
                          <td className="p-4 font-mono text-xs text-zinc-500">{loc.locationCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vendors' && (
            /* Vendors list */
            <div className="card overflow-hidden">
              {vendors.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  No supply vendors configured. Register vendor profiles to trace procurement history.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                        <th className="p-4">Vendor</th>
                        <th className="p-4">Code</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {vendors.map((v) => (
                        <tr key={v.vendorCode} className="hover:bg-zinc-900/10">
                          <td className="p-4">
                            <div className="font-semibold text-zinc-100">{v.name}</div>
                          </td>
                          <td className="p-4 font-mono text-xs text-zinc-500">{v.vendorCode}</td>
                          <td className="p-4 text-zinc-300">{v.contactPerson || '—'}</td>
                          <td className="p-4 text-zinc-300">{v.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Item Modal */}
      <Modal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title="Add Inventory Item"
        description="Register a new hardware device, ONT modem, or network accessory."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setItemModalOpen(false)} disabled={actionLoading === 'create-item'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleCreateItem(e)} loading={actionLoading === 'create-item'}>
              Add Item
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateItem} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Item Code (Unique)"
              placeholder="e.g. ONT-00192"
              value={itemForm.itemCode}
              onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })}
              required
            />
            <Input
              label="Serial Number"
              placeholder="e.g. SN123456"
              value={itemForm.serialNumber}
              onChange={(e) => setItemForm({ ...itemForm, serialNumber: e.target.value })}
              required
            />
            <Input
              label="MAC Address"
              placeholder="e.g. AA:BB:CC:DD:EE:FF"
              value={itemForm.macAddress}
              onChange={(e) => setItemForm({ ...itemForm, macAddress: e.target.value })}
            />
            <Select
              label="Category"
              value={itemForm.category}
              onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
              required
            >
              <option value="ont">ONT / ONU Modem</option>
              <option value="router">Wi-Fi Router</option>
              <option value="splitter">Splitter</option>
              <option value="cable">Cable Spool</option>
              <option value="accessory">Accessory</option>
            </Select>
            <Input
              label="Brand"
              placeholder="e.g. Syrotech"
              value={itemForm.brand}
              onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
              required
            />
            <Input
              label="Model"
              placeholder="e.g. GEPON 1GE+3FE"
              value={itemForm.model}
              onChange={(e) => setItemForm({ ...itemForm, model: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Add Location Modal */}
      <Modal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        title="Add Storage Location / Vehicle"
        description="Register a new warehouse, field branch, or installer van."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLocModalOpen(false)} disabled={actionLoading === 'create-loc'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleCreateLocation(e)} loading={actionLoading === 'create-loc'}>
              Create Location
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateLocation} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Location Code"
              placeholder="e.g. WAREHOUSE-MAIN"
              value={locForm.locationCode}
              onChange={(e) => setLocForm({ ...locForm, locationCode: e.target.value })}
              required
            />
            <Input
              label="Location Name"
              placeholder="e.g. Sector-62 Warehouse"
              value={locForm.name}
              onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
              required
            />
            <Select
              label="Type"
              value={locForm.locationType}
              onChange={(e) => setLocForm({ ...locForm, locationType: e.target.value })}
              required
            >
              <option value="warehouse">Warehouse</option>
              <option value="field_office">Field Office</option>
              <option value="installer_vehicle">Installer Vehicle</option>
            </Select>
          </div>
          <Input
            label="Full Physical Address"
            placeholder="Warehouse address..."
            value={locForm.address}
            onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
          />
        </form>
      </Modal>

      {/* Add Vendor Modal */}
      <Modal
        open={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        title="Register Supplier Vendor"
        description="Create a profile to log hardware supply invoices."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVendorModalOpen(false)} disabled={actionLoading === 'create-vendor'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleCreateVendor(e)} loading={actionLoading === 'create-vendor'}>
              Register Vendor
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateVendor} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Vendor Code"
              placeholder="e.g. VEND-SYROTECH"
              value={vendorForm.vendorCode}
              onChange={(e) => setVendorForm({ ...vendorForm, vendorCode: e.target.value })}
              required
            />
            <Input
              label="Vendor Name"
              placeholder="e.g. Syrotech Technologies Pvt Ltd"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              required
            />
            <Input
              label="Contact Person"
              placeholder="Name of account manager..."
              value={vendorForm.contactPerson}
              onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
            />
            <Input
              label="Email"
              placeholder="manager@syrotech.in"
              value={vendorForm.email}
              onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
            />
            <Input
              label="Phone"
              placeholder="e.g. +919999999999"
              value={vendorForm.phone}
              onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Move/Dispatch Item Modal */}
      <Modal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title="Dispatch / Move Stock Item"
        description={`Transfer item ${selectedItem?.brand || ''} (${selectedItem?.itemCode || ''}) to another vehicle or branch.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoveModalOpen(false)} disabled={actionLoading === 'move-item'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleMoveItem(e)} loading={actionLoading === 'move-item'}>
              Confirm Dispatch
            </Button>
          </>
        }
      >
        <form onSubmit={handleMoveItem} className="space-y-4">
          <Select
            label="Destination Location"
            value={moveForm.toLocationCode}
            onChange={(e) => setMoveForm({ ...moveForm, toLocationCode: e.target.value })}
            required
          >
            <option value="">Select destination...</option>
            {locations.map((loc) => (
              <option key={loc.locationCode} value={loc.locationCode}>
                {loc.name} ({loc.locationType})
              </option>
            ))}
          </Select>
          <Input
            label="Log Notes / Reason"
            placeholder="e.g. Assigned to technician Rohit for Job #1029"
            value={moveForm.note}
            onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  )
}

function TabHeader({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-3 text-sm font-semibold border-b-2 transition ${
        active
          ? 'border-purple-600 text-purple-400'
          : 'border-transparent text-zinc-400 hover:text-zinc-100'
      }`}
    >
      {label}
    </button>
  )
}

function ProgressBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500 font-mono">{count} / {total}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
