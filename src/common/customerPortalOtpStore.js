const otpStore = new Map();

function normalizeOtpKey(key) {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  const digits = raw.replace(/\D/g, "");
  return digits || raw;
}

export function setCustomerPortalDemoOtp(key, otp) {
  const normalized = normalizeOtpKey(key);
  if (!normalized) return null;
  otpStore.set(normalized, String(otp || ""));
  return normalized;
}

export function getCustomerPortalDemoOtp(key) {
  const normalized = normalizeOtpKey(key);
  if (!normalized) return null;
  return otpStore.get(normalized) || null;
}

export function verifyCustomerPortalDemoOtp(key, otp) {
  const normalized = normalizeOtpKey(key);
  if (!normalized) return false;
  return otpStore.get(normalized) === String(otp || "");
}

export function normalizeCustomerPortalOtpKey(key) {
  return normalizeOtpKey(key);
}
