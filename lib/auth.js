import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  INTERNAL_AUTH_EMAIL_DOMAIN,
  ADMIN_USERNAMES,
} from "../config.js";

function isPlaceholder(value) {
  return !value || value.includes("YOUR_");
}

if (isPlaceholder(SUPABASE_URL) || isPlaceholder(SUPABASE_ANON_KEY)) {
  console.warn("Supabase config is not set. Edit website/config.js first.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function normalizeUsername(raw) {
  const lowered = String(raw || "").trim().toLowerCase();
  return lowered.replace(/[^a-z0-9_]/g, "");
}

export function usernameToEmail(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return "";
  return `${normalized}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}

export function emailToUsername(email) {
  const value = String(email || "").toLowerCase();
  const suffix = `@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
  if (value.endsWith(suffix)) {
    return value.slice(0, value.length - suffix.length);
  }
  return "";
}

export function isAdminUsername(username) {
  const normalized = normalizeUsername(username);
  return ADMIN_USERNAMES.map(normalizeUsername).includes(normalized);
}