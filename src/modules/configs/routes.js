import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { SystemConfig } from "../../models/SystemConfig.js";
import { NotificationEventPreference } from "../../models/NotificationEventPreference.js";
import {
  updateConfigSchema,
  updateNotificationEventSchema,
  updateSettingsSectionSchema,
  updateTableViewSchema
} from "./schemas.js";
import { auditFromRequest } from "../../common/audit.js";

export const configsRouter = Router();

configsRouter.use(requireAuth);

const settingsSectionDefaults = {
  general: {
    organizationName: "JustFiber",
    zoneName: "default",
    email: "",
    phone: "",
    emailSenderName: "JustFiber",
    timezone: "Asia/Kolkata",
    currency: "INR",
    isdCode: "91",
    socialLinks: {
      twitter: "",
      facebook: "",
      instagram: "",
      linkedin: ""
    }
  },
  express_configuration: {
    enforceUniqueRestrictions: [],
    useZoneBillingAddressForInvoices: false,
    useZoneBillingAddressForLedgers: false,
    allowCustomerGatewayChoice: true,
    allowFranchiseGatewayChoice: false,
    renewalViaPins: false,
    addCustomRadiusAttributesForZone: false,
    moveExpiredUsersToDefaultGroup: false,
    bbps: {
      encryptionType: "jar",
      periodType: "numeric",
      mode: "ECB",
      keySize: 128,
      outputFormat: "Base64",
      sendFullUnpaidAmount: true,
      splitEnabled: false,
      splitPaymentAccountId: "",
      corporateAccountNumber: ""
    }
  },
  miscellaneous: {
    enableGstVerification: false,
    requireAadhaarKyc: false,
    maximumReferralLimit: 5,
    accountActivation: "manual",
    showPresentZoneIpRangesOnly: false,
    enableRandomPasswordGeneration: true,
    firebase: {
      adminAppServiceJson: "",
      customerAppServiceJson: "",
      adminServerKey: "",
      customerServerKey: ""
    },
    adminSecurity: {
      passwordComplexity: true,
      resetEnabled: true,
      locationScopedAdminsOnly: false
    },
    loginPolicies: {
      autoAddSimultaneousDevices: true,
      permitLoginWithoutMac: true,
      permitLoginWithoutIp: true,
      autoBindMacOnRequest: true,
      acceptAnyPassword: false
    }
  },
  billing: {
    invoiceTotalRoundOff: true,
    useBalanceWhilePlanChange: true,
    updateBillingCycleByCreatedDate: true,
    rechargeDeactivatedPackage: true,
    customerPortalPaymentAllowed: true,
    allowCashPaymentsProcess: true,
    mandatoryFieldsForPayment: [],
    calculateCarryForwardData: true,
    lockInvoices: "none",
    restrictChangeGroup: "none",
    restrictChangeConnectionType: "none",
    considerFinancialYear: true
  },
  billing_address: {
    address1: "",
    address2: "",
    city: "",
    pinCode: "",
    state: "",
    phone: "",
    email: "",
    country: "INDIA",
    gstImposedZone: false,
    gstNumber: "",
    panNumber: "",
    autoTaxSelection: true
  },
  billing_period: {
    units: [
      { value: 1, unit: "month" },
      { value: 3, unit: "months" },
      { value: 6, unit: "months" },
      { value: 1, unit: "day" },
      { value: 1, unit: "week" },
      { value: 1, unit: "year" }
    ]
  },
  invoice_template: {
    activeTemplate: "justfiber_standard",
    templateName: "JustFiber Standard",
    templates: [
      {
        key: "justfiber_standard",
        templateName: "JustFiber Standard",
        companyName: "JustFiber Netlayer India Private Limited",
        companyAddress: "",
        gstNumber: "",
        website: "justfiber.in",
        panNumber: "",
        phoneNumber: "",
        supportEmail: "",
        bankAccountNumber: "",
        bankName: "",
        bankIfscCode: "",
        invoicePrefix: "JF",
        accentColor: "#8224E3",
        footerNote: "Thank you for choosing JustFiber.",
        paymentInstructions: "Please pay before the due date to avoid service interruption.",
        logoDataUrl: "",
        signatureDataUrl: "",
        stampDataUrl: ""
      }
    ],
    zoneTemplateMappings: [],
    companyName: "JustFiber Netlayer India Private Limited",
    companyAddress: "",
    gstNumber: "",
    website: "justfiber.in",
    panNumber: "",
    phoneNumber: "",
    supportEmail: "",
    bankAccountNumber: "",
    bankName: "",
    bankIfscCode: "",
    invoicePrefix: "JF",
    accentColor: "#8224E3",
    footerNote: "Thank you for choosing JustFiber.",
    paymentInstructions: "Please pay before the due date to avoid service interruption.",
    zoneOverrides: [],
    logoDataUrl: "",
    signatureDataUrl: "",
    stampDataUrl: ""
  },
  prefix_settings: {
    invoice: { prefix: "JFB/", startDate: "2025-01-01" },
    proformaInvoice: { prefix: "JFP/", startDate: "2025-01-01" },
    payment: { prefix: "PAY/", startDate: "2025-01-01" },
    username: { prefix: "JF-", startDate: "2025-01-01" },
    circuitId: { prefix: "CKT-", startDate: "2025-01-01" },
    lead: { prefix: "LD-", startDate: "2025-01-01" },
    helpdesk: { prefix: "HD-", startDate: "2025-01-01" },
    creditNotes: { prefix: "CN-", startDate: "2025-01-01" },
    caf: { prefix: "CAF-", startDate: "2025-01-01" }
  },
  api_settings: {
    apiTokenLabel: "default",
    uploadKeysEnabled: false,
    allowedIps: [],
    postmanCollectionUrl: ""
  },
  tag_payment_gateway: {
    zone: "default",
    adminPaymentsTag: "RAZORPAY_CUSTOMER:razorpay",
    bbpsAccountTag: "",
    enabled: true
  },
  user_fields: {
    sections: [
      "personal_information",
      "installation_address",
      "billing_information",
      "other_information",
      "location_details",
      "proof",
      "network_information",
      "inventory",
      "activation",
      "notifications",
      "generate_random"
    ]
  },
  additional_fields: {
    fields: []
  },
  helpdesk_sla: {
    priorities: {
      low: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
      medium: { firstResponseMinutes: 120, resolutionMinutes: 720 },
      high: { firstResponseMinutes: 60, resolutionMinutes: 240 },
      critical: { firstResponseMinutes: 15, resolutionMinutes: 120 }
    }
  },
  helpdesk_rules: {
    autoAssignment: true,
    reopenWindowHours: 24,
    closingOtpRequired: true,
    complaintCompletionOtpRequired: true,
    teams: ["support", "noc", "field_ops"]
  },
  external_integrations: {
    sms: { enabled: false, providerKey: "" },
    email: { enabled: false, providerKey: "" },
    whatsapp: { enabled: false, providerKey: "" },
    acsGateway: { enabled: true, providerKey: "genieacs" },
    paymentGateway: {
      enabled: true,
      providerKey: "razorpay",
      zoneMappings: []
    },
    ftp: { enabled: false, providerKey: "" },
    googleDrive: { enabled: false, providerKey: "" },
    s3: { enabled: false, providerKey: "" },
    oneSignal: { enabled: false, providerKey: "" },
    webhooks: { enabled: true, providerKey: "" },
    quickbooks: { enabled: false, providerKey: "" },
    iptv: { enabled: false, providerKey: "" },
    voicePhone: { enabled: false, providerKey: "" },
    ott: { enabled: false, providerKey: "" },
    ivr: { enabled: false, providerKey: "" },
    enach: { enabled: false, providerKey: "" },
    aadhaarKyc: { enabled: false, providerKey: "" },
    eInvoiceGateway: { enabled: false, providerKey: "" }
  },
  inventory_configuration: {
    approvalRequiredForAssignment: false,
    autoReserveOnInstallJob: true,
    allowNegativeStock: false,
    categories: ["ont", "router", "stb", "voice_device", "cable", "splitter", "accessory"]
  },
  franchise_configuration: {
    enableSubZones: true,
    allowSwitchZone: true,
    payoutCycleDays: 7,
    collectionApprovalRequired: true,
    tdsEnabled: false
  },
  router_visibility: {
    captivePortalEnabled: false,
    oltAndCpeVisible: true,
    ipManagementVisible: true,
    analyticsVisible: true
  }
};

