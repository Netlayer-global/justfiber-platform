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
    required this.customerName,
    required this.customerAddress,
    required this.jobType,
  });

  final String id;
  final String jobNumber;
  final String status;
  final String customerName;
  final String customerAddress;
  final String jobType;
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
  });

  final String brand;
  final String pppoeUsername;
  final String pppoePassword;
  final String ssid24;
  final String ssid5;
  final String wifiPassword;
  final int vlanId;
}

class InstallerNotificationItem {
  const InstallerNotificationItem({
    required this.id,
    required this.title,
    required this.body,
  });

  final String id;
  final String title;
  final String body;
}
