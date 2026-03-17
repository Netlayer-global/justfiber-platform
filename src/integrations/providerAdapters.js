import { env } from "../config/env.js";
import { IntegrationConnection } from "../models/IntegrationConnection.js";
import { IntegrationEventLog } from "../models/IntegrationEventLog.js";

async function resolveActiveConnection(category, explicitKey) {
  if (explicitKey) {
    return IntegrationConnection.findOne({ key: explicitKey }).lean();
  }
  return IntegrationConnection.findOne({ category, status: "active" }).sort({ updatedAt: -1 }).lean();
}

async function postJson(url, payload, headers = {}) {
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

async function runProviderAction({
  category,
  explicitKey,
  eventType,
  entityType,
  entityId,
  payload
}) {
  const connection = await resolveActiveConnection(category, explicitKey);
  const log = await IntegrationEventLog.create({
    integrationKey: connection?.key || explicitKey,
    category,
    provider: connection?.provider || "mock",
    eventType,
    status: "queued",
    entityType,
    entityId,
    payload
  });

  try {
    if (env.MOCK_EXTERNALS || !connection) {
      log.status = "success";
      log.response = {
        mocked: true,
        connectionResolved: Boolean(connection),
        payload
      };
      await log.save();
      return { ok: true, log: log.toObject(), response: log.response, connection };
    }

    const endpoint = connection.config?.webhookUrl || connection.config?.endpoint;
    if (!endpoint) {
      log.status = "failed";
      log.errorMessage = `No endpoint configured for ${category}`;
      await log.save();
      return { ok: false, log: log.toObject(), error: log.errorMessage, connection };
    }

    const result = await postJson(endpoint, payload, connection.config?.headers || {});
    log.status = result.ok ? "success" : "failed";
    log.response = result;
    log.errorMessage = result.ok ? undefined : `Provider returned HTTP ${result.status}`;
    await log.save();
    return {
      ok: result.ok,
      log: log.toObject(),
      response: result,
      error: log.errorMessage,
      connection
    };
  } catch (error) {
    log.status = "failed";
    log.errorMessage = error.message;
    await log.save();
    return { ok: false, log: log.toObject(), error: error.message, connection };
  }
}

export const providerAdapters = {
  sendSms({ recipient, subject, body, metadata, providerKey, entityType, entityId }) {
    return runProviderAction({
      category: "sms",
      explicitKey: providerKey,
      eventType: "sms_send",
      entityType,
      entityId,
      payload: { recipient, subject, body, metadata }
    });
  },

  sendEmail({ recipient, subject, body, metadata, providerKey, entityType, entityId }) {
    return runProviderAction({
      category: "email",
      explicitKey: providerKey,
      eventType: "email_send",
      entityType,
      entityId,
      payload: { recipient, subject, body, metadata }
    });
  },

  sendWhatsapp({ recipient, subject, body, metadata, providerKey, entityType, entityId }) {
    return runProviderAction({
      category: "whatsapp",
      explicitKey: providerKey,
      eventType: "whatsapp_send",
      entityType,
      entityId,
      payload: { recipient, subject, body, metadata }
    });
  },

  startKycVerification({ providerKey, requestNumber, customerId, documentType, verificationMode, payload, entityId }) {
    return runProviderAction({
      category: "kyc",
      explicitKey: providerKey,
      eventType: "kyc_submit",
      entityType: "kyc_verification_request",
      entityId: entityId || requestNumber,
      payload: {
        requestNumber,
        customerId,
        documentType,
        verificationMode,
        payload
      }
    });
  },

  activateOttSubscription({ providerKey, subscriptionCode, customerId, addonCode, planCode, metadata, entityId }) {
    return runProviderAction({
      category: "ott",
      explicitKey: providerKey,
      eventType: "ott_activate",
      entityType: "ott_subscription",
      entityId: entityId || subscriptionCode,
      payload: {
        subscriptionCode,
        customerId,
        addonCode,
        planCode,
        metadata
      }
    });
  }
};