const notificationEventDefaults = [
  { eventKey: "ticket_message", label: "Tickets Message", category: "tickets", audience: "customer", channels: { email: false, sms: false, whatsapp: false, push: true } },
  { eventKey: "unpaid_invoice", label: "Unpaid Invoice", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "paid_invoice", label: "Paid Invoice", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "usage_alert", label: "Usage Alert", category: "usage", audience: "customer", channels: { email: false, sms: true, whatsapp: false, push: true } },
  { eventKey: "user_discount", label: "User Discount", category: "billing", audience: "customer", channels: { email: true, sms: false, whatsapp: false, push: false } },
  { eventKey: "user_penalty", label: "User Penalty", category: "billing", audience: "customer", channels: { email: true, sms: false, whatsapp: false, push: false } },
  { eventKey: "validity_expire", label: "Validity Expire", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "verification_code", label: "Verification Code", category: "security", audience: "customer", channels: { email: false, sms: true, whatsapp: false, push: false } },
  { eventKey: "ticket_overdue_notification", label: "Ticket Overdue Notification", category: "tickets", audience: "admin", channels: { email: true, sms: false, whatsapp: false, push: true } },
  { eventKey: "ott_subscription", label: "OTT Subscription", category: "ott", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "raising_ticket_notification", label: "Raising Ticket Notification", category: "tickets", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "renewal", label: "Renewal", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "report_download", label: "Report Download", category: "reports", audience: "admin", channels: { email: true, sms: false, whatsapp: false, push: false } },
  { eventKey: "nat_log_up", label: "NATLog Up", category: "network", audience: "admin", channels: { email: false, sms: false, whatsapp: false, push: true } },
  { eventKey: "nat_log_down", label: "NATLog Down", category: "network", audience: "admin", channels: { email: false, sms: false, whatsapp: false, push: true } },
  { eventKey: "payment_collection_request", label: "Payment Collection Request", category: "collections", audience: "admin", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "invoice_due_date", label: "Invoice Reminder On Due Date", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "invoice_three_days_before_due", label: "Invoice Reminder Three Days Before Due Date", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "invoice_ten_days_after_due", label: "Invoice Reminder Ten Days After Due Date", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "closing_ticket_notification_client", label: "Closing Ticket Notification Client", category: "tickets", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "closing_ticket_notification_admin", label: "Closing Ticket Notification Admin", category: "tickets", audience: "admin", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "closing_ticket_otp", label: "Closing Ticket OTP", category: "tickets", audience: "customer", channels: { email: false, sms: true, whatsapp: false, push: false } },
  { eventKey: "reopening_ticket_otp", label: "Reopening Ticket OTP", category: "tickets", audience: "customer", channels: { email: false, sms: true, whatsapp: false, push: false } },
  { eventKey: "account_suspension", label: "Account Suspension", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "assign_leads", label: "Assign Leads", category: "sales", audience: "sales", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "assign_ticket", label: "Assign Ticket", category: "tickets", audience: "admin", channels: { email: true, sms: true, whatsapp: false, push: true } },
  { eventKey: "billing_invoice", label: "Billing Invoice", category: "billing", audience: "customer", channels: { email: true, sms: true, whatsapp: false, push: true } }
];

