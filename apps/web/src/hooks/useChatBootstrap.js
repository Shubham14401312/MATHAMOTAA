import { useEffect } from "react";
import { getOfflineMessages } from "../services/api.js";
import { connectSocket } from "../services/socket.js";
import { mockChats, mockCurrentUser, mockMessages } from "../mockData.js";
import { useChatStore } from "../store/chatStore.js";

function normalizeMessages(rawMessages, currentUserId) {
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
    const counterpart = last.senderId === currentUserId ? last.receiverId : last.senderId;
    return {
      id: chatId,
      type: "direct",
      name: `Contact ${counterpart}`,
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${counterpart}`,
      online: false,
      unreadCount: 0,
      lastMessage: last.text || last.type,
      lastMessageAt: last.timestamp,
      participants: [currentUserId, counterpart]
    };
  });

  return { chatsList, messagesByChat: grouped };
}

export function useChatBootstrap() {
  const {
    currentUser,
    initialize,
    appendMessage,
    updateMessageStatus,
    setSocketState,
    setError
  } = useChatStore();

  useEffect(() => {
    let activeSocket;

    async function bootstrap() {
      try {
        const offlineMessages = await getOfflineMessages(currentUser.id);
        const normalized = normalizeMessages(offlineMessages, currentUser.id);
        if (normalized.chatsList.length) {
          initialize({
            currentUser,
            chatsList: normalized.chatsList,
            messagesByChat: normalized.messagesByChat,
            activeChatId: normalized.chatsList[0].id
          });
        } else {
          initialize({
            currentUser: mockCurrentUser,
            chatsList: mockChats,
            messagesByChat: mockMessages,
            activeChatId: mockChats[0].id
          });
        }
      } catch {
        initialize({
          currentUser: mockCurrentUser,
          chatsList: mockChats,
          messagesByChat: mockMessages,
          activeChatId: mockChats[0].id
        });
        setError("Backend is unavailable, so cached or demo chat data is shown.");
      }

      activeSocket = connectSocket({
        userId: currentUser.id,
        onStatus: setSocketState,
        onEvent(payload) {
          if (payload.type === "message:new" && payload.message) {
            appendMessage(payload.message);
          }
          if (payload.type === "message:receipt" && payload.chatId && payload.messageId) {
            updateMessageStatus(payload.chatId, payload.messageId, payload.status);
          }
        }
      });
    }

    bootstrap();

    return () => {
      activeSocket?.close();
    };
  }, [appendMessage, currentUser.id, initialize, setError, setSocketState, updateMessageStatus]);
}
