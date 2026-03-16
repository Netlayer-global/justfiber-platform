const state = {
  accessToken: "",
  mobile: "",
  email: "",
  demoGps: { lat: 26.8467, lng: 80.9462 }
};

const el = {
  banner: document.getElementById("banner"),
  sendOtpForm: document.getElementById("sendOtpForm"),
  verifyOtpForm: document.getElementById("verifyOtpForm"),
  dashboardView: document.getElementById("dashboardView"),
  plansView: document.getElementById("plansView"),
  notificationsView: document.getElementById("notificationsView"),
  faqsView: document.getElementById("faqsView"),
  bookingForm: document.getElementById("bookingForm"),
  trackingView: document.getElementById("trackingView"),
  requestsView: document.getElementById("requestsView"),
  addonsView: document.getElementById("addonsView"),
  ticketsView: document.getElementById("ticketsView"),
  planOptionsView: document.getElementById("planOptionsView"),
  connectedDevicesView: document.getElementById("connectedDevicesView"),
  networkToolsView: document.getElementById("networkToolsView"),
  parentalControlsView: document.getElementById("parentalControlsView"),
  ottView: document.getElementById("ottView")
};

function showBanner(message, isError = false) {
  el.banner.textContent = message;
  el.banner.classList.remove("hidden");
  el.banner.style.background = isError ? "rgba(239,68,68,0.12)" : "rgba(14,165,233,0.12)";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
  }
  return payload.data;
}

async function loadDashboard() {
  if (!state.accessToken) return;
  const data = await api("/api/v1/customer/dashboard");
  el.dashboardView.innerHTML = Object.entries(data)
    .map(([key, value]) => `<div class="card"><strong>${key}</strong><div>${typeof value === "object" ? JSON.stringify(value) : value}</div></div>`)
    .join("");
}

async function loadPlans() {
  const plans = await api("/api/v1/customer/plans");
  el.plansView.innerHTML = plans
    .map(
      (plan) => `<div class="card"><strong>${plan.name}</strong><div>${plan.planCode}</div><div>Rs. ${plan.monthlyPrice}</div></div>`
    )
    .join("");
}

async function loadNotifications() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/notifications");
  el.notificationsView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.title}</strong><div>${item.body}</div></div>`)
    .join("");
}

async function loadFaqs() {
  const items = await api("/api/v1/customer/help/faqs");
  el.faqsView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.question}</strong><div>${item.answer}</div></div>`)
    .join("");
}

async function loadRequests() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/requests");
  el.requestsView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.requestNumber}</strong><div>${item.type} / ${item.status}</div></div>`)
    .join("");
}

async function loadAddons() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/addons");
  el.addonsView.innerHTML = items
    .map(
      (item) => `<div class="card"><strong>${item.name}</strong><div>Rs. ${item.price}</div><div>${item.description || ""}</div></div>`
    )
    .join("");
}

async function loadTickets() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/tickets");
  el.ticketsView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.subject}</strong><div>${item.category} / ${item.status}</div></div>`)
    .join("");
}

async function loadPlanOptions() {
  if (!state.accessToken) return;
  const data = await api("/api/v1/customer/plan/change-options");
  el.planOptionsView.innerHTML = (data.options || [])
    .map((item) => `<div class="card"><strong>${item.name}</strong><div>${item.planCode}</div><div>Rs. ${item.monthlyPrice}</div></div>`)
    .join("");
}