const tableViewDefaults = {
  users: {
    label: "View All Users",
    defaultSortField: "username",
    defaultSortDirection: "asc",
    columns: [
      { key: "circuitId", label: "CircuitId", visible: true, sortable: true },
      { key: "username", label: "Username", visible: true, sortable: true },
      { key: "status", label: "Status", visible: true, sortable: true },
      { key: "firstName", label: "First Name", visible: true, sortable: true },
      { key: "lastName", label: "Last Name", visible: true, sortable: true },
      { key: "phoneNumber", label: "Phone Number", visible: true, sortable: false },
      { key: "email", label: "Email", visible: true, sortable: false },
      { key: "activationDate", label: "Activation Date", visible: true, sortable: true },
      { key: "created", label: "Created", visible: true, sortable: true },
      { key: "expirationDate", label: "Expiration Date", visible: true, sortable: true },
      { key: "group", label: "Group", visible: true, sortable: true },
      { key: "companyName", label: "Company Name", visible: true, sortable: true },
      { key: "staticIpAndMac", label: "Static IP And MAC", visible: true, sortable: false },
      { key: "addressLine1", label: "Address Line 1", visible: false, sortable: false },
      { key: "addressLine2", label: "Address Line 2", visible: false, sortable: false },
      { key: "addressCity", label: "Address City", visible: false, sortable: false },
      { key: "addressPin", label: "Address Pin", visible: false, sortable: false }
    ]
  },
  active_sessions: {
    label: "View Active Sessions",
    defaultSortField: "updatedAt",
    defaultSortDirection: "desc",
    columns: [
      { key: "serviceId", label: "Service ID", visible: true, sortable: true },
      { key: "customerId", label: "Customer ID", visible: true, sortable: true },
      { key: "radiusUsername", label: "PPPoE Username", visible: true, sortable: true },
      { key: "status", label: "Status", visible: true, sortable: true },
      { key: "bngNodeCode", label: "BNG Node", visible: true, sortable: true },
      { key: "currentIpv4", label: "Current IPv4", visible: true, sortable: false },
      { key: "updatedAt", label: "Updated At", visible: true, sortable: true }
    ]
  },
  invoices: {
    label: "View Invoice",
    defaultSortField: "generatedAt",
    defaultSortDirection: "desc",
    columns: [
      { key: "invoiceId", label: "Invoice ID", visible: true, sortable: true },
      { key: "customerId", label: "Customer ID", visible: true, sortable: true },
      { key: "billCycle", label: "Bill Cycle", visible: true, sortable: true },
      { key: "totalAmount", label: "Total Amount", visible: true, sortable: true },
      { key: "paymentStatus", label: "Payment Status", visible: true, sortable: true },
      { key: "dueDate", label: "Due Date", visible: true, sortable: true }
    ]
  },
  payments: {
    label: "View Payments",
    defaultSortField: "paidAt",
    defaultSortDirection: "desc",
    columns: [
      { key: "transactionId", label: "Transaction ID", visible: true, sortable: true },
      { key: "customerId", label: "Customer ID", visible: true, sortable: true },
      { key: "provider", label: "Provider", visible: true, sortable: true },
      { key: "amount", label: "Amount", visible: true, sortable: true },
      { key: "status", label: "Status", visible: true, sortable: true },
      { key: "method", label: "Method", visible: true, sortable: true },
      { key: "paidAt", label: "Paid At", visible: true, sortable: true }
    ]
  }
};

