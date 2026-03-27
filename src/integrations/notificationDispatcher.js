import { env } from "../config/env.js";
import { IntegrationConnection } from "../models/IntegrationConnection.js";
import { IntegrationEventLog } from "../models/IntegrationEventLog.js";
import { BillingProfile } from "../models/BillingProfile.js";
import { NotificationEventPreference } from "../models/NotificationEventPreference.js";
import { providerAdapters } from "./providerAdapters.js";

function getDefaultEventChannels(eventKey) {
  const defaults = {
    verification_code: { sms: true },
    billing_invoice: { email: true, sms: true },
    invoice_due_date: { email: true, sms: true },
    unpaid_invoice: { email: true, sms: true },
    payment_retry: { email: true, sms: true },
    suspension_warning: { email: true, sms: true },
    account_suspension: { email: true, sms: true },
    paid_invoice: { email: true, sms: true },
    renewal: { email: true, sms: true },
    raising_ticket_notification: { email: true, sms: true },
    ticket_message: { push: true },
    user_discount: { email: true, sms: true },
    user_penalty: { email: true, sms: true }
  };
  return defaults[eventKey] || { push: true };
}

function normalizeZoneCode(value) {
  return String(value || "").trim().toUpperCase();
}

function formatAmount(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-IN");
}

async function resolveBillingBranding({ customer, metadata }) {
  const billingProfileCode = String(
    metadata?.billingProfileCode ||
    customer?.billingProfileCode ||
    customer?.billingSnapshot?.billingProfileCode ||
    ""
  ).trim();
  const profile = billingProfileCode
    ? await BillingProfile.findOne({ code: billingProfileCode, active: true }).lean()
    : await BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
  const zoneCode = normalizeZoneCode(
    metadata?.billingZoneCode ||
    customer?.billingZoneCode ||
    customer?.billingSnapshot?.billingZoneCode
  );
  const zoneMapping = (profile?.zoneMappings || []).find((item) => normalizeZoneCode(item?.zoneCode) === zoneCode) || null;
  return {
    companyName: zoneMapping?.companyLegalName || profile?.companyLegalName || "JustFiber",
    zoneCode,
    zoneName: zoneMapping?.zoneName || customer?.billingSnapshot?.billingZoneName || metadata?.billingZoneName || "",
    supportPhone: profile?.supportPhone || "",
    supportEmail: profile?.supportEmail || "",
  };
}

function buildSupportLine(branding) {
  const parts = [branding.supportPhone, branding.supportEmail].filter(Boolean);
  return parts.length ? ` Support: ${parts.join(" | ")}.` : "";
}

