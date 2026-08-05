'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { PageHeader } from '@/components/ui/page-header'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Building2, CreditCard, Bell, Save, RefreshCw, Sliders, Key } from 'lucide-react'

type TabType = 'general' | 'billing' | 'billing_address' | 'prefix' | 'integrations'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Section States
  const [general, setGeneral] = useState({
    organizationName: 'JustFiber',
    zoneName: 'default',
    email: '',
    phone: '',
    emailSenderName: 'JustFiber',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    isdCode: '91',
  })

  const [billing, setBilling] = useState({
    invoiceTotalRoundOff: true,
    useBalanceWhilePlanChange: true,
    customerPortalPaymentAllowed: true,
    allowCashPaymentsProcess: true,
    considerFinancialYear: true,
  })

  const [address, setAddress] = useState({
    address1: '',
    address2: '',
    city: '',
    pinCode: '',
    state: '',
    phone: '',
    email: '',
    country: 'INDIA',
    gstNumber: '',
    panNumber: '',
  })

  const [prefixes, setPrefixes] = useState({
    invoice: 'JFB/',
    proformaInvoice: 'JFP/',
    payment: 'PAY/',
    username: 'JF-',
    lead: 'LD-',
    helpdesk: 'HD-',
    caf: 'CAF-',
  })

  const [integrations, setIntegrations] = useState({
    sms: {
      enabled: false,
      providerKey: '',
      twilioSid: '',
      twilioToken: '',
      twilioFrom: '',
      msg91Key: '',
      msg91Sender: '',
    },
    email: {
      enabled: false,
      providerKey: 'smtp',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: '',
      smtpPass: '',
      smtpSender: '',
    },
    whatsapp: { enabled: false, providerKey: '' },
    paymentGateway: { enabled: true, providerKey: 'razorpay' },
  })

  useEffect(() => {
    void fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const [genRes, billRes, addrRes, prefixRes, intRes] = await Promise.all([
        adminAPI.getSettingsSection('general'),
        adminAPI.getSettingsSection('billing'),
        adminAPI.getSettingsSection('billing_address'),
        adminAPI.getSettingsSection('prefix_settings'),
        adminAPI.getSettingsSection('external_integrations'),
      ])

      if (genRes.success && genRes.data?.value) setGeneral(genRes.data.value as any)
      if (billRes.success && billRes.data?.value) setBilling(billRes.data.value as any)
      if (addrRes.success && addrRes.data?.value) setAddress(addrRes.data.value as any)
      
      if (prefixRes.success && prefixRes.data?.value) {
        const val = prefixRes.data.value
        setPrefixes({
          invoice: val.invoice?.prefix || 'JFB/',
          proformaInvoice: val.proformaInvoice?.prefix || 'JFP/',
          payment: val.payment?.prefix || 'PAY/',
          username: val.username?.prefix || 'JF-',
          lead: val.lead?.prefix || 'LD-',
          helpdesk: val.helpdesk?.prefix || 'HD-',
          caf: val.caf?.prefix || 'CAF-',
        })
      }

      if (intRes.success && intRes.data?.value) setIntegrations(intRes.data.value as any)
    } catch (e) {
      console.error(e)
      toast.error('Failed to load system settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveSection(section: string, payload: any) {
    setSaving(true)
    try {
      const res = await adminAPI.updateSettingsSection(section, payload)
      if (res.success) {
        toast.success(`${section.replace(/_/g, ' ').toUpperCase()} settings saved successfully.`)
        await fetchSettings()
      } else {
        toast.error(res.error || 'Failed to update settings')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    void saveSection('general', general)
  }

  function handleSaveBilling(e: React.FormEvent) {
    e.preventDefault()
    void saveSection('billing', billing)
  }

  function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault()
    void saveSection('billing_address', address)
  }

  function handleSavePrefixes(e: React.FormEvent) {
    e.preventDefault()
    const packed = {
      invoice: { prefix: prefixes.invoice, startDate: '2026-01-01' },
      proformaInvoice: { prefix: prefixes.proformaInvoice, startDate: '2026-01-01' },
      payment: { prefix: prefixes.payment, startDate: '2026-01-01' },
      username: { prefix: prefixes.username, startDate: '2026-01-01' },
      lead: { prefix: prefixes.lead, startDate: '2026-01-01' },
      helpdesk: { prefix: prefixes.helpdesk, startDate: '2026-01-01' },
      caf: { prefix: prefixes.caf, startDate: '2026-01-01' },
    }
    void saveSection('prefix_settings', packed)
  }

  function handleSaveIntegrations(e: React.FormEvent) {
    e.preventDefault()
    void saveSection('external_integrations', integrations)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure organizational details, billing rules, invoice templates, prefix configurations, and payment gateways."
        eyebrow="Settings"
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
        <div className="space-y-1">
          <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="Company Profile" icon={Building2} />
          <TabButton active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} label="Billing Defaults" icon={CreditCard} />
          <TabButton active={activeTab === 'billing_address'} onClick={() => setActiveTab('billing_address')} label="Billing Address & Tax" icon={Sliders} />
          <TabButton active={activeTab === 'prefix'} onClick={() => setActiveTab('prefix')} label="Prefix Configuration" icon={Key} />
          <TabButton active={activeTab === 'integrations'} onClick={() => setActiveTab('integrations')} label="Integrations" icon={Bell} />
        </div>

        {/* Edit Panel */}
        <div className="card p-6 min-h-[480px]">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {activeTab === 'general' && (
                <form onSubmit={handleSaveGeneral} className="space-y-6">
                  <div className="border-b pb-4 border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-100">Company Profile</h3>
                    <p className="text-xs text-zinc-400 mt-1">Basic details for branding, outgoing emails, and customer identity.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Organization Name"
                      value={general.organizationName}
                      onChange={(e) => setGeneral({ ...general, organizationName: e.target.value })}
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      value={general.email}
                      onChange={(e) => setGeneral({ ...general, email: e.target.value })}
                      required
                    />
                    <Input
                      label="Phone Number"
                      value={general.phone}
                      onChange={(e) => setGeneral({ ...general, phone: e.target.value })}
                      required
                    />
                    <Input
                      label="Sender Name (Email)"
                      value={general.emailSenderName}
                      onChange={(e) => setGeneral({ ...general, emailSenderName: e.target.value })}
                      required
                    />
                    <Select
                      label="Timezone"
                      value={general.timezone}
                      onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                    </Select>
                    <Input
                      label="Currency Code"
                      value={general.currency}
                      onChange={(e) => setGeneral({ ...general, currency: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" type="submit" loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'billing' && (
                <form onSubmit={handleSaveBilling} className="space-y-6">
                  <div className="border-b pb-4 border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-100">Billing & Charging Rules</h3>
                    <p className="text-xs text-zinc-400 mt-1">Configure invoicing thresholds, ledger settings, and collections criteria.</p>
                  </div>
                  <div className="space-y-4">
                    <CheckboxCard
                      title="Invoice Round-off"
                      description="Automatically round total invoice amount to the nearest whole rupee."
                      checked={billing.invoiceTotalRoundOff}
                      onChange={(checked) => setBilling({ ...billing, invoiceTotalRoundOff: checked })}
                    />
                    <CheckboxCard
                      title="Adjust Balance on Plan Change"
                      description="Apply remaining customer ledger balance/unused period credits dynamically during plan upgrades."
                      checked={billing.useBalanceWhilePlanChange}
                      onChange={(checked) => setBilling({ ...billing, useBalanceWhilePlanChange: checked })}
                    />
                    <CheckboxCard
                      title="Customer App Payments"
                      description="Allow subscribers to complete payments directly from the customer mobile self-care app."
                      checked={billing.customerPortalPaymentAllowed}
                      onChange={(checked) => setBilling({ ...billing, customerPortalPaymentAllowed: checked })}
                    />
                    <CheckboxCard
                      title="Cash Payments Desk"
                      description="Enable operators to collect physical cash payments and trigger auto-resumptions."
                      checked={billing.allowCashPaymentsProcess}
                      onChange={(checked) => setBilling({ ...billing, allowCashPaymentsProcess: checked })}
                    />
                    <CheckboxCard
                      title="Lock Invoices to Financial Year"
                      description="Strictly group and prefix invoices relative to the standard Indian financial calendar (Apr - Mar)."
                      checked={billing.considerFinancialYear}
                      onChange={(checked) => setBilling({ ...billing, considerFinancialYear: checked })}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" type="submit" loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'billing_address' && (
                <form onSubmit={handleSaveAddress} className="space-y-6">
                  <div className="border-b pb-4 border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-100">Billing Address & Corporate Compliance</h3>
                    <p className="text-xs text-zinc-400 mt-1">Set corporate headquarters details for legal tax invoices.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Address Line 1"
                      value={address.address1}
                      onChange={(e) => setAddress({ ...address, address1: e.target.value })}
                      required
                    />
                    <Input
                      label="Address Line 2"
                      value={address.address2}
                      onChange={(e) => setAddress({ ...address, address2: e.target.value })}
                    />
                    <Input
                      label="City"
                      value={address.city}
                      onChange={(e) => setAddress({ ...address, city: e.target.value })}
                      required
                    />
                    <Input
                      label="PIN Code"
                      value={address.pinCode}
                      onChange={(e) => setAddress({ ...address, pinCode: e.target.value })}
                      required
                    />
                    <Input
                      label="State"
                      value={address.state}
                      onChange={(e) => setAddress({ ...address, state: e.target.value })}
                      required
                    />
                    <Input
                      label="GSTIN (Primary)"
                      value={address.gstNumber}
                      onChange={(e) => setAddress({ ...address, gstNumber: e.target.value })}
                      placeholder="e.g. 06AAICN3717E1ZN"
                    />
                    <Input
                      label="PAN Number"
                      value={address.panNumber}
                      onChange={(e) => setAddress({ ...address, panNumber: e.target.value })}
                      placeholder="e.g. ABCDE1234F"
                    />
                    <Input
                      label="Support Phone"
                      value={address.phone}
                      onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" type="submit" loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'prefix' && (
                <form onSubmit={handleSavePrefixes} className="space-y-6">
                  <div className="border-b pb-4 border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-100">Document Prefix configuration</h3>
                    <p className="text-xs text-zinc-400 mt-1">Configure serial number sequences and invoice prefix labels.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Invoice Prefix"
                      value={prefixes.invoice}
                      onChange={(e) => setPrefixes({ ...prefixes, invoice: e.target.value })}
                      required
                    />
                    <Input
                      label="Proforma Invoice Prefix"
                      value={prefixes.proformaInvoice}
                      onChange={(e) => setPrefixes({ ...prefixes, proformaInvoice: e.target.value })}
                      required
                    />
                    <Input
                      label="Payment Receipt Prefix"
                      value={prefixes.payment}
                      onChange={(e) => setPrefixes({ ...prefixes, payment: e.target.value })}
                      required
                    />
                    <Input
                      label="PPPoE Username Prefix"
                      value={prefixes.username}
                      onChange={(e) => setPrefixes({ ...prefixes, username: e.target.value })}
                      required
                    />
                    <Input
                      label="Sales Lead Prefix"
                      value={prefixes.lead}
                      onChange={(e) => setPrefixes({ ...prefixes, lead: e.target.value })}
                      required
                    />
                    <Input
                      label="Helpdesk Ticket Prefix"
                      value={prefixes.helpdesk}
                      onChange={(e) => setPrefixes({ ...prefixes, helpdesk: e.target.value })}
                      required
                    />
                    <Input
                      label="Customer CAF Application Prefix"
                      value={prefixes.caf}
                      onChange={(e) => setPrefixes({ ...prefixes, caf: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" type="submit" loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}

              {activeTab === 'integrations' && (
                <form onSubmit={handleSaveIntegrations} className="space-y-6">
                  <div className="border-b pb-4 border-zinc-800">
                    <h3 className="text-lg font-semibold text-zinc-100">System Integrations</h3>
                    <p className="text-xs text-zinc-400 mt-1">Configure third-party gateways for transactional SMS messages, WhatsApp updates, SMTP outgoing mail, and online payment gateways.</p>
                  </div>
                  <div className="space-y-6">
                    {/* Payment Gateway */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-zinc-100">Razorpay Payment Gateway</div>
                          <div className="text-xs text-zinc-500 mt-0.5">Allow online collections through cards, UPI, net banking.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={integrations.paymentGateway.enabled}
                          onChange={(e) => setIntegrations({
                            ...integrations,
                            paymentGateway: { ...integrations.paymentGateway, enabled: e.target.checked }
                          })}
                          className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-5 w-5"
                        />
                      </div>
                    </div>

                    {/* Outgoing Mail / SMTP */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-zinc-100">SMTP Email Server Integration</div>
                          <div className="text-xs text-zinc-500 mt-0.5">Send billing receipts and welcome mail from your own domain.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={integrations.email.enabled}
                          onChange={(e) => setIntegrations({
                            ...integrations,
                            email: { ...integrations.email, enabled: e.target.checked }
                          })}
                          className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-5 w-5"
                        />
                      </div>
                      
                      {integrations.email.enabled && (
                        <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-zinc-800">
                          <Input
                            label="SMTP Host Address"
                            placeholder="e.g. smtp.gmail.com"
                            value={integrations.email.smtpHost || ''}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              email: { ...integrations.email, smtpHost: e.target.value }
                            })}
                            required
                          />
                          <Input
                            label="SMTP Port"
                            type="number"
                            placeholder="587"
                            value={integrations.email.smtpPort || 587}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              email: { ...integrations.email, smtpPort: parseInt(e.target.value) || 587 }
                            })}
                            required
                          />
                          <Input
                            label="SMTP Username / Mailer Email"
                            placeholder="e.g. billing@yourisp.com"
                            value={integrations.email.smtpUser || ''}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              email: { ...integrations.email, smtpUser: e.target.value }
                            })}
                            required
                          />
                          <Input
                            label="SMTP Password / Auth Key"
                            type="password"
                            placeholder="Sender email password"
                            value={integrations.email.smtpPass || ''}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              email: { ...integrations.email, smtpPass: e.target.value }
                            })}
                            required
                          />
                          <Input
                            label="Default Sender Email"
                            placeholder="e.g. notifications@yourisp.com"
                            value={integrations.email.smtpSender || ''}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              email: { ...integrations.email, smtpSender: e.target.value }
                            })}
                          />
                          <div className="flex items-center gap-2 pt-8">
                            <input
                              id="smtpSecure"
                              type="checkbox"
                              checked={Boolean(integrations.email.smtpSecure)}
                              onChange={(e) => setIntegrations({
                                ...integrations,
                                email: { ...integrations.email, smtpSecure: e.target.checked }
                              })}
                              className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
                            />
                            <label htmlFor="smtpSecure" className="text-xs text-zinc-400 font-semibold cursor-pointer">
                              Use SSL/TLS Security Encryption
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SMS Gateway Notifications */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-zinc-100">SMS Gateway Notifications</div>
                          <div className="text-xs text-zinc-500 mt-0.5">Send OTP prompts and critical threshold alerts directly to subscriber phones.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={integrations.sms.enabled}
                          onChange={(e) => setIntegrations({
                            ...integrations,
                            sms: { ...integrations.sms, enabled: e.target.checked }
                          })}
                          className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-5 w-5"
                        />
                      </div>

                      {integrations.sms.enabled && (
                        <div className="space-y-4 pt-2 border-t border-zinc-800">
                          <Select
                            label="Select SMS Service Provider"
                            value={integrations.sms.providerKey || ''}
                            onChange={(e) => setIntegrations({
                              ...integrations,
                              sms: { ...integrations.sms, providerKey: e.target.value }
                            })}
                            required
                          >
                            <option value="">Choose SMS Provider...</option>
                            <option value="twilio">Twilio SMS gateway</option>
                            <option value="msg91">MSG91 India Gateway</option>
                          </Select>

                          {integrations.sms.providerKey === 'twilio' && (
                            <div className="grid gap-4 md:grid-cols-3">
                              <Input
                                label="Twilio Account SID"
                                placeholder="AC..."
                                value={integrations.sms.twilioSid || ''}
                                onChange={(e) => setIntegrations({
                                  ...integrations,
                                  sms: { ...integrations.sms, twilioSid: e.target.value }
                                })}
                                required
                              />
                              <Input
                                label="Twilio Auth Token"
                                type="password"
                                placeholder="Auth Token secret"
                                value={integrations.sms.twilioToken || ''}
                                onChange={(e) => setIntegrations({
                                  ...integrations,
                                  sms: { ...integrations.sms, twilioToken: e.target.value }
                                })}
                                required
                              />
                              <Input
                                label="Twilio Sender Phone / From Number"
                                placeholder="e.g. +1234567890"
                                value={integrations.sms.twilioFrom || ''}
                                onChange={(e) => setIntegrations({
                                  ...integrations,
                                  sms: { ...integrations.sms, twilioFrom: e.target.value }
                                })}
                                required
                              />
                            </div>
                          )}

                          {integrations.sms.providerKey === 'msg91' && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <Input
                                label="MSG91 Auth Authentication Key"
                                type="password"
                                placeholder="Enter MSG91 API key"
                                value={integrations.sms.msg91Key || ''}
                                onChange={(e) => setIntegrations({
                                  ...integrations,
                                  sms: { ...integrations.sms, msg91Key: e.target.value }
                                })}
                                required
                              />
                              <Input
                                label="MSG91 Sender ID / Header"
                                placeholder="e.g. JSTFIB"
                                value={integrations.sms.msg91Sender || ''}
                                onChange={(e) => setIntegrations({
                                  ...integrations,
                                  sms: { ...integrations.sms, msg91Sender: e.target.value }
                                })}
                                required
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp */}
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-zinc-100">WhatsApp Notification Push</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Push PDF invoices and ticket updates directly to client phones.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={integrations.whatsapp.enabled}
                        onChange={(e) => setIntegrations({
                          ...integrations,
                          whatsapp: { ...integrations.whatsapp, enabled: e.target.checked }
                        })}
                        className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-5 w-5"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="primary" type="submit" loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  label: string
  icon: any
}

function TabButton({ active, onClick, label, icon: Icon }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition ${
        active
          ? 'bg-purple-600 text-white font-semibold shadow-sm'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

interface CheckboxCardProps {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function CheckboxCard({ title, description, checked, onChange }: CheckboxCardProps) {
  return (
    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-start gap-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4 w-4"
      />
      <div className="flex-1">
        <div className="font-semibold text-zinc-100 text-sm">{title}</div>
        <div className="text-xs text-zinc-500 mt-1 leading-relaxed">{description}</div>
      </div>
    </div>
  )
}