function settingsKey(section) {
  return `settings.${section}`;
}

async function upsertSystemConfig({ key, category, value, updatedBy }) {
  let config = await SystemConfig.findOne({ key });
  if (!config) {
    config = new SystemConfig({
      key,
      category,
      value,
      valueType: "json",
      history: [],
      updatedBy
    });
  } else {
    config.history.push({
      version: config.version,
      value: config.value,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt
    });
    config.value = value;
    config.valueType = "json";
    config.category = category;
    config.version += 1;
    config.updatedBy = updatedBy;
  }
  await config.save();
  return config;
}

configsRouter.get(
  "/",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const configs = await SystemConfig.find().sort({ category: 1, key: 1 }).lean();
    return ok(res, configs);
  })
);

configsRouter.patch(
  "/:key",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateConfigSchema.parse(req.body);
    let config = await SystemConfig.findOne({ key: req.params.key });
    const previous = config?.toObject();
    if (!config) {
      config = new SystemConfig({
        key: req.params.key,
        ...payload,
        history: []
      });
    } else {
      config.history.push({
        version: config.version,
        value: config.value,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt
      });
      config.value = payload.value;
      config.valueType = payload.valueType;
      config.category = payload.category;
      config.version += 1;
    }
    config.updatedBy = req.admin._id;
    await config.save();
    await auditFromRequest(req, {
      action: "config.updated",
      entityType: "config",
      entityId: config.key,
      before: previous,
      after: config.toObject()
    });
    return ok(res, config);
  })
);

configsRouter.get(
  "/settings/catalog",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = Object.entries(settingsSectionDefaults).map(([section, value]) => ({
      section,
      category: "settings",
      key: settingsKey(section),
      fieldsPreview: Object.keys(value)
    }));
    return ok(res, items);
  })
);

