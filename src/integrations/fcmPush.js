import { SystemConfig } from "../models/SystemConfig.js";
import { CustomerUser } from "../models/CustomerUser.js";
import { Installer } from "../models/Installer.js";

const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

// Cache server keys for 5 minutes to avoid a DB hit on every notification.
let _keyCache = { customer: null, installer: null, expiresAt: 0 };

async function resolveServerKeys() {
  if (Date.now() < _keyCache.expiresAt) return _keyCache;
  const config = await SystemConfig.findOne({ key: "platform_settings" }).lean();
  const fb = config?.value?.firebase || {};
  _keyCache = {
    customer: fb.customerServerKey || "",
    installer: fb.adminServerKey || fb.installerServerKey || "",
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  return _keyCache;
}

async function sendFcm(tokens, title, body, appType = "customer") {
  const keys = await resolveServerKeys();
  const serverKey = appType === "installer" ? keys.installer : keys.customer;
  if (!serverKey) return null;

  const validTokens = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (validTokens.length === 0) return null;

  try {
    const resp = await fetch(FCM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`
      },
      body: JSON.stringify({
        registration_ids: validTokens,
        notification: { title: String(title || "JustFiber"), body: String(body || "") },
        priority: "high",
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } }
      })
    });
    return resp.ok ? await resp.json() : { error: `FCM HTTP ${resp.status}` };
  } catch (err) {
    return { error: err.message };
  }
}

export async function sendCustomerPush(customerUserId, title, body) {
  if (!customerUserId) return null;
  try {
    const user = await CustomerUser.findById(customerUserId).select("fcmToken").lean();
    if (!user?.fcmToken) return null;
    return await sendFcm([user.fcmToken], title, body, "customer");
  } catch (_) {
    return null;
  }
}

export async function sendInstallerPush(installerId, title, body) {
  if (!installerId) return null;
  try {
    const installer = await Installer.findById(installerId).select("fcmToken").lean();
    if (!installer?.fcmToken) return null;
    return await sendFcm([installer.fcmToken], title, body, "installer");
  } catch (_) {
    return null;
  }
}