export async function buildBillingNotificationContent({
  eventKey,
  customer,
  invoice,
  payment,
  metadata,
  actionUrl,
  amount,
  dueDate,
  overdueDays
}) {
  const branding = await resolveBillingBranding({ customer, metadata });
  const companyName = branding.companyName;
  const customerName = customer?.fullName || customer?.customerId || "Customer";
  const invoiceNumber = invoice?.invoiceNumber || invoice?.invoiceId || metadata?.invoiceNumber || "";
  const dueDateLabel = formatDate(dueDate || invoice?.dueDate);
  const amountLabel = formatAmount(amount ?? invoice?.totalAmount ?? payment?.amount ?? metadata?.amount);
  const supportLine = buildSupportLine(branding);
  const actionLine = actionUrl ? ` Open: ${actionUrl}` : "";
  const zoneLine = branding.zoneName ? ` for ${branding.zoneName}` : "";

  if (eventKey === "invoice_due_date") {
    return {
      subject: `${companyName}: Invoice due soon`,
      body: `Dear ${customerName}, invoice ${invoiceNumber || "for your account"}${zoneLine} of ${amountLabel} is due${dueDateLabel ? ` on ${dueDateLabel}` : " soon"}. Please pay on time to avoid interruption.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "unpaid_invoice") {
    return {
      subject: `${companyName}: Invoice overdue`,
      body: `Dear ${customerName}, invoice ${invoiceNumber || "for your account"}${zoneLine} of ${amountLabel} is overdue. Please clear the pending amount to avoid service interruption.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "payment_retry") {
    return {
      subject: `${companyName}: Payment retry required`,
      body: `Dear ${customerName}, your payment attempt${zoneLine} for ${amountLabel} was not completed. Please retry the payment from the customer app or portal.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "suspension_warning") {
    return {
      subject: `${companyName}: Suspension warning`,
      body: `Dear ${customerName}, invoice ${invoiceNumber || "for your account"}${zoneLine} of ${amountLabel} remains unpaid${typeof overdueDays === "number" ? ` after ${overdueDays} overdue day(s)` : ""}. Pay immediately to avoid service suspension.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "account_suspension") {
    return {
      subject: `${companyName}: Service suspended`,
      body: `Dear ${customerName}, your service${zoneLine} has been temporarily suspended because ${amountLabel} is still pending. Pay now and the service should resume automatically.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "paid_invoice") {
    const resumed = Boolean(metadata?.automation === "collections_resume" || metadata?.serviceStatus === "active_after_resume");
    return {
      subject: resumed ? `${companyName}: Service resumed` : `${companyName}: Payment received`,
      body: resumed
        ? `Dear ${customerName}, we received ${amountLabel} and your service${zoneLine} has been resumed successfully.${actionLine}${supportLine}`
        : `Dear ${customerName}, we received ${amountLabel}${invoiceNumber ? ` against invoice ${invoiceNumber}` : ""}.${actionLine}${supportLine}`,
      branding,
    };
  }
  if (eventKey === "billing_invoice") {
    return {
      subject: `${companyName}: Invoice ready`,
      body: `Dear ${customerName}, invoice ${invoiceNumber || "for your account"}${zoneLine} of ${amountLabel} is ready.${actionLine}${supportLine}`,
      branding,
    };
  }
  return null;
}

async function resolveActiveConnection(category) {
  return IntegrationConnection.findOne({ category, status: "active" }).sort({ updatedAt: -1 }).lean();
}

async function postWebhook(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

export const notificationDispatcher = {
  async dispatchChannel({
    category,
    recipient,
    subject,
    body,
    attachments,
    entityType,
    entityId,
    metadata
  }) {
    if (category === "sms") {
      const result = await providerAdapters.sendSms({ recipient, subject, body, metadata, attachments, entityType, entityId });
      return result.log;
    }
    if (category === "email") {
      const result = await providerAdapters.sendEmail({ recipient, subject, body, metadata, attachments, entityType, entityId });
      return result.log;
    }
    if (category === "whatsapp") {
      const result = await providerAdapters.sendWhatsapp({ recipient, subject, body, metadata, attachments, entityType, entityId });
      return result.log;
    }

    const connection = await resolveActiveConnection(category);
    const log = await IntegrationEventLog.create({
      integrationKey: connection?.key,
      category,
      provider: connection?.provider || "mock",
      eventType: "outbound_message",
      status: "queued",
      entityType,
      entityId,
      payload: {
        recipient,
        subject,
        body,
        attachments,
        metadata
      }
    });

    try {
      if (env.MOCK_EXTERNALS || !connection) {
        log.status = "success";
        log.response = {
          mocked: true,
          connectionResolved: Boolean(connection)
        };
        await log.save();
        return log.toObject();
      }

      const webhookUrl = connection.config?.webhookUrl || connection.config?.endpoint;
      if (!webhookUrl) {
        log.status = "failed";
        log.errorMessage = `No endpoint configured for ${category}`;
        await log.save();
        return log.toObject();
      }

      const result = await postWebhook(
        webhookUrl,
        {
          category,
          recipient,
          subject,
          body,
          attachments,
          metadata
        },
        connection.config?.headers || {}
      );

      log.status = result.ok ? "success" : "failed";
      log.response = result;
      log.errorMessage = result.ok ? undefined : `Provider returned HTTP ${result.status}`;
      await log.save();
      return log.toObject();
    } catch (error) {
      log.status = "failed";
      log.errorMessage = error.message;
      await log.save();
      return log.toObject();
    }
  },

  async dispatchEvent({
    eventKey,
    recipients,
    subject,
    body,
    attachments,
    entityType,
    entityId,
    metadata
  }) {
    const preference = await NotificationEventPreference.findOne({ eventKey }).lean();
    const channels = preference?.channels || getDefaultEventChannels(eventKey);
    const jobs = [];

    if (channels.email && recipients?.email) {
      jobs.push(this.dispatchChannel({
        category: "email",
        recipient: recipients.email,
        subject,
        body,
        attachments,
        entityType,
        entityId,
        metadata: { ...(metadata || {}), eventKey }
      }));
    }

    if (channels.sms && recipients?.sms) {
      jobs.push(this.dispatchChannel({
        category: "sms",
        recipient: recipients.sms,
        subject,
        body,
        attachments,
        entityType,
        entityId,
        metadata: { ...(metadata || {}), eventKey }
      }));
    }

    if (channels.whatsapp && recipients?.whatsapp) {
      jobs.push(this.dispatchChannel({
        category: "whatsapp",
        recipient: recipients.whatsapp,
        subject,
        body,
        attachments,
        entityType,
        entityId,
        metadata: { ...(metadata || {}), eventKey }
      }));
    }

    if (channels.push && recipients?.push) {
      jobs.push(this.dispatchChannel({
        category: "analytics",
        recipient: recipients.push,
        subject,
        body,
        attachments,
        entityType,
        entityId,
        metadata: { ...(metadata || {}), eventKey, channel: "push" }
      }));
    }

    return Promise.all(jobs);
  }
};