configsRouter.get(
  "/settings/:section",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const defaults = settingsSectionDefaults[req.params.section];
    if (!defaults) {
      return ok(res, null);
    }
    const config = await SystemConfig.findOne({ key: settingsKey(req.params.section) }).lean();
    return ok(res, {
      section: req.params.section,
      key: settingsKey(req.params.section),
      value: {
        ...defaults,
        ...(config?.value || {})
      },
      version: config?.version || 1,
      updatedAt: config?.updatedAt || null
    });
  })
);

configsRouter.put(
  "/settings/:section",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const defaults = settingsSectionDefaults[req.params.section];
    if (!defaults) {
      return ok(res, null);
    }
    const payload = updateSettingsSectionSchema.parse(req.body || {});
    const previous = await SystemConfig.findOne({ key: settingsKey(req.params.section) }).lean();
    const mergedValue = {
      ...defaults,
      ...(previous?.value || {}),
      ...payload.value
    };
    const config = await upsertSystemConfig({
      key: settingsKey(req.params.section),
      category: "settings",
      value: mergedValue,
      updatedBy: req.admin._id
    });
    await auditFromRequest(req, {
      action: "settings.section.updated",
      entityType: "config",
      entityId: config.key,
      before: previous,
      after: config.toObject()
    });
    return ok(res, config);
  })
);

configsRouter.get(
  "/notification-events",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const stored = await NotificationEventPreference.find().sort({ category: 1, label: 1 }).lean();
    const storedMap = new Map(stored.map((item) => [item.eventKey, item]));
    const merged = notificationEventDefaults.map((item) => {
      const override = storedMap.get(item.eventKey);
      return {
        ...item,
        ...(override || {}),
        channels: {
          ...item.channels,
          ...(override?.channels || {})
        }
      };
    });
    for (const item of stored) {
      if (!merged.find((entry) => entry.eventKey === item.eventKey)) {
        merged.push(item);
      }
    }
    return ok(res, merged);
  })
);

configsRouter.put(
  "/notification-events/:eventKey",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateNotificationEventSchema.parse(req.body || {});
    const base = notificationEventDefaults.find((item) => item.eventKey === req.params.eventKey) || {
      eventKey: req.params.eventKey,
      label: req.params.eventKey,
      category: "custom",
      audience: "customer",
      channels: { email: false, sms: false, whatsapp: false, push: false }
    };
    const item = await NotificationEventPreference.findOneAndUpdate(
      { eventKey: req.params.eventKey },
      {
        $set: {
          label: payload.label || base.label,
          category: payload.category || base.category,
          audience: payload.audience || base.audience,
          description: payload.description ?? base.description,
          enabled: payload.enabled ?? true,
          channels: {
            ...base.channels,
            ...(payload.channels || {})
          },
          metadata: payload.metadata,
          updatedBy: req.admin._id
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await auditFromRequest(req, {
      action: "notification.event.updated",
      entityType: "notification_event",
      entityId: req.params.eventKey,
      after: item.toObject()
    });
    return ok(res, item);
  })
);

configsRouter.get(
  "/table-views/:viewKey",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const defaults = tableViewDefaults[req.params.viewKey];
    if (!defaults) {
      return ok(res, null);
    }
    const config = await SystemConfig.findOne({ key: `table_view.${req.params.viewKey}` }).lean();
    return ok(res, {
      viewKey: req.params.viewKey,
      ...(defaults || {}),
      ...(config?.value || {})
    });
  })
);

configsRouter.put(
  "/table-views/:viewKey",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const defaults = tableViewDefaults[req.params.viewKey];
    if (!defaults) {
      return ok(res, null);
    }
    const payload = updateTableViewSchema.parse(req.body || {});
    const previous = await SystemConfig.findOne({ key: `table_view.${req.params.viewKey}` }).lean();
    const mergedValue = {
      ...defaults,
      ...(previous?.value || {}),
      ...payload
    };
    const config = await upsertSystemConfig({
      key: `table_view.${req.params.viewKey}`,
      category: "table_view",
      value: mergedValue,
      updatedBy: req.admin._id
    });
    await auditFromRequest(req, {
      action: "table.view.updated",
      entityType: "table_view",
      entityId: req.params.viewKey,
      before: previous,
      after: config.toObject()
    });
    return ok(res, config);
  })
);
