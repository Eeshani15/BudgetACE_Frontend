// ===== BudgetACE Auth (Frontend -> Django API) =====
// Local backend for testing:
const API_BASE = "https://budgetace-backend.onrender.com";

// Storage keys
const LS = {
  session: "budgetace_session_v2",
};

// Helpers
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function showMsg(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || "";
}
function setSession(data) {
  // store simple session (later we’ll use JWT tokens)
  localStorage.setItem(LS.session, JSON.stringify({
    email: data.email,
    username: data.username || "",
    loggedInAt: new Date().toISOString(),
  }));
}
function goApp() {
  window.location.href = "app.html";
}

// SIGN UP -> Django
const signUpForm = document.getElementById("signUpForm");
if (signUpForm) {
  signUpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("upMsg", "");

    const name = document.getElementById("upName").value.trim();
    const email = normalizeEmail(document.getElementById("upEmail").value);
    const pw = document.getElementById("upPassword").value;

    if (!name) { showMsg("upMsg", "Please enter your name."); return; }
    if (!email.includes("@")) { showMsg("upMsg", "Please enter a valid email."); return; }
    if (!pw || pw.length < 11) { showMsg("upMsg", "Password must be at least 11 characters."); return; }

    // Django signup expects username/email/password
    try {
      const res = await fetch(`${API_BASE}/api/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: name,     // we use Name as username
          email: email,
          password: pw
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // show readable error
        const msg =
          (data.email && data.email[0]) ||
          (data.username && data.username[0]) ||
          (data.password && data.password[0]) ||
          data.message ||
          "Signup failed.";
        showMsg("upMsg", msg);
        return;
      }

      // Auto-login after signup (call login)
      const loginRes = await fetch(`${API_BASE}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw })
      });

      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) {
        showMsg("upMsg", "Account created. Please sign in now.");
        window.location.href = "signin.html";
        return;
      }

      setSession(loginData);
      goApp();

    } catch (err) {
      showMsg("upMsg", "Backend not reachable. Make sure Django server is running.");
    }
  });
}

// SIGN IN -> Django
const signInForm = document.getElementById("signInForm");
if (signInForm) {
  signInForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("inMsg", "");

    const email = normalizeEmail(document.getElementById("inEmail").value);
    const pw = document.getElementById("inPassword").value;

    if (!email.includes("@")) { showMsg("inMsg", "Please enter a valid email."); return; }
    if (!pw || pw.length < 11) { showMsg("inMsg", "Password must be at least 11 characters."); return; }

    try {
      const res = await fetch(`${API_BASE}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pw })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showMsg("inMsg", data.error || "Invalid email or password.");
        return;
      }

      setSession(data);
      goApp();

    } catch (err) {
      showMsg("inMsg", "Backend not reachable. Make sure Django server is running.");
    }
  });
}