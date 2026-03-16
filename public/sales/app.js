let token = "";

function banner(message, error = false) {
  const node = document.getElementById("banner");
  node.textContent = message;
  node.classList.remove("hidden");
  node.style.background = error ? "rgba(239,68,68,0.12)" : "white";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Failed ${response.status}`);
  return payload.data;
}

async function loadDashboard() {
  if (!token) return;
  const data = await api("/api/v1/sales/dashboard");
  document.getElementById("dashboardView").innerHTML = Object.entries(data)
    .map(([key, value]) => `<div class="card"><strong>${key}</strong><div>${value}</div></div>`)
    .join("");
}

async function loadLeads() {
  if (!token) return;
  const leads = await api("/api/v1/sales/leads");
  document.getElementById("leadsView").innerHTML = leads
    .map((lead) => `<div class="card"><strong>${lead.leadNumber}</strong><div>${lead.fullName}</div><div>${lead.status}</div></div>`)
    .join("");
}

async function loadBookings() {
  if (!token) return;
  const bookings = await api("/api/v1/sales/bookings");
  document.getElementById("bookingsView").innerHTML = bookings
    .map(
      (booking) => `
        <div class="card">
          <strong>${booking.bookingNumber}</strong>
          <div>${booking.status}</div>
          <div class="muted">${booking._id}</div>
        </div>
      `
    )
    .join("");
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await api("/api/v1/sales/auth/login", {
      method: "POST",
      body: JSON.stringify({
        login: document.getElementById("loginInput").value,
        password: document.getElementById("passwordInput").value
      })
    });
    token = data.accessToken;
    banner("Sales session established.");
    await Promise.all([loadDashboard(), loadLeads(), loadBookings()]);
  } catch (error) {
    banner(error.message, true);
  }
});

document.getElementById("leadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/v1/sales/leads", {
      method: "POST",
      body: JSON.stringify({
        fullName: document.getElementById("leadName").value,
        mobile: document.getElementById("leadMobile").value,
        email: document.getElementById("leadEmail").value || undefined,
        address: document.getElementById("leadAddress").value,
        pinCode: document.getElementById("leadPin").value,
        lat: 26.8467,
        lng: 80.9462,
        planCode: document.getElementById("leadPlan").value
      })
    });
    banner("Lead created.");
    await loadLeads();
    await loadBookings();
  } catch (error) {
    banner(error.message, true);
  }
});

document.getElementById("bookingLinkButton").addEventListener("click", async () => {
  try {
    const bookingId = document.getElementById("bookingIdInput").value;
    const jazeUserId = document.getElementById("bookingJazeUserIdInput").value;
    const data = await api(`/api/v1/sales/bookings/${bookingId}/payment/link-jaze`, {
      method: "POST",
      body: JSON.stringify({ jazeUserId: jazeUserId || undefined })
    });
    if (data.paymentUrl) {
      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    }
    banner(data.paymentUrl ? `Payment link opened: ${data.paymentUrl}` : "Payment link generated.");
  } catch (error) {
    banner(error.message, true);
  }
});

document.getElementById("bookingConfirmButton").addEventListener("click", async () => {
  try {
    const bookingId = document.getElementById("bookingIdInput").value;
    const data = await api(`/api/v1/sales/bookings/${bookingId}/payment/confirm`, {
      method: "POST",
      body: JSON.stringify({
        status: "paid",
        paymentId: `JAZE-SALES-WEB-${Date.now()}`,
        reference: `JAZE-SALES-REF-${Date.now()}`,
        notes: "Confirmed from sales panel"
      })
    });
    banner(`Booking payment confirmed. Status: ${data.status}`);
    await loadBookings();
  } catch (error) {
    banner(error.message, true);
  }
});
