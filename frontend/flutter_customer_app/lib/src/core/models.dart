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

class CustomerConnection {
  const CustomerConnection({
    required this.customerId,
    required this.serviceId,
    required this.accountNumber,
    required this.fullName,
    required this.mobile,
    required this.email,
    required this.planName,
    required this.status,
    required this.dueAmount,
    required this.paymentStatus,
    required this.billMode,
    required this.wifiName,
    required this.onlineStatus,
    required this.address,
  });

  final String customerId;
  final String serviceId;
  final String accountNumber;
  final String fullName;
  final String mobile;
  final String email;
  final String planName;
  final String status;
  final double dueAmount;
  final String paymentStatus;
  final String billMode;
  final String wifiName;
  final String onlineStatus;
  final String address;
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
    required this.billingStatus,
    required this.serviceStatus,
    required this.billingAlert,
    required this.billingAlertTone,
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
  final String billingStatus;
  final String serviceStatus;
  final String billingAlert;
  final String billingAlertTone;
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
    required this.recurringAmount,
    required this.nextBillDate,
    required this.lastPaymentAmount,
    required this.billCycle,
    required this.billMode,
    required this.generatedDate,
    required this.paymentStatus,
    required this.latestInvoiceNumber,
    required this.latestInvoiceStatus,
    required this.invoiceCount,
    required this.serviceStatus,
    required this.lastDueReminderAt,
    required this.lastOverdueReminderAt,
    required this.lastSuspensionWarningAt,
    required this.promiseToPayAt,
    required this.promiseAmount,
    required this.promiseNote,
    required this.lastPaymentDate,
    required this.adjustmentPreview,
    required this.speedMbps,
    required this.uploadSpeedMbps,
    required this.dataPolicy,
    required this.dataLimitGb,
    required this.fupSpeedMbps,
    required this.usageGb,
    required this.usageCapGb,
    required this.usageCapReached,
    required this.usageCycleStartedAt,
    required this.usageLastUpdatedAt,
    required this.pendingPlanChange,
    required this.invoices,
    required this.payments,
    required this.notes,
  });

  final String currentPlan;
  final double dueAmount;
  final double recurringAmount;
  final String nextBillDate;
  final double lastPaymentAmount;
  final String billCycle;
  final String billMode;
  final String generatedDate;
  final String paymentStatus;
  final String latestInvoiceNumber;
  final String latestInvoiceStatus;
  final int invoiceCount;
  final String serviceStatus;
  final String lastDueReminderAt;
  final String lastOverdueReminderAt;
  final String lastSuspensionWarningAt;
  final String promiseToPayAt;
  final double promiseAmount;
  final String promiseNote;
  final String lastPaymentDate;
  final double adjustmentPreview;
  final double speedMbps;
  final double uploadSpeedMbps;
  final String dataPolicy;
  final double dataLimitGb;
  final double fupSpeedMbps;
  final double usageGb;
  final double usageCapGb;
  final bool usageCapReached;
  final String usageCycleStartedAt;
  final String usageLastUpdatedAt;
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
    required this.viewUrl,
    required this.pdfUrl,
  });

  final String invoiceNumber;
  final double totalAmount;
  final String generatedAt;
  final String dueDate;
  final String paymentStatus;
  final String viewUrl;
  final String pdfUrl;
}

class BillingPaymentItem {
  const BillingPaymentItem({
    required this.transactionId,
    required this.amount,
    required this.paidAt,
    required this.provider,
    required this.reference,
    required this.viewUrl,
    required this.pdfUrl,
  });

  final String transactionId;
  final double amount;
  final String paidAt;
  final String provider;
  final String reference;
  final String viewUrl;
  final String pdfUrl;
}

class BillingNoteItem {
  const BillingNoteItem({
    required this.noteNumber,
    required this.type,
    required this.totalAmount,
    required this.reason,
    required this.issuedAt,
    required this.viewUrl,
    required this.pdfUrl,
  });

  final String noteNumber;
  final String type;
  final double totalAmount;
  final String reason;
  final String issuedAt;
  final String viewUrl;
  final String pdfUrl;
}

