import { SystemConfig } from "../models/SystemConfig.js";

const INSTALLER_MESSAGE_TEMPLATE_KEY = "installer_message_templates";

export const defaultInstallerMessageTemplates = {
  activationSms:
    "JustFiber activated. PPPoE: {{pppoeUsername}} Password: {{pppoePassword}}. Wi-Fi: {{wifiSsid}} Password: {{wifiPassword}}. VLAN: {{vlanId}}. Support: {{supportPhone}}",
  installCompletionOtpSms:
    "Your JustFiber OTP for installation completion is {{otp}}. It is valid for 10 minutes.",
  complaintCompletionOtpSms:
    "Your JustFiber OTP for complaint closure is {{otp}}. It is valid for 10 minutes."
};

export async function getInstallerMessageTemplates() {
  const config = await SystemConfig.findOne({ key: INSTALLER_MESSAGE_TEMPLATE_KEY }).lean();
  return {
    ...defaultInstallerMessageTemplates,
    ...(config?.value || {})
  };
}

export async function saveInstallerMessageTemplates(value, updatedBy) {
  const current = await getInstallerMessageTemplates();
  const nextValue = {
    ...current,
    ...(value || {})
  };
  const updated = await SystemConfig.findOneAndUpdate(
    { key: INSTALLER_MESSAGE_TEMPLATE_KEY },
    {
      $set: {
        value: nextValue,
        valueType: "json",
        category: "notifications",
        updatedBy
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();
  return updated?.value || nextValue;
}

function renderTemplate(template, context) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function buildContext({
  job,
  pppoeUsername,
  pppoePassword,
  wifiSsid,
  wifiPassword,
  vlanId,
  otp,
  purpose
}) {
  return {
    customerName: job?.customerSnapshot?.fullName || "",
    customerId: job?.customerId || "",
    serviceId: job?.serviceId || "",
    jobNumber: job?.jobNumber || "",
    mobile: job?.customerSnapshot?.phone || "",
    pppoeUsername: pppoeUsername || job?.activation?.credentials?.pppoeUsername || job?.activation?.preparedCredentials?.pppoe?.username || "",
    pppoePassword: pppoePassword || job?.activation?.credentials?.pppoePassword || job?.activation?.preparedCredentials?.pppoe?.password || "",
    wifiSsid: wifiSsid || job?.activation?.credentials?.wifi?.ssid24 || job?.activation?.preparedCredentials?.wifi?.ssid24 || "",
    wifiPassword: wifiPassword || job?.activation?.credentials?.wifi?.password || job?.activation?.preparedCredentials?.wifi?.password || "",
    vlanId: vlanId || job?.activation?.credentials?.vlanId || job?.activation?.preparedCredentials?.vlanId || "",
    otp: otp || "",
    supportPhone: "1800-000-000",
    purpose: purpose || ""
  };
}

export async function renderInstallerActivationSms(job, overrides = {}) {
  const templates = await getInstallerMessageTemplates();
  return renderTemplate(templates.activationSms, buildContext({ job, ...overrides }));
}

export async function renderInstallerOtpSms(job, purpose, otp) {
  const templates = await getInstallerMessageTemplates();
  const template =
    purpose === "complaint_complete"
      ? templates.complaintCompletionOtpSms
      : templates.installCompletionOtpSms;
  return renderTemplate(template, buildContext({ job, otp, purpose }));
}
