import { useEffect } from "react";
import { getChat, getChats, getCurrentUser, getOfflineMessages, getUsers } from "../services/api.js";
import { connectSocket } from "../services/socket.js";
import { useChatStore } from "../store/chatStore.js";

function normalizeMessages(rawMessages) {
  const grouped = {};
  for (const entry of rawMessages) {
    const chatId = entry.chatId;
    if (!chatId) continue;
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

  return grouped;
}

function normalizeChats(chatStates, groupedMessages, currentUserId) {
  return chatStates.map((entry) => {
    const chatId = entry.chat.id;
    const messages = [...(groupedMessages[chatId] || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const counterpart =
      entry.participants.owner?.id === currentUserId ? entry.participants.partner : entry.participants.owner;
    const counterpartId = counterpart?.id || entry.participants.owner?.id || entry.participants.partner?.id || chatId;
    const last = messages.at(-1);

    return {
      id: chatId,
      type: "direct",
      name: counterpart?.name || counterpart?.username || `User ${counterpartId}`,
      avatar: counterpart?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${counterpartId}`,
      online: Boolean(counterpart?.isOnline),
      unreadCount: 0,
      lastMessage: last?.text || last?.type || "Start your conversation",
      lastMessageAt: last?.timestamp || entry.chat.created_at,
      participants: [entry.participants.owner?.id, entry.participants.partner?.id].filter(Boolean),
      receiverId: counterpartId,
      username: counterpart?.username || counterpartId,
      inviteCode: entry.inviteCode
    };
  });
}

function normalizeChat(entry, currentUserId, groupedMessages) {
  return normalizeChats([entry], groupedMessages, currentUserId)[0];
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
    setRoomState,
    upsertChat,
    updateUserPresence
  } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !authToken || !currentUser?.id) return undefined;

    let activeSocket;
    let disposed = false;
    const typingTimeouts = new Map();

    async function bootstrap() {
      try {
        const [freshUser, usersDirectory, offlineMessages, chatStates] = await Promise.all([
          getCurrentUser(),
          getUsers(),
          getOfflineMessages(currentUser.id),
          getChats()
        ]);
        if (disposed) return;
        const filteredUsers = usersDirectory.filter((user) => user.id !== freshUser.id);
        const groupedMessages = normalizeMessages(offlineMessages);
        const chatsList = normalizeChats(chatStates, groupedMessages, freshUser.id);
        initialize({
          currentUser: freshUser,
          usersDirectory: filteredUsers,
          chatsList,
          messagesByChat: groupedMessages,
          activeChatId: chatsList[0]?.id || null
        });
      } catch {
        setError("Unable to load your chat data right now.");
      }

      activeSocket = connectSocket({
        token: authToken,
        onStatus: setSocketState,
        async onEvent(payload) {
          if (payload.type === "message:new" && payload.message) {
            const stateBeforeAppend = useChatStore.getState();
            if (!stateBeforeAppend.chatsList.some((chat) => chat.id === payload.message.chatId)) {
              try {
                const chatState = await getChat(payload.message.chatId);
                const normalizedChat = normalizeChat(
                  chatState,
                  useChatStore.getState().currentUser.id,
                  useChatStore.getState().messagesByChat
                );
                if (normalizedChat) {
                  upsertChat(normalizedChat);
                }
              } catch {
                // Leave the message cached even if chat metadata fetch fails.
              }
            }
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
          if (payload.type === "room:state" && payload.room) {
            setRoomState(payload.room);
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
    setRoomState,
    upsertChat,
    updateMessageStatus,
    updateUserPresence
  ]);
}
