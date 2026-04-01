const CHAT_CACHE_KEY = "mathamota-whatsapp-cache-v1";
const AUTH_CACHE_KEY = "mathamota-auth-v1";

export function loadCachedState() {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedState(value) {
  try {
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

export function loadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuthState(value) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

export function clearAuthState() {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}
