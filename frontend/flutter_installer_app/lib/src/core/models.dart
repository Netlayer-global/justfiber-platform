class InstallerSession {
  const InstallerSession({
    required this.login,
    required this.accessToken,
    required this.refreshToken,
  });

  final String login;
  final String accessToken;
  final String refreshToken;
}

class InstallerProfile {
  const InstallerProfile({
    required this.fullName,
    required this.installerCode,
    required this.phone,
    required this.availabilityStatus,
  });

  final String fullName;
  final String installerCode;
  final String phone;
  final String availabilityStatus;
}

class InstallerDashboard {
  const InstallerDashboard({
    required this.todayNewInstallationJobs,
    required this.pendingJobs,
    required this.completedJobs,
    required this.availabilityStatus,
  });

  final int todayNewInstallationJobs;
  final int pendingJobs;
  final int completedJobs;
  final String availabilityStatus;
}

class InstallerJob {
  const InstallerJob({
    required this.id,
    required this.jobNumber,
    required this.status,
    required this.subStatus,
    required this.customerName,
    required this.customerPhone,
    required this.customerAddress,
    required this.planName,
    required this.planCode,
    required this.planCategory,
    required this.monthlyPrice,
    required this.downloadSpeedMbps,
    required this.uploadSpeedMbps,
    required this.dataLimitGb,
    required this.fupSpeedMbps,
    required this.dataPolicy,
    required this.otcCharge,
    required this.installationCharge,
    required this.tags,
    required this.staticBenefits,
    required this.jobType,
    required this.priority,
    required this.scheduledAt,
    required this.latestEventCode,
    required this.configStatus,
    required this.finalSerialNumber,
    required this.rxPowerText,
    required this.opticalHealth,
    required this.latitude,
    required this.longitude,
    required this.mapUrl,
    required this.deferNote,
    required this.cancelNote,
    this.complaintCategory = '',
    this.complaintDescription = '',
  });

  final String id;
  final String jobNumber;
  final String status;
  final String subStatus;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String planName;
  final String planCode;
  final String planCategory;
  final double monthlyPrice;
  final double downloadSpeedMbps;
  final double uploadSpeedMbps;
  final double dataLimitGb;
  final double fupSpeedMbps;
  final String dataPolicy;
  final double otcCharge;
  final double installationCharge;
  final List<String> tags;
  final List<String> staticBenefits;
  final String jobType;
  final String priority;
  final String scheduledAt;
  final String latestEventCode;
  final String configStatus;
  final String finalSerialNumber;
  final String rxPowerText;
  final String opticalHealth;
  final double? latitude;
  final double? longitude;
  final String mapUrl;
  final String deferNote;
  final String cancelNote;
  final String complaintCategory;
  final String complaintDescription;
}

class ProvisioningPreview {
  const ProvisioningPreview({
    required this.brand,
    required this.pppoeUsername,
    required this.pppoePassword,
    required this.ssid24,
    required this.ssid5,
    required this.wifiPassword,
    required this.vlanId,
    required this.planCode,
    required this.planName,
    required this.planCategory,
    required this.monthlyPrice,
    required this.downloadSpeedMbps,
    required this.uploadSpeedMbps,
    required this.dataLimitGb,
    required this.fupSpeedMbps,
    required this.dataPolicy,
    required this.otcCharge,
    required this.installationCharge,
    required this.tags,
    required this.staticBenefits,
    required this.features,
  });

  final String brand;
  final String pppoeUsername;
  final String pppoePassword;
  final String ssid24;
  final String ssid5;
  final String wifiPassword;
  final int vlanId;
  final String planCode;
  final String planName;
  final String planCategory;
  final double monthlyPrice;
  final double downloadSpeedMbps;
  final double uploadSpeedMbps;
  final double dataLimitGb;
  final double fupSpeedMbps;
  final String dataPolicy;
  final double otcCharge;
  final double installationCharge;
  final List<String> tags;
  final List<String> staticBenefits;
  final List<String> features;
}

class InstallerNotificationItem {
  const InstallerNotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.readAt,
    required this.payload,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime? createdAt;
  final DateTime? readAt;
  final Map<String, dynamic> payload;
}

class InstallerFaultAlert {
  const InstallerFaultAlert({
    required this.id,
    required this.kind,
    required this.severity,
    required this.title,
    required this.message,
    required this.pathId,
    required this.assetId,
    required this.affectedAssets,
    required this.affectedCustomers,
    required this.rxPower,
    required this.status,
    required this.createdAt,
    required this.impactedItems,
  });

  final String id;
  final String kind;
  final String severity;
  final String title;
  final String message;
  final String pathId;
  final String assetId;
  final int affectedAssets;
  final int affectedCustomers;
  final double? rxPower;
  final String status;
  final DateTime? createdAt;
  final List<Map<String, dynamic>> impactedItems;
}

class SalesPlan {
  const SalesPlan({
    required this.planCode,
    required this.planName,
    required this.planCategory,
    required this.monthlyPrice,
    required this.otcCharge,
    required this.downloadSpeedMbps,
    required this.uploadSpeedMbps,
    required this.dataLimitGb,
    required this.dataPolicy,
    required this.tags,
  });

  final String planCode;
  final String planName;
  final String planCategory;
  final double monthlyPrice;
  final double otcCharge;
  final double downloadSpeedMbps;
  final double uploadSpeedMbps;
  final double dataLimitGb;
  final String dataPolicy;
  final List<String> tags;
}

class SalesLead {
  const SalesLead({
    required this.bookingNumber,
    required this.customerName,
    required this.customerPhone,
    required this.customerAddress,
    required this.planName,
    required this.planCode,
    required this.amount,
    required this.durationMonths,
    required this.status,
    required this.paymentMode,
    required this.paymentStatus,
    required this.createdAt,
  });

  final String bookingNumber;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String planName;
  final String planCode;
  final double amount;
  final int durationMonths;
  final String status;
  final String paymentMode;
  final String paymentStatus;
  final String createdAt;
}