class RequestItem {
  const RequestItem({
    required this.id,
    required this.referenceNumber,
    required this.title,
    required this.type,
    required this.note,
    required this.latestUpdateNote,
    required this.latestUpdateAt,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String referenceNumber;
  final String title;
  final String type;
  final String note;
  final String latestUpdateNote;
  final String latestUpdateAt;
  final String status;
  final String createdAt;
}

class NotificationItem {
  const NotificationItem({
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
  final String createdAt;
  final String readAt;
  final Map<String, dynamic> payload;
}

class SupportTicketItem {
  const SupportTicketItem({
    required this.id,
    required this.ticketNumber,
    required this.category,
    required this.subject,
    required this.description,
    required this.latestUpdateNote,
    required this.latestUpdateAt,
    required this.status,
    required this.priority,
    required this.createdAt,
  });

  final String id;
  final String ticketNumber;
  final String category;
  final String subject;
  final String description;
  final String latestUpdateNote;
  final String latestUpdateAt;
  final String status;
  final String priority;
  final String createdAt;
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
    required this.uploadSpeedMbps,
    required this.dataLimitGb,
    required this.fupSpeedMbps,
    required this.dataPolicy,
    required this.monthlyPrice,
    required this.quarterlyPrice,
    required this.halfYearlyPrice,
    required this.yearlyPrice,
    required this.otcCharge,
    required this.installationCharge,
    required this.category,
    required this.taxIncluded,
    required this.gstRate,
    required this.pricesExcludeGst,
    required this.tags,
    required this.staticBenefits,
    required this.features,
    required this.validityMonthly,
    required this.validityQuarterly,
    required this.validityHalfYearly,
    required this.validityYearly,
  });

  final String planCode;
  final String name;
  final double speedMbps;
  final double uploadSpeedMbps;
  final double dataLimitGb;
  final double fupSpeedMbps;
  final String dataPolicy;
  final double monthlyPrice;
  final double quarterlyPrice;
  final double halfYearlyPrice;
  final double yearlyPrice;
  final double otcCharge;
  final double installationCharge;
  final String category;
  final bool taxIncluded;
  final double gstRate;
  final bool pricesExcludeGst;
  final List<String> tags;
  final List<String> staticBenefits;
  final List<String> features;
  final bool validityMonthly;
  final bool validityQuarterly;
  final bool validityHalfYearly;
  final bool validityYearly;
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
    required this.preferredDate,
    required this.preferredSlotLabel,
    required this.durationMonths,
    required this.durationLabel,
  });

  final String bookingNumber;
  final String status;
  final String planName;
  final double amount;
  final String currentStep;
  final String preferredDate;
  final String preferredSlotLabel;
  final int durationMonths;
  final String durationLabel;

  BookingQuote copyWith({
    String? bookingNumber,
    String? status,
    String? planName,
    double? amount,
    String? currentStep,
    String? preferredDate,
    String? preferredSlotLabel,
    int? durationMonths,
    String? durationLabel,
  }) {
    return BookingQuote(
      bookingNumber: bookingNumber ?? this.bookingNumber,
      status: status ?? this.status,
      planName: planName ?? this.planName,
      amount: amount ?? this.amount,
      currentStep: currentStep ?? this.currentStep,
      preferredDate: preferredDate ?? this.preferredDate,
      preferredSlotLabel: preferredSlotLabel ?? this.preferredSlotLabel,
      durationMonths: durationMonths ?? this.durationMonths,
      durationLabel: durationLabel ?? this.durationLabel,
    );
  }
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

class InstallerVisitItem {
  const InstallerVisitItem({
    required this.jobNumber,
    required this.type,
    required this.status,
    required this.priority,
    required this.createdAt,
    required this.completedAt,
    required this.installerName,
    required this.installerPhone,
    required this.planName,
    required this.planCode,
    required this.planCategory,
    required this.planTags,
    required this.lastUpdateAt,
    required this.lastUpdateNote,
    required this.latestEventCode,
    required this.mapUrl,
    required this.etaText,
    required this.configStatus,
    required this.proofUploadedAt,
    required this.routerPhotoUploaded,
    required this.cablePhotoUploaded,
    required this.completionOtpVerifiedAt,
    required this.wifiSsid24,
    required this.wifiSsid5,
    required this.complaintResolutionCode,
    required this.complaintResolutionNote,
    required this.complaintReplacedDevice,
    required this.oldSerialNumber,
    required this.newSerialNumber,
  });

  final String jobNumber;
  final String type;
  final String status;
  final String priority;
  final String createdAt;
  final String completedAt;
  final String installerName;
  final String installerPhone;
  final String planName;
  final String planCode;
  final String planCategory;
  final List<String> planTags;
  final String lastUpdateAt;
  final String lastUpdateNote;
  final String latestEventCode;
  final String mapUrl;
  final String etaText;
  final String configStatus;
  final String proofUploadedAt;
  final bool routerPhotoUploaded;
  final bool cablePhotoUploaded;
  final String completionOtpVerifiedAt;
  final String wifiSsid24;
  final String wifiSsid5;
  final String complaintResolutionCode;
  final String complaintResolutionNote;
  final bool complaintReplacedDevice;
  final String oldSerialNumber;
  final String newSerialNumber;
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

class SupportDiagnosis {
  const SupportDiagnosis({
    required this.issueType,
    required this.diagnosisCode,
    required this.headline,
    required this.summary,
    required this.internetStatus,
    required this.wifiStatus,
    required this.lineStatus,
    required this.recommendation,
    required this.needsTicket,
    required this.steps,
    required this.opticalRxPower,
    required this.latencyMs,
    required this.packetLossPercent,
    required this.estimatedSpeedMbps,
  });

  final String issueType;
  final String diagnosisCode;
  final String headline;
  final String summary;
  final String internetStatus;
  final String wifiStatus;
  final String lineStatus;
  final String recommendation;
  final bool needsTicket;
  final List<String> steps;
  final double? opticalRxPower;
  final double latencyMs;
  final double packetLossPercent;
  final double estimatedSpeedMbps;
}
