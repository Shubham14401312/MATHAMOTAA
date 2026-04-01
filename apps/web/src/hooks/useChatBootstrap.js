import { useEffect } from "react";
import { getCurrentUser, getOfflineMessages, getUsers } from "../services/api.js";
import { connectSocket } from "../services/socket.js";
import { useChatStore } from "../store/chatStore.js";

function normalizeMessages(rawMessages, currentUserId, usersDirectory) {
  const grouped = {};
  for (const entry of rawMessages) {
    const chatId = entry.chatId || [entry.sender_ID, entry.reciever_ID].sort().join(":");
    const message = {
      id: entry.message_ID || crypto.randomUUID(),
      chatId,
      senderId: entry.sender_ID,
      receiverId: entry.reciever_ID,
      type: entry.type || "text",
      text: entry.text || "",
      media: entry.media_object || null,
      document: entry.document || null,
      status: entry.status || "delivered",
      timestamp: entry.timestamp || new Date().toISOString()
    };
    grouped[chatId] ||= [];
    grouped[chatId].push(message);
  }

  const chatsList = Object.entries(grouped).map(([chatId, messages]) => {
    const ordered = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const last = ordered.at(-1);
    const counterpartId = last.senderId === currentUserId ? last.receiverId : last.senderId;
    const counterpart = usersDirectory.find((user) => user.id === counterpartId);
    return {
      id: chatId,
      type: "direct",
      name: counterpart?.name || counterpart?.username || `User ${counterpartId}`,
      avatar: counterpart?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${counterpartId}`,
      online: Boolean(counterpart?.isOnline),
      unreadCount: 0,
      lastMessage: last?.text || last?.type || "Start your conversation",
      lastMessageAt: last.timestamp,
      participants: [currentUserId, counterpartId],
      receiverId: counterpartId,
      username: counterpart?.username || counterpartId
    };
  });

  return { chatsList, messagesByChat: grouped };
}

export function useChatBootstrap() {
  const {
    authToken,
    currentUser,
    isAuthenticated,
    initialize,
    appendMessage,
    updateMessageStatus,
    setSocketSend,
    setSocketState,
    setError,
    setTyping,
    clearTyping,
    updateUserPresence
  } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !authToken || !currentUser?.id) return undefined;

    let activeSocket;
    let disposed = false;
    const typingTimeouts = new Map();

    async function bootstrap() {
      try {
        const [freshUser, usersDirectory, offlineMessages] = await Promise.all([
          getCurrentUser(),
          getUsers(),
          getOfflineMessages(currentUser.id)
        ]);
        if (disposed) return;
        const normalized = normalizeMessages(offlineMessages, freshUser.id, usersDirectory.filter((user) => user.id !== freshUser.id));
        initialize({
          currentUser: freshUser,
          usersDirectory: usersDirectory.filter((user) => user.id !== freshUser.id),
          chatsList: normalized.chatsList,
          messagesByChat: normalized.messagesByChat,
          activeChatId: normalized.chatsList[0]?.id || null
        });
      } catch {
        setError("Unable to load your chat data right now.");
      }

      activeSocket = connectSocket({
        token: authToken,
        onStatus: setSocketState,
        onEvent(payload) {
          if (payload.type === "message:new" && payload.message) {
            appendMessage(payload.message);
          }
          if (payload.type === "message:receipt" && payload.messageId) {
            const chatId = Object.keys(useChatStore.getState().messagesByChat).find((key) =>
              (useChatStore.getState().messagesByChat[key] || []).some((message) => message.id === payload.messageId)
            );
            if (chatId) {
              updateMessageStatus(chatId, payload.messageId, payload.status);
            }
          }
          if ((payload.type === "typing" || payload.type === "typing:user") && payload.senderId) {
            const state = useChatStore.getState();
            const chat = state.chatsList.find((item) => item.receiverId === payload.senderId);
            if (!chat) return;
            setTyping(chat.id, chat.name);
            window.clearTimeout(typingTimeouts.get(chat.id));
            const timeout = window.setTimeout(() => clearTyping(chat.id), 1600);
            typingTimeouts.set(chat.id, timeout);
          }
          if (payload.type === "user:status" && payload.userId) {
            updateUserPresence(payload.userId, payload.isOnline, payload.lastSeen);
          }
        }
      });
      setSocketSend((payload) => activeSocket?.send(payload));
    }

    bootstrap();

    return () => {
      disposed = true;
      typingTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      setSocketSend(() => {});
      activeSocket?.close();
    };
  }, [
    appendMessage,
    authToken,
    clearTyping,
    currentUser?.id,
    initialize,
    isAuthenticated,
    setError,
    setSocketSend,
    setSocketState,
    setTyping,
    updateMessageStatus,
    updateUserPresence
  ]);
}
