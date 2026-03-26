const otpStore = new Map();

function normalizeKey(value) {
  return String(value || "").trim();
}

export function setInstallerDemoOtp(key, otp) {
  const normalized = normalizeKey(key);
  if (!normalized) return;
  otpStore.set(normalized, String(otp || ""));
}

export function getInstallerDemoOtp(key) {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  return otpStore.get(normalized) || null;
}
