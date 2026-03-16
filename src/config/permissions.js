export const permissions = {
  adminUserManage: "admin.user.manage",
  adminRoleManage: "admin.role.manage",
  customerRead: "customer.read",
  customerSuspend: "customer.suspend",
  customerResume: "customer.resume",
  customerRetryProvisioning: "customer.retry_provisioning",
  deviceRead: "device.read",
  deviceApplyPreset: "device.apply_preset",
  billingRead: "billing.read",
  ticketRead: "ticket.read",
  ticketWrite: "ticket.write",
  ticketAssign: "ticket.assign",
  ticketResolve: "ticket.resolve",
  configRead: "config.read",
  configUpdate: "config.update",
  auditRead: "audit.read",
  approvalRead: "approval.read",
  approvalDecide: "approval.decide",
  dashboardRead: "dashboard.read",
  installerRead: "installer.read",
  installerManage: "installer.manage",
  installerJobRead: "installer.job.read",
  installerJobManage: "installer.job.manage",
  installerAppAccess: "installer.app.access"
};

export const systemRoles = [
  {
    code: "super_admin",
    name: "Super Admin",
    permissions: Object.values(permissions)
  },
  {
    code: "ops_admin",
    name: "Operations Admin",
    permissions: [
      permissions.customerRead,
      permissions.customerSuspend,
      permissions.customerResume,
      permissions.customerRetryProvisioning,
      permissions.deviceRead,
      permissions.deviceApplyPreset,
      permissions.ticketRead,
      permissions.ticketWrite,
      permissions.ticketAssign,
      permissions.ticketResolve,
      permissions.approvalRead,
      permissions.dashboardRead,
      permissions.installerRead,
      permissions.installerJobRead,
      permissions.installerJobManage
    ]
  },
  {
    code: "noc_admin",
    name: "NOC Admin",
    permissions: [
      permissions.dashboardRead,
      permissions.deviceRead,
      permissions.deviceApplyPreset,
      permissions.customerRead,
      permissions.installerRead,
      permissions.installerJobRead,
      permissions.auditRead
    ]
  },
  {
    code: "sales_admin",
    name: "Sales Admin",
    permissions: [
      permissions.dashboardRead,
      permissions.customerRead,
      permissions.installerRead,
      permissions.installerJobRead
    ]
  },
  {
    code: "support_admin",
    name: "Support Admin",
    permissions: [
      permissions.dashboardRead,
      permissions.customerRead,
      permissions.ticketRead,
      permissions.ticketWrite,
      permissions.ticketAssign,
      permissions.ticketResolve,
      permissions.installerJobRead
    ]
  },
  {
    code: "support_agent",
    name: "Support Agent",
    permissions: [
      permissions.customerRead,
      permissions.deviceRead,
      permissions.ticketRead,
      permissions.ticketWrite,
      permissions.ticketAssign,
      permissions.ticketResolve,
      permissions.dashboardRead,
      permissions.installerJobRead
    ]
  },
  {
    code: "installer_manager",
    name: "Installer Manager",
    permissions: [
      permissions.dashboardRead,
      permissions.installerRead,
      permissions.installerManage,
      permissions.installerJobRead,
      permissions.installerJobManage
    ]
  },
  {
    code: "installer",
    name: "Installer",
    permissions: [
      permissions.installerAppAccess
    ]
  },
  {
    code: "auditor",
    name: "Auditor",
    permissions: [
      permissions.customerRead,
      permissions.deviceRead,
      permissions.auditRead,
      permissions.approvalRead,
      permissions.dashboardRead,
      permissions.configRead,
      permissions.billingRead,
      permissions.ticketRead,
      permissions.installerRead,
      permissions.installerJobRead
    ]
  }
];
