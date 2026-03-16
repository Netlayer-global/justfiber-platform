class CustomerSession {
  const CustomerSession({
    required this.mobile,
    required this.accessToken,
    required this.refreshToken,
  });

  final String mobile;
  final String accessToken;
  final String refreshToken;
}

class DashboardData {
  const DashboardData({
    required this.customerName,
    required this.planName,
    required this.walletBalance,
    required this.usedGb,
    required this.totalGb,
    required this.points,
    required this.activeDays,
    required this.wifiName,
    required this.billingDue,
  });

  final String customerName;
  final String planName;
  final double walletBalance;
  final double usedGb;
  final double totalGb;
  final int points;
  final int activeDays;
  final String wifiName;
  final double billingDue;
}

class WifiData {
  const WifiData({
    required this.ssid24,
    required this.ssid5,
    required this.passwordMask,
    required this.paused,
  });

  final String ssid24;
  final String ssid5;
  final String passwordMask;
  final bool paused;
}

class BillingData {
  const BillingData({
    required this.currentPlan,
    required this.dueAmount,
    required this.nextBillDate,
    required this.lastPaymentAmount,
  });

  final String currentPlan;
  final double dueAmount;
  final String nextBillDate;
  final double lastPaymentAmount;
}

class RequestItem {
  const RequestItem({
    required this.title,
    required this.status,
    required this.createdAt,
  });

  final String title;
  final String status;
  final String createdAt;
}

class NotificationItem {
  const NotificationItem({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;
}

class FaqItem {
  const FaqItem({
    required this.question,
    required this.answer,
  });

  final String question;
  final String answer;
}

class AddonItem {
  const AddonItem({
    required this.name,
    required this.description,
  });

  final String name;
  final String description;
}
