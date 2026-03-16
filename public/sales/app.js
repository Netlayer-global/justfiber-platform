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
    await Promise.all([loadDashboard(), loadLeads()]);
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
  } catch (error) {
    banner(error.message, true);
  }
});
