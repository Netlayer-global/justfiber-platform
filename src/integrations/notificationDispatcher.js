import { env } from "../config/env.js";
import { IntegrationConnection } from "../models/IntegrationConnection.js";
import { IntegrationEventLog } from "../models/IntegrationEventLog.js";
import { NotificationEventPreference } from "../models/NotificationEventPreference.js";
import { providerAdapters } from "./providerAdapters.js";

function getDefaultEventChannels(eventKey) {
  const defaults = {
    verification_code: { sms: true },
    unpaid_invoice: { email: true, sms: true },
    paid_invoice: { email: true, sms: true },
    renewal: { email: true, sms: true },
    raising_ticket_notification: { email: true, sms: true },
    ticket_message: { push: true }
  };
  return defaults[eventKey] || { push: true };
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
    entityType,
    entityId,
    metadata
  }) {
    if (category === "sms") {
      const result = await providerAdapters.sendSms({ recipient, subject, body, metadata, entityType, entityId });
      return result.log;
    }
    if (category === "email") {
      const result = await providerAdapters.sendEmail({ recipient, subject, body, metadata, entityType, entityId });
      return result.log;
    }
    if (category === "whatsapp") {
      const result = await providerAdapters.sendWhatsapp({ recipient, subject, body, metadata, entityType, entityId });
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
        entityType,
        entityId,
        metadata: { ...(metadata || {}), eventKey, channel: "push" }
      }));
    }

    return Promise.all(jobs);
  }
};
