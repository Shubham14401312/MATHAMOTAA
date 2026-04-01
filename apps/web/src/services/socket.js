import { io } from "socket.io-client";

const WS_BASE = import.meta.env.VITE_WS_URL || window.location.origin;

export function connectSocket({ token, onStatus, onEvent }) {
  if (!WS_BASE) {
    onStatus("offline");
    return { close() {}, send() {} };
  }

  const socket = io(WS_BASE, {
    transports: ["websocket"],
    auth: {
      token
    }
  });

  socket.on("connect", () => onStatus("connected"));
  socket.on("disconnect", () => onStatus("disconnected"));
  socket.on("connect_error", () => onStatus("error"));

  socket.on("message:new", (message) => {
    onEvent({
      type: "message:new",
      message: {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        receiverId: message.receiverId,
        type: message.kind || "text",
        text: message.body || "",
        media: message.attachmentUrl
          ? {
              url: message.attachmentUrl,
              name: message.attachmentName || message.kind
            }
          : null,
        document: message.attachmentName || null,
        status: "delivered",
        timestamp: message.createdAt
      }
    });
  });

  socket.on("typing", (payload) => {
    onEvent({ type: "typing", ...payload });
  });

  socket.on("userTyping", (payload) => {
    onEvent({ type: "typing:user", ...payload });
  });

  socket.on("messageStatus", (payload) => {
    onEvent({ type: "message:receipt", ...payload });
  });

  socket.on("userStatusUpdate", (payload) => {
    onEvent({ type: "user:status", ...payload });
  });

  socket.on("receiveMessage", (message) => {
    onEvent({
      type: "message:new",
      message: {
        id: message.message_ID || message.id,
        chatId: message.chatId,
        senderId: message.sender_ID || message.senderId,
        receiverId: message.reciever_ID || message.receiverId,
        type: message.type || "text",
        text: message.text || "",
        media: message.media_object || null,
        document: message.document || null,
        status: message.status || "delivered",
        timestamp: message.timestamp || new Date().toISOString()
      }
    });
  });

  return {
    close() {
      socket.close();
    },
    send(payload) {
      if (!payload?.type) return;
      if (payload.type === "typing") {
        socket.emit("typing", {
          receiverId: payload.receiverId
        });
      }
      if (payload.type === "chat:read") {
        socket.emit("chat:read", {
          senderId: payload.senderId
        });
      }
      if (payload.type === "message:send") {
        socket.emit("message:send", payload);
      }
    }
  };
}