async function loadConnectedDevices() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/device/connected-devices");
  el.connectedDevicesView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.name}</strong><div>${item.clientId} | ${item.connectionType}</div><div>${item.signal} | ${item.blocked ? "blocked" : "allowed"}</div></div>`)
    .join("");
}

async function loadParentalControls() {
  if (!state.accessToken) return;
  const data = await api("/api/v1/customer/wifi/parental-controls");
  el.parentalControlsView.innerHTML = (data.rules || [])
    .map((item) => `<div class="card"><strong>${item.targetName}</strong><div>${item.startTime || "-"} to ${item.endTime || "-"}</div></div>`)
    .join("");
}

async function loadOttOptions() {
  if (!state.accessToken) return;
  const items = await api("/api/v1/customer/ott/options");
  el.ottView.innerHTML = items
    .map((item) => `<div class="card"><strong>${item.name}</strong><div>${item.addonCode}</div><div>Rs. ${item.price}</div></div>`)
    .join("");
}

el.sendOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.mobile = document.getElementById("mobileInput").value;
  state.email = document.getElementById("emailInput").value;
  try {
    const data = await api("/api/v1/customer/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ mobile: state.mobile || undefined, email: state.email || undefined })
    });
    showBanner(`OTP sent. Demo OTP: ${data.demoOtp}`);
  } catch (error) {
    showBanner(error.message, true);
  }
});

el.verifyOtpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/v1/customer/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        mobile: state.mobile || undefined,
        email: state.email || undefined,
        otp: document.getElementById("otpInput").value,
        fullName: document.getElementById("fullNameInput").value
      })
    });
    state.accessToken = data.accessToken;
    showBanner("Customer session established.");
    await loadDashboard();
    await Promise.allSettled([
      loadNotifications(),
      loadAddons(),
      loadRequests(),
      loadTickets(),
      loadPlanOptions(),
      loadConnectedDevices(),
      loadParentalControls(),
      loadOttOptions()
    ]);
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("plansRefresh").addEventListener("click", () => loadPlans().catch((error) => showBanner(error.message, true)));
document.getElementById("dashboardRefresh").addEventListener("click", () => loadDashboard().catch((error) => showBanner(error.message, true)));
document.getElementById("notificationsRefresh").addEventListener("click", () => loadNotifications().catch((error) => showBanner(error.message, true)));
document.getElementById("faqsRefresh").addEventListener("click", () => loadFaqs().catch((error) => showBanner(error.message, true)));
document.getElementById("requestsRefresh").addEventListener("click", () => loadRequests().catch((error) => showBanner(error.message, true)));
document.getElementById("addonsRefresh").addEventListener("click", () => loadAddons().catch((error) => showBanner(error.message, true)));
document.getElementById("planOptionsRefresh").addEventListener("click", () => loadPlanOptions().catch((error) => showBanner(error.message, true)));
document.getElementById("connectedDevicesRefresh").addEventListener("click", () => loadConnectedDevices().catch((error) => showBanner(error.message, true)));
document.getElementById("ottRefreshButton").addEventListener("click", () => loadOttOptions().catch((error) => showBanner(error.message, true)));

document.getElementById("gpsButton").addEventListener("click", () => {
  showBanner(`Using demo GPS ${state.demoGps.lat}, ${state.demoGps.lng}`);
});

el.bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const paymentMode = document.getElementById("paymentModeInput").value;
    const jazeUserId = document.getElementById("jazeUserIdInput").value.trim();
    const booking = await api("/api/v1/customer/bookings", {
      method: "POST",
      body: JSON.stringify({
        planCode: document.getElementById("planCodeInput").value,
        fullName: document.getElementById("bookingNameInput").value,
        mobile: document.getElementById("bookingMobileInput").value,
        email: document.getElementById("bookingEmailInput").value || undefined,
        fullAddress: document.getElementById("bookingAddressInput").value,
        pinCode: document.getElementById("bookingPinInput").value,
        lat: state.demoGps.lat,
        lng: state.demoGps.lng,
        paymentMode,
        jazeUserId: jazeUserId || undefined
      })
    });
    const paymentUrl = booking?.paymentGateway?.paymentUrl;
    showBanner(
      paymentUrl
        ? `Booking created: ${booking.bookingNumber}. Open payment link: ${paymentUrl}`
        : `Booking created: ${booking.bookingNumber}`
    );
    document.getElementById("trackingInput").value = booking.bookingNumber;
    await loadDashboard();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("trackingButton").addEventListener("click", async () => {
  try {
    const data = await api(`/api/v1/customer/bookings/${document.getElementById("trackingInput").value}/tracking`);
    el.trackingView.innerHTML = `<div class="card"><strong>Current Step</strong><div>${data.currentStep || "N/A"}</div></div>`;
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("bookingPayLinkButton").addEventListener("click", async () => {
  try {
    const bookingNumber = document.getElementById("trackingInput").value;
    const jazeUserId = document.getElementById("jazeUserIdInput").value.trim();
    if (!bookingNumber) {
      throw new Error("Enter booking number first");
    }
    const data = await api(`/api/v1/customer/bookings/${bookingNumber}/payment/link-jaze`, {
      method: "POST",
      body: JSON.stringify({ jazeUserId: jazeUserId || undefined })
    });
    if (data.paymentUrl) {
      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    }
    showBanner(data.paymentUrl ? `Payment link opened: ${data.paymentUrl}` : "Payment link generated.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("bookingPayConfirmButton").addEventListener("click", async () => {
  try {
    const bookingNumber = document.getElementById("trackingInput").value;
    if (!bookingNumber) {
      throw new Error("Enter booking number first");
    }
    const data = await api(`/api/v1/customer/bookings/${bookingNumber}/payment/confirm`, {
      method: "POST",
      body: JSON.stringify({
        status: "paid",
        paymentId: `JAZE-WEB-${Date.now()}`,
        reference: `JAZE-WEB-REF-${Date.now()}`,
        notes: "Confirmed from user web panel"
      })
    });
    showBanner(`Booking payment confirmed. Status: ${data.status}`);
    await Promise.allSettled([loadDashboard()]);
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("requestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/v1/customer/requests", {
      method: "POST",
      body: JSON.stringify({
        type: document.getElementById("requestTypeInput").value,
        note: document.getElementById("requestNoteInput").value
      })
    });
    showBanner("Service request created.");
    await loadRequests();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("ticketForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/v1/customer/tickets", {
      method: "POST",
      body: JSON.stringify({
        category: document.getElementById("ticketCategoryInput").value,
        subject: document.getElementById("ticketSubjectInput").value,
        description: document.getElementById("ticketDescriptionInput").value
      })
    });
    showBanner("Complaint created.");
    await loadTickets();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("wifiForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/v1/customer/wifi/update", {
      method: "POST",
      body: JSON.stringify({
        ssid24: document.getElementById("ssid24Input").value || undefined,
        password24: document.getElementById("password24Input").value || undefined,
        ssid5: document.getElementById("ssid5Input").value || undefined,
        password5: document.getElementById("password5Input").value || undefined
      })
    });
    showBanner("Wi-Fi update request submitted.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("routerRebootButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/v1/customer/device/reboot", { method: "POST" });
    showBanner(`Router reboot queued. Recovery in about ${data.estimatedRecoverySeconds} seconds.`);
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("billingPayLinkButton").addEventListener("click", async () => {
  try {
    const jazeUserId = document.getElementById("jazeUserIdInput").value.trim();
    const data = await api("/api/v1/customer/billing/payment/link-jaze", {
      method: "POST",
      body: JSON.stringify({ jazeUserId: jazeUserId || undefined })
    });
    if (data.paymentUrl) {
      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    }
    showBanner(data.paymentUrl ? `Bill payment link opened: ${data.paymentUrl}` : "Bill payment link generated.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("wifiPauseButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/wifi/pause", {
      method: "POST",
      body: JSON.stringify({ paused: true })
    });
    showBanner("Wi-Fi paused.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("wifiResumeButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/wifi/pause", {
      method: "POST",
      body: JSON.stringify({ paused: false })
    });
    showBanner("Wi-Fi resumed.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("guestWifiEnableButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/wifi/guest", {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        ssid: document.getElementById("guestSsidInput").value || undefined,
        password: document.getElementById("guestPasswordInput").value || undefined
      })
    });
    showBanner("Guest Wi-Fi enabled.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("guestWifiDisableButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/wifi/guest", {
      method: "POST",
      body: JSON.stringify({ enabled: false })
    });
    showBanner("Guest Wi-Fi disabled.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("deviceBlockButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/device/access-control", {
      method: "POST",
      body: JSON.stringify({ clientId: document.getElementById("deviceAccessClientIdInput").value, blocked: true })
    });
    showBanner("Device blocked.");
    await loadConnectedDevices();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("deviceUnblockButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/device/access-control", {
      method: "POST",
      body: JSON.stringify({ clientId: document.getElementById("deviceAccessClientIdInput").value, blocked: false })
    });
    showBanner("Device unblocked.");
    await loadConnectedDevices();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("parentalAddButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/wifi/parental-controls", {
      method: "POST",
      body: JSON.stringify({
        mode: "append",
        rules: [
          {
            targetName: document.getElementById("parentalTargetInput").value,
            blocked: true,
            startTime: document.getElementById("parentalStartInput").value || undefined,
            endTime: document.getElementById("parentalEndInput").value || undefined
          }
        ]
      })
    });
    showBanner("Parental control rule added.");
    await loadParentalControls();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("speedTestButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/v1/customer/network/speed-test");
    el.networkToolsView.innerHTML = `<div class="card"><strong>Speed Test</strong><div>Down ${data.downloadMbps} Mbps | Up ${data.uploadMbps} Mbps | Latency ${data.latencyMs} ms</div></div>`;
    showBanner("Speed test completed.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("qualityCheckButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/v1/customer/network/quality");
    el.networkToolsView.innerHTML = `<div class="card"><strong>Network Quality</strong><div>${data.quality} | Latency ${data.latencyMs} ms | Packet loss ${data.packetLossPercent}%</div></div>`;
    showBanner("Network quality checked.");
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("planChangeApplyButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/v1/customer/plan/change/apply", {
      method: "POST",
      body: JSON.stringify({
        planCode: document.getElementById("planChangeCodeInput").value,
        effectiveMode: "immediate"
      })
    });
    showBanner(`Plan changed to ${data.planCode}.`);
    await Promise.allSettled([loadDashboard(), loadPlanOptions()]);
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("ottSubscribeButton").addEventListener("click", async () => {
  try {
    await api("/api/v1/customer/ott/subscribe", {
      method: "POST",
      body: JSON.stringify({
        addonCode: document.getElementById("ottAddonCodeInput").value,
        quantity: 1
      })
    });
    showBanner("OTT pack activated.");
    await loadOttOptions();
  } catch (error) {
    showBanner(error.message, true);
  }
});

document.getElementById("billingPayConfirmButton").addEventListener("click", async () => {
  try {
    const data = await api("/api/v1/customer/billing/payment/confirm", {
      method: "POST",
      body: JSON.stringify({
        paymentId: `JAZE-BILL-WEB-${Date.now()}`,
        reference: `JAZE-BILL-REF-${Date.now()}`,
        notes: "Confirmed from user web panel"
      })
    });
    showBanner(`Bill payment confirmed. Due amount: ${data.dueAmount}`);
    await loadDashboard();
  } catch (error) {
    showBanner(error.message, true);
  }
});

loadPlans().catch((error) => showBanner(error.message, true));
loadFaqs().catch((error) => showBanner(error.message, true));
