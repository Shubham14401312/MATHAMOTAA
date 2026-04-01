import { create } from "zustand";
import { loadCachedState, saveCachedState } from "../lib/cache.js";
import { mockChats, mockCurrentUser, mockMessages } from "../mockData.js";

const cached = loadCachedState();

function sortMessages(items) {
  return [...items].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function persist(state) {
  saveCachedState({
    currentUser: state.currentUser,
    chatsList: state.chatsList,
    activeChatId: state.activeChatId,
    messagesByChat: state.messagesByChat
  });
}

export const useChatStore = create((set, get) => ({
  currentUser: cached?.currentUser || mockCurrentUser,
  chatsList: cached?.chatsList || mockChats,
  activeChatId: cached?.activeChatId || mockChats[0]?.id || null,
  messagesByChat: cached?.messagesByChat || mockMessages,
  socketState: "offline",
  searchTerm: "",
  error: "",
  sending: false,
  mobileChatOpen: false,
  installPromptEvent: null,
  initialize(payload) {
    const nextState = {
      currentUser: payload.currentUser,
      chatsList: payload.chatsList,
      activeChatId: payload.activeChatId || payload.chatsList[0]?.id || null,
      messagesByChat: payload.messagesByChat
    };
    set(nextState);
    persist({ ...get(), ...nextState });
  },
  setError(error) {
    set({ error });
  },
  setSocketState(socketState) {
    set({ socketState });
  },
  setSearchTerm(searchTerm) {
    set({ searchTerm });
  },
  setInstallPromptEvent(installPromptEvent) {
    set({ installPromptEvent });
  },
  selectChat(chatId) {
    const nextChats = get().chatsList.map((chat) =>
      chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    );
    const nextState = { activeChatId: chatId, chatsList: nextChats, mobileChatOpen: true };
    set(nextState);
    persist({ ...get(), ...nextState });
  },
  openSidebar() {
    set({ mobileChatOpen: false });
  },
  appendMessage(message) {
    const state = get();
    const messages = state.messagesByChat[message.chatId] || [];
    const nextMessages = {
      ...state.messagesByChat,
      [message.chatId]: sortMessages([...messages, message])
    };
    const nextChats = state.chatsList.map((chat) =>
      chat.id === message.chatId
        ? {
            ...chat,
            lastMessage: message.type === "text" ? message.text : message.type,
            lastMessageAt: message.timestamp,
            unreadCount:
              message.senderId !== state.currentUser.id ? (chat.unreadCount || 0) + 1 : chat.unreadCount || 0
          }
        : chat
    );
    set({ messagesByChat: nextMessages, chatsList: nextChats });
    persist({ ...state, messagesByChat: nextMessages, chatsList: nextChats });
  },
  updateMessageStatus(chatId, messageId, status) {
    const state = get();
    const nextMessages = {
      ...state.messagesByChat,
      [chatId]: (state.messagesByChat[chatId] || []).map((item) =>
        item.id === messageId ? { ...item, status } : item
      )
    };
    set({ messagesByChat: nextMessages });
    persist({ ...state, messagesByChat: nextMessages });
  }
}));
