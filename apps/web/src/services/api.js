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

export function getChats() {
  return request("/api/chats");
}

export function getChat(chatId) {
  return request(`/api/chats/${chatId}`);
}

export function createDirectChat(partnerId) {
  return request("/api/chats/direct", {
    method: "POST",
    body: JSON.stringify({ partnerId })
  });
}

export function createRoom(title) {
  return request("/api/rooms", {
    method: "POST",
    body: JSON.stringify({ title })
  });
}

export function joinRoom(inviteCode) {
  return request("/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode })
  });
}

export function getRoom(chatId) {
  return request(`/api/rooms/${chatId}`);
}

export function setRoomToken(chatId, token) {
  return request(`/api/rooms/${chatId}/token`, {
    method: "POST",
    body: JSON.stringify({ token })
  });
}

export function rollRoomGame(chatId) {
  return request(`/api/rooms/${chatId}/roll`, {
    method: "POST"
  });
}

export function resetRoomGame(chatId) {
  return request(`/api/rooms/${chatId}/reset`, {
    method: "POST"
  });
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
