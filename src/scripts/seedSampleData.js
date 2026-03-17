import { connectMongo } from "../db/mongoose.js";
import { seedSystemData } from "../bootstrap/seedSystem.js";
import { Customer } from "../models/Customer.js";
import { DeviceOperationalCache } from "../models/DeviceOperationalCache.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { DashboardSnapshot } from "../models/DashboardSnapshot.js";
import { SystemConfig } from "../models/SystemConfig.js";
import { AdminUser } from "../models/AdminUser.js";
import { Installer } from "../models/Installer.js";
import { InstallerJob } from "../models/InstallerJob.js";
import { InstallerNotification } from "../models/InstallerNotification.js";
import { AppBanner } from "../models/AppBanner.js";
import { AddonCatalog } from "../models/AddonCatalog.js";
import { CustomerUser } from "../models/CustomerUser.js";
import { BillingInvoice } from "../models/BillingInvoice.js";
import { CustomerNotification } from "../models/CustomerNotification.js";
import { Lead } from "../models/Lead.js";
import { LeadKycDocument } from "../models/LeadKycDocument.js";
import { NetworkNodeStatus } from "../models/NetworkNodeStatus.js";
import { PaymentTransaction } from "../models/PaymentTransaction.js";
import { PlanCatalog } from "../models/PlanCatalog.js";
import { SalesAgent } from "../models/SalesAgent.js";
import { ServiceRequest } from "../models/ServiceRequest.js";
import { ServiceabilityZone } from "../models/ServiceabilityZone.js";
import argon2 from "argon2";

const customers = [
  {
    customerId: "CUST-1001",
    accountNumber: "AC-77821",
    fullName: "Amit Singh",
    phone: "9876543210",
    email: "amit@example.com",
    serviceId: "SVC-1001",
    planCode: "PLAN-100",
    planName: "100 Mbps Unlimited",
    jazeStatus: "active",
    operationalStatus: "active",
    expiryAt: new Date("2026-03-28T00:00:00.000Z"),
    billingSnapshot: {
      lastInvoiceAmount: 799,
      currency: "INR",
      lastPaymentStatus: "paid",
      dueAmount: 0,
      remainingDays: 13
    },
    invoiceSummary: {
      billCycle: "Monthly",
      billMode: "Prepaid",
      lastInvoiceNumber: "INV-1001",
      lastInvoiceDate: new Date("2026-03-01T00:00:00.000Z")
    },
    address: {
      city: "Lucknow",
      area: "Gomti Nagar"
    },
    lastSyncedAt: new Date()
  },
  {
    customerId: "CUST-1002",
    accountNumber: "AC-77822",
    fullName: "Sara Khan",
    phone: "9876543211",
    email: "sara@example.com",
    serviceId: "SVC-1002",
    planCode: "PLAN-200",
    planName: "200 Mbps Family",
    jazeStatus: "suspended",
    operationalStatus: "suspended",
    expiryAt: new Date("2026-03-10T00:00:00.000Z"),
    billingSnapshot: {
      lastInvoiceAmount: 1199,
      currency: "INR",
      lastPaymentStatus: "overdue",
      dueAmount: 1199,
      remainingDays: 0
    },
    invoiceSummary: {
      billCycle: "Monthly",
      billMode: "Prepaid",
      lastInvoiceNumber: "INV-1002",
      lastInvoiceDate: new Date("2026-03-01T00:00:00.000Z")
    },
    address: {
      city: "Lucknow",
      area: "Aliganj"
    },
    lastSyncedAt: new Date()
  },
  {
    customerId: "CUST-1003",
    accountNumber: "AC-77823",
    fullName: "Rohit Verma",
    phone: "9876543212",
    email: "rohit@example.com",
    serviceId: "SVC-1003",
    planCode: "PLAN-300",
    planName: "300 Mbps Pro",
    jazeStatus: "active",
    operationalStatus: "active",
    expiryAt: new Date("2026-04-02T00:00:00.000Z"),
    billingSnapshot: {
      lastInvoiceAmount: 1499,
      currency: "INR",
      lastPaymentStatus: "paid",
      dueAmount: 0,
      remainingDays: 18
    },
    invoiceSummary: {
      billCycle: "Monthly",
      billMode: "Prepaid",
      lastInvoiceNumber: "INV-1003",
      lastInvoiceDate: new Date("2026-03-02T00:00:00.000Z")
    },
    address: {
      city: "Kanpur",
      area: "Civil Lines"
    },
    lastSyncedAt: new Date()
  }
];

