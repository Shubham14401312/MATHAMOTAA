const WS_BASE = import.meta.env.VITE_WS_URL || "";

export function connectSocket({ userId, onStatus, onEvent }) {
  if (!WS_BASE) {
    onStatus("offline");
    return { close() {}, send() {} };
  }

  const socket = new WebSocket(`${WS_BASE}?userId=${encodeURIComponent(userId)}`);
  socket.addEventListener("open", () => onStatus("connected"));
  socket.addEventListener("close", () => onStatus("disconnected"));
  socket.addEventListener("error", () => onStatus("error"));
  socket.addEventListener("message", (event) => {
    try {
      onEvent(JSON.parse(event.data));
    } catch {}
  });

  return {
    close() {
      socket.close();
    },
    send(payload) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
      }
    }
  };
}
