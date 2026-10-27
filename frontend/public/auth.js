/**
 * VYORA demo login — no real auth backend required.
 * Demo accounts:
 *   Client:  client@vyora.app  / client123
 *   Trainer: trainer@vyora.app / trainer123
 */
const DEMO = {
  client:  { email: "client@vyora.app",  password: "client123",  name: "Demo Client" },
  trainer: { email: "trainer@vyora.app", password: "trainer123", name: "Demo Trainer" }
};

const roleContent = {
  client: {
    description: "Sign in to access your personal fitness journey.",
    button: "Sign in as Client",
    heading: 'Build strength.<br />Build <span class="accent">yourself.</span>',
    panelDescription:
      "Your AI fitness copilot for smarter workouts, personalized nutrition and measurable progress.",
    features: [
      "Personalized AI workout plans",
      "Nutrition designed around your goals",
      "Progress that keeps you motivated"
    ]
  },
  trainer: {
    description: "Sign in to manage clients, plans, and coaching tools.",
    button: "Sign in as Trainer",
    heading: 'Coach better.<br />Scale <span class="accent">impact.</span>',
    panelDescription:
      "Tools for trainers to guide clients, track adherence, and grow a professional practice.",
    features: [
      "Client roster and progress overview",
      "Program and plan collaboration",
      "Session and booking workflows"
    ]
  }
};

const roleButtons = document.querySelectorAll(".role-btn");
const roleDescription = document.getElementById("roleDescription");
const submitLabel = document.getElementById("submitLabel");
const panelHeading = document.getElementById("panelHeading");
const panelDescription = document.getElementById("panelDescription");
const featureList = document.getElementById("featureList");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const loginForm = document.getElementById("loginForm");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");
const emailInput = document.getElementById("email");

let selectedRole = "client";

// Already signed in? Skip login
(function redirectIfSession() {
  const token = localStorage.getItem("vyoraSessionToken");
  const role = localStorage.getItem("vyora_role") || sessionStorage.getItem("vyora_demo_role");
  if (token) {
    window.location.replace(role === "trainer" ? "/trainer-dashboard.html" : "/index.html");
  }
})();

function fillDemoCredentials(role) {
  const d = DEMO[role] || DEMO.client;
  if (emailInput) emailInput.value = d.email;
  if (passwordInput) {
    passwordInput.type = "password";
    passwordInput.value = d.password;
  }
  if (togglePassword) {
    togglePassword.textContent = "Show";
    togglePassword.setAttribute("aria-label", "Show password");
  }
}

function setRole(role) {
  selectedRole = role;
  const content = roleContent[role];

  roleButtons.forEach((button) => {
    const active = button.dataset.role === role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  roleDescription.textContent = content.description;
  submitLabel.textContent = content.button;
  panelHeading.innerHTML = content.heading;
  panelDescription.textContent = content.panelDescription;

  featureList.innerHTML = "";
  content.features.forEach((feature) => {
    const item = document.createElement("div");
    item.className = "feature-item";
    const check = document.createElement("span");
    check.className = "feature-check";
    check.textContent = "✓";
    const text = document.createElement("span");
    text.textContent = feature;
    item.append(check, text);
    featureList.appendChild(item);
  });

  formMessage.textContent = "";
  formMessage.classList.remove("success");
  fillDemoCredentials(role);
}

roleButtons.forEach((button) => {
  button.addEventListener("click", () => setRole(button.dataset.role));
});

togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide" : "Show";
  togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
});

document.getElementById("forgotPassword").addEventListener("click", (event) => {
  event.preventDefault();
  formMessage.textContent = "Demo mode: use the demo password shown below the form.";
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.classList.remove("success");

  const email = (emailInput.value || "").trim().toLowerCase();
  const password = passwordInput.value || "";
  const remember = document.getElementById("remember").checked;
  const expected = DEMO[selectedRole];

  submitBtn.disabled = true;
  submitLabel.textContent = "Signing in...";

  // Tiny delay so the button state feels real
  await new Promise((r) => setTimeout(r, 250));

  if (email !== expected.email || password !== expected.password) {
    formMessage.textContent =
      "Use the demo account for " +
      selectedRole +
      ": " +
      expected.email +
      " / " +
      expected.password;
    submitLabel.textContent = roleContent[selectedRole].button;
    submitBtn.disabled = false;
    return;
  }

  // Demo session — no backend
  const demoToken = "demo-" + selectedRole + "-" + Date.now();
  localStorage.setItem("vyoraSessionToken", demoToken);
  localStorage.setItem("vyora_role", selectedRole);
  localStorage.setItem("vyora_demo_name", expected.name);
  if (remember) {
    localStorage.setItem("vyora_remember", "1");
  } else {
    sessionStorage.setItem("vyora_demo_role", selectedRole);
  }

  formMessage.textContent = "Login successful. Redirecting...";
  formMessage.classList.add("success");

  const destination =
    selectedRole === "trainer" ? "/trainer-dashboard.html" : "/index.html";
  window.location.replace(destination);
});

// Prefill client demo credentials on load
setRole("client");
