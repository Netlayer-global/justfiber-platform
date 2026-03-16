export const demoOverview = {
  executive: {
    totalCustomers: 8240,
    suspendedCustomers: 142,
    offlineDevices: 289,
    openCriticalTickets: 18
  },
  billing: {
    totalInvoices: 6132,
    overdueInvoices: 384,
    paidTransactions: 5420,
    dueAmount: 1842000,
    collectedAmount: 6215000
  },
  network: {
    bngsUp: 6,
    bngsDown: 1,
    oltsUp: 23,
    totalNodes: 34,
    devicesOnline: 6920,
    devicesOffline: 517
  }
};

export const demoSales = {
  leadCount: 264,
  bookingCount: 91,
  kycPending: 23,
  salesAgents: 14
};

export const demoInvoices = [
  { invoiceNumber: "INV-10028", customerId: "JF102812", totalAmount: 1299, paymentStatus: "overdue", generatedAt: "2026-03-14" },
  { invoiceNumber: "INV-10027", customerId: "JF102744", totalAmount: 899, paymentStatus: "pending", generatedAt: "2026-03-14" },
  { invoiceNumber: "INV-10026", customerId: "JF102631", totalAmount: 1599, paymentStatus: "paid", generatedAt: "2026-03-13" }
];

export const demoPayments = [
  { referenceId: "PAY-91822", customerId: "JF102812", amount: 1299, status: "success", createdAt: "2026-03-14" },
  { referenceId: "PAY-91811", customerId: "JF102744", amount: 899, status: "processing", createdAt: "2026-03-14" },
  { referenceId: "PAY-91752", customerId: "JF102631", amount: 1599, status: "success", createdAt: "2026-03-13" }
];

export const demoNodes = [
  { nodeName: "BNG-LKO-01", nodeType: "bng", status: "up", city: "Lucknow", updatedAt: "2026-03-16T16:10:00Z" },
  { nodeName: "OLT-LKO-04", nodeType: "olt", status: "up", city: "Lucknow", updatedAt: "2026-03-16T16:12:00Z" },
  { nodeName: "BNG-KNP-02", nodeType: "bng", status: "down", city: "Kanpur", updatedAt: "2026-03-16T15:58:00Z" }
];

export const demoDevices = [
  { deviceId: "240B88-G%2D2425G%2DA-ALCLB3DCCB87", customerId: "JF578397", onlineStatus: "online", ontBrand: "nokia" },
  { deviceId: "DSNW29-H660GM%2DA-DSNW295B5B70", customerId: "JF759779", onlineStatus: "online", ontBrand: "dasan" },
  { deviceId: "ZTE-ONT-1120", customerId: "JF102631", onlineStatus: "offline", ontBrand: "generic" }
];

export const demoCustomers = [
  { customerId: "JF578397", fullName: "Amit Singh", phone: "9876543210", operationalStatus: "active", currentPlanName: "JustFiber 100" },
  { customerId: "JF759779", fullName: "Riya Verma", phone: "9811102200", operationalStatus: "active", currentPlanName: "JustFiber 200" },
  { customerId: "JF102631", fullName: "Karan Yadav", phone: "9800112255", operationalStatus: "suspended", currentPlanName: "JustFiber 60" }
];

export const trendSeries = [
  { name: "Mon", revenue: 72, activations: 31, uptime: 98.2 },
  { name: "Tue", revenue: 88, activations: 42, uptime: 98.9 },
  { name: "Wed", revenue: 84, activations: 37, uptime: 99.1 },
  { name: "Thu", revenue: 93, activations: 45, uptime: 98.4 },
  { name: "Fri", revenue: 77, activations: 34, uptime: 97.7 },
  { name: "Sat", revenue: 81, activations: 39, uptime: 98.7 },
  { name: "Sun", revenue: 89, activations: 41, uptime: 99.0 }
];

export const brandDistribution = [
  { name: "Nokia", value: 48 },
  { name: "DASAN", value: 31 },
  { name: "ZTE", value: 21 }
];