const devices = [
  {
    customerId: "CUST-1001",
    serviceId: "SVC-1001",
    deviceId: "ONT-1001",
    serialNumber: "HWTC123456",
    oui: "485754",
    productClass: "Huawei-EG8145V5",
    lastInformAt: new Date(),
    onlineStatus: "online",
    provisioningState: "SERVICE_ACTIVATE",
    wifiInfo: {
      ssid24Masked: "JustFiber-Home-2.4G",
      ssid5Masked: "JustFiber-Home-5G",
      bandSteering: true,
      natEnabled: true,
      guestWifiEnabled: false
    },
    wanInfo: {
      pppoeUsernameMasked: "amit***",
      ipAddress: "10.10.10.11",
      uptimeSeconds: 482933,
      wanMode: "pppoe",
      sessionStatus: "up",
      vlanId: 110
    },
    lanInfo: {
      routerIp: "192.168.1.1",
      dhcpEnabled: true,
      leasedClients: 6,
      ethernetPortsUp: 3
    },
    opticalInfo: {
      rxPower: -18.6,
      txPower: 2.2,
      lastMeasuredAt: new Date()
    }
  },
  {
    customerId: "CUST-1002",
    serviceId: "SVC-1002",
    deviceId: "ONT-1002",
    serialNumber: "ZTEC998877",
    oui: "AC9E17",
    productClass: "ZTE-F670L",
    lastInformAt: new Date(Date.now() - 1000 * 60 * 95),
    onlineStatus: "offline",
    provisioningState: "SERVICE_SUSPEND",
    wifiInfo: {
      ssid24Masked: "KhanHome-2.4G",
      ssid5Masked: "KhanHome-5G",
      bandSteering: false,
      natEnabled: true,
      guestWifiEnabled: false
    },
    wanInfo: {
      pppoeUsernameMasked: "sara***",
      ipAddress: "10.10.10.12",
      uptimeSeconds: 0,
      wanMode: "pppoe",
      sessionStatus: "down",
      vlanId: 120
    },
    lanInfo: {
      routerIp: "192.168.0.1",
      dhcpEnabled: true,
      leasedClients: 0,
      ethernetPortsUp: 0
    },
    opticalInfo: {
      rxPower: -27.9,
      txPower: 1.6,
      lastMeasuredAt: new Date()
    }
  },
  {
    customerId: "CUST-1003",
    serviceId: "SVC-1003",
    deviceId: "ONT-1003",
    serialNumber: "NOKI554433",
    oui: "7CC2C6",
    productClass: "Nokia-G2425G-A",
    lastInformAt: new Date(Date.now() - 1000 * 60 * 5),
    onlineStatus: "online",
    provisioningState: "SERVICE_ACTIVATE",
    wifiInfo: {
      ssid24Masked: "RohitNet-2.4G",
      ssid5Masked: "RohitNet-5G",
      bandSteering: true,
      natEnabled: true,
      guestWifiEnabled: true
    },
    wanInfo: {
      pppoeUsernameMasked: "rohit***",
      ipAddress: "10.10.10.13",
      uptimeSeconds: 92833,
      wanMode: "pppoe",
      sessionStatus: "up",
      vlanId: 130
    },
    lanInfo: {
      routerIp: "192.168.10.1",
      dhcpEnabled: true,
      leasedClients: 11,
      ethernetPortsUp: 2
    },
    opticalInfo: {
      rxPower: -17.4,
      txPower: 2.4,
      lastMeasuredAt: new Date()
    }
  }
];

