const CHAT_CACHE_KEY = "mathamota-whatsapp-cache-v1";

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
