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
    required this.guestEnabled,
    required this.guestSsid,
    required this.connectedDevicesCount,
  });

  final String ssid24;
  final String ssid5;
  final String passwordMask;
  final bool paused;
  final bool guestEnabled;
  final String guestSsid;
  final int connectedDevicesCount;
}

class BillingData {
  const BillingData({
    required this.currentPlan,
    required this.dueAmount,
    required this.nextBillDate,
    required this.lastPaymentAmount,
    required this.billCycle,
    required this.billMode,
    required this.generatedDate,
    required this.paymentStatus,
    required this.lastPaymentDate,
    required this.adjustmentPreview,
    required this.pendingPlanChange,
    required this.invoices,
    required this.payments,
    required this.notes,
  });

  final String currentPlan;
  final double dueAmount;
  final String nextBillDate;
  final double lastPaymentAmount;
  final String billCycle;
  final String billMode;
  final String generatedDate;
  final String paymentStatus;
  final String lastPaymentDate;
  final double adjustmentPreview;
  final PendingPlanChange? pendingPlanChange;
  final List<BillingInvoiceItem> invoices;
  final List<BillingPaymentItem> payments;
  final List<BillingNoteItem> notes;
}

class BillingInvoiceItem {
  const BillingInvoiceItem({
    required this.invoiceNumber,
    required this.totalAmount,
    required this.generatedAt,
    required this.dueDate,
    required this.paymentStatus,
  });

  final String invoiceNumber;
  final double totalAmount;
  final String generatedAt;
  final String dueDate;
  final String paymentStatus;
}

class BillingPaymentItem {
  const BillingPaymentItem({
    required this.transactionId,
    required this.amount,
    required this.paidAt,
    required this.provider,
    required this.reference,
  });

  final String transactionId;
  final double amount;
  final String paidAt;
  final String provider;
  final String reference;
}

class BillingNoteItem {
  const BillingNoteItem({
    required this.noteNumber,
    required this.type,
    required this.totalAmount,
    required this.reason,
    required this.issuedAt,
  });

  final String noteNumber;
  final String type;
  final double totalAmount;
  final String reason;
  final String issuedAt;
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

class PlanItem {
  const PlanItem({
    required this.planCode,
    required this.name,
    required this.speedMbps,
    required this.monthlyPrice,
    required this.otcCharge,
  });

  final String planCode;
  final String name;
  final double speedMbps;
  final double monthlyPrice;
  final double otcCharge;
}

class PendingPlanChange {
  const PendingPlanChange({
    required this.planCode,
    required this.planName,
    required this.effectiveMode,
    required this.billMode,
    required this.currentPrice,
    required this.nextPrice,
    required this.requestedAt,
    required this.noteNumber,
  });

  final String planCode;
  final String planName;
  final String effectiveMode;
  final String billMode;
  final double currentPrice;
  final double nextPrice;
  final String requestedAt;
  final String noteNumber;
}

class PlanChangePreview {
  const PlanChangePreview({
    required this.customerId,
    required this.currentPlanCode,
    required this.nextPlanCode,
    required this.nextPlanName,
    required this.effectiveMode,
    required this.currentPrice,
    required this.nextPrice,
    required this.adjustmentAmount,
    required this.payableNow,
    required this.creditAmount,
    required this.remainingDays,
  });

  final String customerId;
  final String currentPlanCode;
  final String nextPlanCode;
  final String nextPlanName;
  final String effectiveMode;
  final double currentPrice;
  final double nextPrice;
  final double adjustmentAmount;
  final double payableNow;
  final double creditAmount;
  final int remainingDays;
}

class PlanChangeApplyResult {
  const PlanChangeApplyResult({
    required this.updated,
    required this.scheduled,
    required this.paymentRequired,
    required this.customerId,
    required this.planCode,
    required this.requestNumber,
    required this.payableNow,
  });

  final bool updated;
  final bool scheduled;
  final bool paymentRequired;
  final String customerId;
  final String planCode;
  final String requestNumber;
  final double payableNow;
}

class BookingQuote {
  const BookingQuote({
    required this.bookingNumber,
    required this.status,
    required this.planName,
    required this.amount,
    required this.currentStep,
  });

  final String bookingNumber;
  final String status;
  final String planName;
  final double amount;
  final String currentStep;
}

class FeasibilityResult {
  const FeasibilityResult({
    required this.feasible,
    required this.serviceStatus,
    required this.message,
  });

  final bool feasible;
  final String serviceStatus;
  final String message;
}

class BookingTrackingItem {
  const BookingTrackingItem({
    required this.code,
    required this.status,
    required this.at,
  });

  final String code;
  final String status;
  final String at;
}

class BookingTrackingData {
  const BookingTrackingData({
    required this.currentStep,
    required this.steps,
  });

  final String currentStep;
  final List<BookingTrackingItem> steps;
}

class ConnectedDevice {
  const ConnectedDevice({
    required this.clientId,
    required this.name,
    required this.connectionType,
    required this.signal,
    required this.blocked,
  });

  final String clientId;
  final String name;
  final String connectionType;
  final String signal;
  final bool blocked;
}

class ParentalRule {
  const ParentalRule({
    required this.targetName,
    required this.blocked,
    required this.startTime,
    required this.endTime,
  });

  final String targetName;
  final bool blocked;
  final String startTime;
  final String endTime;
}

class SpeedTestData {
  const SpeedTestData({
    required this.downloadMbps,
    required this.uploadMbps,
    required this.latencyMs,
    required this.packetLossPercent,
    required this.status,
  });

  final double downloadMbps;
  final double uploadMbps;
  final double latencyMs;
  final double packetLossPercent;
  final String status;
}

class NetworkQualityData {
  const NetworkQualityData({
    required this.latencyMs,
    required this.packetLossPercent,
    required this.jitterMs,
    required this.opticalRxPower,
    required this.quality,
  });

  final double latencyMs;
  final double packetLossPercent;
  final double jitterMs;
  final double opticalRxPower;
  final String quality;
}

class BillingPaymentOrder {
  const BillingPaymentOrder({
    required this.provider,
    required this.customerId,
    required this.orderId,
    required this.keyId,
    required this.amount,
    required this.amountPaise,
    required this.currency,
    required this.customerName,
    required this.customerEmail,
    required this.customerPhone,
  });

  final String provider;
  final String customerId;
  final String orderId;
  final String keyId;
  final double amount;
  final int amountPaise;
  final String currency;
  final String customerName;
  final String customerEmail;
  final String customerPhone;
}