const invoices = [
  {
    invoiceId: "INV-1001",
    invoiceNumber: "JF-INV-1001",
    customerId: "CUST-1001",
    serviceId: "SVC-1001",
    billCycle: "2026-03",
    generatedAt: new Date("2026-03-01T00:00:00.000Z"),
    dueDate: new Date("2026-03-28T00:00:00.000Z"),
    amount: 677,
    taxAmount: 122,
    totalAmount: 799,
    paymentStatus: "paid",
    status: "generated",
    pdfUrl: "https://billing.justfiber.example/invoices/JF-INV-1001.pdf"
  },
  {
    invoiceId: "INV-1002",
    invoiceNumber: "JF-INV-1002",
    customerId: "CUST-1002",
    serviceId: "SVC-1002",
    billCycle: "2026-03",
    generatedAt: new Date("2026-03-01T00:00:00.000Z"),
    dueDate: new Date("2026-03-10T00:00:00.000Z"),
    amount: 1016,
    taxAmount: 183,
    totalAmount: 1199,
    paymentStatus: "overdue",
    status: "generated",
    pdfUrl: "https://billing.justfiber.example/invoices/JF-INV-1002.pdf"
  },
  {
    invoiceId: "INV-1003",
    invoiceNumber: "JF-INV-1003",
    customerId: "CUST-1003",
    serviceId: "SVC-1003",
    billCycle: "2026-03",
    generatedAt: new Date("2026-03-02T00:00:00.000Z"),
    dueDate: new Date("2026-04-02T00:00:00.000Z"),
    amount: 1270,
    taxAmount: 229,
    totalAmount: 1499,
    paymentStatus: "paid",
    status: "generated",
    pdfUrl: "https://billing.justfiber.example/invoices/JF-INV-1003.pdf"
  }
];

const payments = [
  {
    transactionId: "PAY-1001",
    customerId: "CUST-1001",
    serviceId: "SVC-1001",
    invoiceId: "INV-1001",
    provider: "internal_platform",
    amount: 799,
    status: "success",
    paidAt: new Date("2026-03-05T09:00:00.000Z"),
    method: "upi",
    reference: "INT-443210"
  },
  {
    transactionId: "PAY-1003",
    customerId: "CUST-1003",
    serviceId: "SVC-1003",
    invoiceId: "INV-1003",
    provider: "internal_platform",
    amount: 1499,
    status: "success",
    paidAt: new Date("2026-03-07T17:15:00.000Z"),
    method: "card",
    reference: "INT-443399"
  }
];

const networkNodes = [
  {
    nodeId: "BNG-LKO-01",
    nodeType: "bng",
    name: "Lucknow BNG 01",
    area: "Lucknow Core",
    vendor: "MikroTik",
    managementIp: "10.255.0.1",
    status: "up",
    uptimeSeconds: 864000,
    cpuUsagePercent: 41,
    memoryUsagePercent: 56,
    activeSessions: 8421,
    sessionCapacity: 12000,
    alarms: [],
    lastHeartbeatAt: new Date()
  },
  {
    nodeId: "BNG-LKO-02",
    nodeType: "bng",
    name: "Lucknow BNG 02",
    area: "Lucknow Core",
    vendor: "Juniper",
    managementIp: "10.255.0.2",
    status: "degraded",
    uptimeSeconds: 533000,
    cpuUsagePercent: 78,
    memoryUsagePercent: 72,
    activeSessions: 11620,
    sessionCapacity: 12000,
    alarms: ["High session utilization"],
    lastHeartbeatAt: new Date()
  },
  {
    nodeId: "OLT-GN-01",
    nodeType: "olt",
    name: "Gomti Nagar OLT 01",
    area: "Gomti Nagar",
    vendor: "Huawei",
    managementIp: "10.20.1.10",
    status: "up",
    uptimeSeconds: 1200000,
    cpuUsagePercent: 29,
    memoryUsagePercent: 48,
    activeSessions: 1488,
    sessionCapacity: 2048,
    rxPowerAverage: -19.8,
    txPowerAverage: 2.1,
    alarms: [],
    lastHeartbeatAt: new Date()
  }
];

