import { supabase, normalizeUsername, usernameToEmail, isAdminUsername } from "./lib/auth.js";

const form = document.getElementById("auth-form");
const signupBtn = document.getElementById("signup-btn");
const statusEl = document.getElementById("status");
const passwordInput = document.getElementById("password");
const showPasswordCheckbox = document.getElementById("show-password");
const pageLoader = document.getElementById("page-loader");
const pageLoaderText = document.getElementById("page-loader-text");
const TRANSITION_DELAY_MS = 520;

requestAnimationFrame(() => {
  document.body.classList.add("page-entered");
});

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function showPageLoader(message) {
  if (pageLoaderText) {
    pageLoaderText.textContent = message;
  }
  pageLoader?.classList.remove("hidden");
}

function navigateWithAnimation(url) {
  showPageLoader("Opening dashboard...");
  document.body.classList.add("page-leaving");
  window.setTimeout(() => {
    window.location.href = url;
  }, TRANSITION_DELAY_MS);
}

function getCredentials() {
  const username = normalizeUsername(document.getElementById("username").value);
  const password = document.getElementById("password").value;
  return { username, password };
}

async function ensureAlreadySignedInRedirect() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return;
  if (data.session?.user) {
    navigateWithAnimation("./dashboard.html");
  }
}

async function signIn() {
  const { username, password } = getCredentials();
  if (!username || !password) {
    setStatus("Enter username and password.", "error");
    return;
  }
  if (!isAdminUsername(username)) {
    setStatus("This username is not allowed for admin dashboard.", "error");
    return;
  }

  const email = usernameToEmail(username);
  setStatus("Signing in...");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Login success. Redirecting...", "ok");
  navigateWithAnimation("./dashboard.html");
}

async function signUpAdmin() {
  const { username, password } = getCredentials();
  if (!username || !password) {
    setStatus("Enter username and password first.", "error");
    return;
  }
  if (!isAdminUsername(username)) {
    setStatus("Only usernames in ADMIN_USERNAMES can create admin accounts.", "error");
    return;
  }

  const email = usernameToEmail(username);
  setStatus("Creating admin account...");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    setStatus(error.message, "error");
    return;
  }

  if (data.user?.id) {
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        username,
        display_name: username,
      },
      { onConflict: "id" }
    );
  }

  setStatus("Admin account created. You can now sign in.", "ok");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await signIn();
});

signupBtn.addEventListener("click", async () => {
  await signUpAdmin();
});

showPasswordCheckbox.addEventListener("change", () => {
  passwordInput.type = showPasswordCheckbox.checked ? "text" : "password";
});

ensureAlreadySignedInRedirect();