const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;
let authToken = "";

export function setApiToken(token) {
  authToken = token || "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "Request failed");
    throw new Error(message || "Request failed");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.blob();
}

export function sendMessage(payload) {
  return request("/messages", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function register(payload) {
  return request("/api/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload) {
  return request("/api/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getCurrentUser() {
  return request("/api/me");
}

export function getUsers() {
  return request("/api/users");
}

export function getOfflineMessages(userId) {
  return request(`/messages/${userId}`);
}

export function uploadFile(file) {
  const form = new FormData();
  form.append("file_type", file.type || "application/octet-stream");
  form.append("file", file);
  return request("/v1/media", {
    method: "POST",
    body: form
  });
}

export function downloadFile(userId, fileId) {
  return request(`/v1/media/${userId}/${fileId}`);
}