const tickets = [
  {
    ticketNumber: "TKT-20260315-1001",
    customerId: "CUST-1002",
    serviceId: "SVC-1002",
    source: "admin",
    category: "connectivity",
    priority: "high",
    status: "open",
    subject: "No internet after billing suspension",
    description: "Customer wants confirmation on resume flow after payment.",
    timeline: [
      {
        type: "created",
        actorType: "system",
        actorId: "seed",
        note: "Seeded sample ticket"
      }
    ]
  },
  {
    ticketNumber: "TKT-20260315-1002",
    customerId: "CUST-1001",
    serviceId: "SVC-1001",
    source: "admin",
    category: "wifi",
    priority: "medium",
    status: "assigned",
    subject: "Slow Wi-Fi in bedroom",
    description: "Customer reports signal drop on 5 GHz band.",
    timeline: [
      {
        type: "created",
        actorType: "system",
        actorId: "seed",
        note: "Seeded sample ticket"
      }
    ]
  }
];

const installers = [
  {
    installerCode: "INS-1001",
    fullName: "Ravi Chauhan",
    phone: "9000000001",
    email: "ravi.installer@example.com",
    password: "Installer123!",
    status: "active",
    availabilityStatus: "available",
    assignedCity: "Lucknow",
    assignedZones: ["gomti-nagar"],
    skills: ["installation", "fault-repair"]
  },
  {
    installerCode: "INS-1002",
    fullName: "Farhan Ali",
    phone: "9000000002",
    email: "farhan.installer@example.com",
    password: "Installer123!",
    status: "active",
    availabilityStatus: "busy",
    assignedCity: "Lucknow",
    assignedZones: ["aliganj"],
    skills: ["fault-repair"]
  }
];

const salesAgents = [
  {
    agentCode: "SAL-1001",
    fullName: "Priya Sales",
    phone: "9111111111",
    email: "priya.sales@example.com",
    password: "Sales123!",
    assignedAreas: ["gomti-nagar", "aliganj"]
  }
];

const adminUsers = [
  {
    username: "noc",
    fullName: "NOC Control User",
    email: "noc@justfiber.in",
    password: "Netlayer@1411",
    roles: ["noc_admin"]
  },
  {
    username: "sales",
    fullName: "Sales Control User",
    email: "sales@justfiber.in",
    password: "Netlayer@1411",
    roles: ["sales_admin"]
  },
  {
    username: "support",
    fullName: "Support Control User",
    email: "support@justfiber.in",
    password: "Netlayer@1411",
    roles: ["support_admin"]
  }
];

const plans = [
  {
    planCode: "PLAN-100",
    name: "100 Mbps Unlimited",
    speedMbps: 100,
    monthlyPrice: 799,
    otcCharge: 499,
    taxIncluded: true,
    features: { voiceIncluded: false, ottIncluded: true, ottProviders: ["SonyLIV"] },
    staticBenefits: ["Unlimited data", "Free Wi-Fi setup", "OTT included"],
    sortOrder: 1
  },
  {
    planCode: "PLAN-200",
    name: "200 Mbps Family",
    speedMbps: 200,
    monthlyPrice: 1199,
    otcCharge: 499,
    taxIncluded: true,
    features: { voiceIncluded: true, ottIncluded: true, ottProviders: ["SonyLIV", "Zee5"] },
    staticBenefits: ["Family speed pack", "Voice bundle", "Dual-band Wi-Fi"],
    sortOrder: 2
  }
];

const banners = [
  {
    title: "Upgrade to 200 Mbps Family",
    imageUrl: "https://cdn.justfiber.example/banner-200.jpg",
    targetType: "plan",
    targetValue: "PLAN-200",
    audience: "all",
    active: true,
    sortOrder: 1
  }
];

const addons = [
  {
    addonCode: "ADDON-WIFI-EXT",
    name: "Wi-Fi Extender",
    category: "wifi",
    price: 1999,
    description: "Improve indoor Wi-Fi coverage for larger homes."
  },
  {
    addonCode: "ADDON-ROUTER-UP",
    name: "Router Upgrade",
    category: "router",
    price: 2499,
    description: "Upgrade to a higher-performance dual-band router."
  },
  {
    addonCode: "ADDON-LAN-PATCH",
    name: "LAN / OFC Patch Cord",
    category: "cabling",
    price: 299,
    description: "Request additional LAN or OFC patch cord."
  }
];

async function main() {
  await connectMongo();
  await seedSystemData();

  // Clean up legacy unique indexes from older schema versions before seeding.
  for (const collectionName of ["installers", "customers"]) {
    const collection = (await import("mongoose")).default.connection.collection(collectionName);
    const indexes = await collection.indexes();
    const hasLegacyMobileIndex = indexes.some((index) => index.name === "mobile_1");
    if (hasLegacyMobileIndex) {
      await collection.dropIndex("mobile_1");
    }
  }

  for (const adminUser of adminUsers) {
    const passwordHash = await argon2.hash(adminUser.password);
    await AdminUser.updateOne(
      { username: adminUser.username },
      {
        $set: {
          username: adminUser.username,
          fullName: adminUser.fullName,
          email: adminUser.email,
          passwordHash,
          roles: adminUser.roles,
          status: "active"
        }
      },
      { upsert: true }
    );
  }

  const installerRecords = [];
  for (const installer of installers) {
    const passwordHash = await argon2.hash(installer.password);
    await Installer.updateOne(
      { installerCode: installer.installerCode },
      {
        $set: {
          installerCode: installer.installerCode,
          fullName: installer.fullName,
          phone: installer.phone,
          email: installer.email,
          passwordHash,
          status: installer.status,
          availabilityStatus: installer.availabilityStatus,
          assignedCity: installer.assignedCity,
          assignedZones: installer.assignedZones,
          skills: installer.skills,
          roles: ["installer"]
        }
      },
      { upsert: true }
    );
    installerRecords.push(await Installer.findOne({ installerCode: installer.installerCode }));
  }

  for (const salesAgent of salesAgents) {
    const passwordHash = await argon2.hash(salesAgent.password);
    await SalesAgent.updateOne(
      { agentCode: salesAgent.agentCode },
      {
        $set: {
          agentCode: salesAgent.agentCode,
          fullName: salesAgent.fullName,
          phone: salesAgent.phone,
          email: salesAgent.email,
          passwordHash,
          status: "active",
          assignedAreas: salesAgent.assignedAreas
        }
      },
      { upsert: true }
    );
  }

  for (const customer of customers) {
    await Customer.updateOne(
      { customerId: customer.customerId },
      { $set: customer },
      { upsert: true }
    );
  }

  await CustomerUser.updateOne(
    { mobile: "9876543210" },
    {
      $set: {
        mobile: "9876543210",
        email: "amit@example.com",
        fullName: "Amit Singh",
        authMode: "mobile_otp",
        linkedCustomerIds: ["CUST-1001"],
        state: "active_customer"
      }
    },
    { upsert: true }
  );

  const customerUser = await CustomerUser.findOne({ mobile: "9876543210" });

  for (const plan of plans) {
    await PlanCatalog.updateOne(
      { planCode: plan.planCode },
      { $set: plan },
      { upsert: true }
    );
  }

  for (const banner of banners) {
    await AppBanner.updateOne(
      { title: banner.title },
      { $set: banner },
      { upsert: true }
    );
  }

  for (const addon of addons) {
    await AddonCatalog.updateOne(
      { addonCode: addon.addonCode },
      { $set: { ...addon, active: true } },
      { upsert: true }
    );
  }

  await ServiceabilityZone.updateOne(
    { zoneName: "Gomti Nagar" },
    {
      $set: {
        zoneName: "Gomti Nagar",
        city: "Lucknow",
        area: "Gomti Nagar",
        status: "active",
        serviceType: "fiber",
        priority: 1,
        polygonGeoJson: {
          type: "Polygon",
          coordinates: [[[80.94, 26.84], [80.95, 26.84], [80.95, 26.85], [80.94, 26.85], [80.94, 26.84]]]
        }
      }
    },
    { upsert: true }
  );

  for (const device of devices) {
    await DeviceOperationalCache.updateOne(
      { deviceId: device.deviceId },
      { $set: device },
      { upsert: true }
    );
  }

  for (const invoice of invoices) {
    await BillingInvoice.updateOne(
      { invoiceId: invoice.invoiceId },
      { $set: invoice },
      { upsert: true }
    );
  }

  for (const payment of payments) {
    await PaymentTransaction.updateOne(
      { transactionId: payment.transactionId },
      { $set: payment },
      { upsert: true }
    );
  }

  for (const node of networkNodes) {
    await NetworkNodeStatus.updateOne(
      { nodeId: node.nodeId },
      { $set: node },
      { upsert: true }
    );
  }

  for (const ticket of tickets) {
    await SupportTicket.updateOne(
      { ticketNumber: ticket.ticketNumber },
      { $set: ticket },
      { upsert: true }
    );
  }

  const priya = await SalesAgent.findOne({ agentCode: "SAL-1001" });
  const lead = await Lead.findOneAndUpdate(
    { leadNumber: "LD100101" },
    {
      $set: {
        leadNumber: "LD100101",
        type: "sales_created",
        status: "kyc_pending",
        source: "field_sales",
        salesAgentId: priya?._id,
        fullName: "Vikram Lead",
        mobile: "9222222222",
        email: "vikram.lead@example.com",
        address: "Aliganj, Lucknow",
        pinCode: "226024",
        gps: { lat: 26.88, lng: 80.95 },
        feasible: true,
        selectedPlan: {
          planCode: "PLAN-100",
          planName: "100 Mbps Unlimited",
          amount: 1298
        }
      }
    },
    { upsert: true, new: true }
  );

  await LeadKycDocument.updateOne(
    { leadId: lead._id, documentType: "aadhaar" },
    {
      $set: {
        leadId: lead._id,
        documentType: "aadhaar",
        documentNumber: "XXXX-XXXX-1234",
        frontImageUrl: "https://cdn.justfiber.example/kyc/aadhaar-front.jpg",
        verificationStatus: "pending"
      }
    },
    { upsert: true }
  );

  const ravi = installerRecords[0];
  const farhan = installerRecords[1];

  const installerJobs = [
    {
      jobNumber: "JOB-20260315-1001",
      type: "installation",
      customerId: "CUST-1001",
      serviceId: "SVC-1001",
      installerId: ravi._id,
      priority: "high",
      status: "assigned",
      customerSnapshot: {
        fullName: "Amit Singh",
        phone: "9876543210",
        address: "Gomti Nagar, Lucknow",
        location: { mapUrl: "https://maps.google.com/?q=26.8467,80.9462" },
        planName: "100 Mbps Unlimited"
      },
      timeline: [{ event: "job.assigned", actorType: "system", actorId: "seed", note: "Seeded installation job" }]
    },
    {
      jobNumber: "JOB-20260315-1002",
      type: "complaint",
      customerId: "CUST-1002",
      serviceId: "SVC-1002",
      installerId: farhan._id,
      priority: "urgent",
      status: "complaint_in_progress",
      customerSnapshot: {
        fullName: "Sara Khan",
        phone: "9876543211",
        address: "Aliganj, Lucknow",
        location: { mapUrl: "https://maps.google.com/?q=26.8890,80.9460" },
        planName: "200 Mbps Family"
      },
      complaint: {
        category: "router_faulty",
        description: "Router not powering on"
      },
      opticalReadings: {
        rxPower: -23.4,
        txPower: 2.1,
        measuredAt: new Date(),
        healthStatus: "warning"
      },
      timeline: [{ event: "complaint.assigned", actorType: "system", actorId: "seed", note: "Seeded complaint job" }]
    }
  ];

  for (const installerJob of installerJobs) {
    await InstallerJob.updateOne(
      { jobNumber: installerJob.jobNumber },
      { $set: installerJob },
      { upsert: true }
    );
  }

  for (const installer of installerRecords) {
    await InstallerNotification.updateOne(
      { installerId: installer._id, title: "Welcome to Installer App" },
      {
        $set: {
          installerId: installer._id,
          type: "new_job",
          title: "Welcome to Installer App",
          body: `Installer ${installer.fullName} can now receive assignments.`,
          payload: {}
        }
      },
      { upsert: true }
    );
  }

  if (customerUser) {
    await CustomerNotification.updateOne(
      { customerUserId: customerUser._id, title: "Installation scheduled" },
      {
        $set: {
          customerUserId: customerUser._id,
          type: "booking",
          title: "Installation scheduled",
          body: "Your Justfiber installation is scheduled and assigned to an installer.",
          payload: { bookingNumber: "JF123456" }
        }
      },
      { upsert: true }
    );

    await CustomerNotification.updateOne(
      { customerUserId: customerUser._id, title: "March bill generated" },
      {
        $set: {
          customerUserId: customerUser._id,
          type: "billing",
          title: "March bill generated",
          body: "Your latest invoice is available in the billing section.",
          payload: { invoiceNumber: "JF-INV-1001" }
        }
      },
      { upsert: true }
    );

    await ServiceRequest.updateOne(
      { requestNumber: "SR100001" },
      {
        $set: {
          requestNumber: "SR100001",
          customerUserId: customerUser._id,
          customerId: "CUST-1001",
          serviceId: "SVC-1001",
          type: "plan_change",
          status: "in_progress",
          payload: {
            planCode: "PLAN-200",
            planName: "200 Mbps Family",
            effectiveMode: "next_cycle"
          },
          timeline: [{ event: "request.created", actorType: "system", actorId: "seed", at: new Date() }]
        }
      },
      { upsert: true }
    );
  }

  await SystemConfig.updateOne(
    { key: "admin.ui.default_preview_mode" },
    {
      $set: {
        key: "admin.ui.default_preview_mode",
        category: "ui",
        valueType: "string",
        value: "live",
        version: 1
      }
    },
    { upsert: true }
  );

  const totalCustomers = await Customer.countDocuments();
  const suspendedCustomers = await Customer.countDocuments({ operationalStatus: "suspended" });
  const offlineDevices = await DeviceOperationalCache.countDocuments({ onlineStatus: "offline" });
  const openCriticalTickets = await SupportTicket.countDocuments({
    status: { $in: ["open", "assigned", "in_progress"] },
    priority: "critical"
  });

  await DashboardSnapshot.create({
    snapshotType: "executive",
    intervalStart: new Date(Date.now() - 1000 * 60 * 60),
    intervalEnd: new Date(),
    metrics: {
      totalCustomers,
      suspendedCustomers,
      offlineDevices,
      openCriticalTickets
    },
    generatedAt: new Date()
  });

  await DashboardSnapshot.create({
    snapshotType: "network",
    intervalStart: new Date(Date.now() - 1000 * 60 * 60),
    intervalEnd: new Date(),
    metrics: {
      bngsUp: 1,
      bngsDown: 0,
      oltsUp: 1,
      totalNodes: 3,
      devicesOnline: 2,
      devicesOffline: 1
    },
    generatedAt: new Date()
  });

  await DashboardSnapshot.create({
    snapshotType: "billing",
    intervalStart: new Date(Date.now() - 1000 * 60 * 60),
    intervalEnd: new Date(),
    metrics: {
      totalInvoices: 3,
      overdueInvoices: 1,
      paidTransactions: 2,
      dueAmount: 1199,
      collectedAmount: 2298
    },
    generatedAt: new Date()
  });

  console.log("Sample admin preview data seeded.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
