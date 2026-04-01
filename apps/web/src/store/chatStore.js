import { create } from "zustand";
import { clearAuthState, loadAuthState, loadCachedState, saveAuthState, saveCachedState } from "../lib/cache.js";
import { mockChats, mockCurrentUser, mockMessages } from "../mockData.js";
import { setApiToken } from "../services/api.js";

const cached = loadCachedState();
const authCached = loadAuthState();

function sortMessages(items) {
  return [...items].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function persist(state) {
  saveCachedState({
    currentUser: state.currentUser,
    chatsList: state.chatsList,
    activeChatId: state.activeChatId,
    messagesByChat: state.messagesByChat,
    usersDirectory: state.usersDirectory
  });
}

if (authCached?.token) {
  setApiToken(authCached.token);
}

export const useChatStore = create((set, get) => ({
  currentUser: authCached?.user || cached?.currentUser || null,
  authToken: authCached?.token || "",
  isAuthenticated: Boolean(authCached?.token && authCached?.user),
  usersDirectory: cached?.usersDirectory || [],
  chatsList: cached?.chatsList || mockChats,
  activeChatId: cached?.activeChatId || mockChats[0]?.id || null,
  messagesByChat: cached?.messagesByChat || mockMessages,
  socketState: "offline",
  socketSend: () => {},
  searchTerm: "",
  onlineOnly: false,
  error: "",
  sending: false,
  mobileChatOpen: false,
  installPromptEvent: null,
  typingByChat: {},
  initialize(payload) {
    const nextState = {
      currentUser: payload.currentUser,
      usersDirectory: payload.usersDirectory || [],
      chatsList: payload.chatsList,
      activeChatId: payload.activeChatId || payload.chatsList[0]?.id || null,
      messagesByChat: payload.messagesByChat
    };
    set(nextState);
    persist({ ...get(), ...nextState });
  },
  setSession({ token, user }) {
    setApiToken(token);
    const nextState = {
      authToken: token,
      currentUser: user,
      isAuthenticated: true
    };
    set(nextState);
    saveAuthState({ token, user });
    persist({ ...get(), ...nextState });
  },
  clearSession() {
    setApiToken("");
    clearAuthState();
    set({
      authToken: "",
      currentUser: null,
      isAuthenticated: false,
      usersDirectory: [],
      chatsList: [],
      activeChatId: null,
      messagesByChat: {},
      mobileChatOpen: false
    });
    persist({
      ...get(),
      currentUser: null,
      usersDirectory: [],
      chatsList: [],
      activeChatId: null,
      messagesByChat: {}
    });
  },
  setUsersDirectory(usersDirectory) {
    set({ usersDirectory });
    persist({ ...get(), usersDirectory });
  },
  setError(error) {
    set({ error });
  },
  setSending(sending) {
    set({ sending });
  },
  setSocketState(socketState) {
    set({ socketState });
  },
  setSocketSend(socketSend) {
    set({ socketSend });
  },
  setSearchTerm(searchTerm) {
    set({ searchTerm });
  },
  setOnlineOnly(onlineOnly) {
    set({ onlineOnly });
  },
  setInstallPromptEvent(installPromptEvent) {
    set({ installPromptEvent });
  },
  updateCurrentUser(patch) {
    const state = get();
    const nextCurrentUser = {
      ...state.currentUser,
      ...patch
    };
    set({ currentUser: nextCurrentUser });
    saveAuthState({ token: state.authToken, user: nextCurrentUser });
    persist({ ...state, currentUser: nextCurrentUser });
  },
  createChat(name) {
    const state = get();
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName) return null;
    const targetUser = state.usersDirectory.find((user) => user.username === trimmedName);
    if (!targetUser || !state.currentUser) return null;
    const chatId = [state.currentUser.id, targetUser.id].sort().join(":");
    const existing = state.chatsList.find((chat) => chat.id === chatId);
    if (existing) {
      set({ activeChatId: existing.id, mobileChatOpen: true });
      return existing.id;
    }
    const nextChat = {
      id: chatId,
      type: "direct",
      name: targetUser.name || targetUser.username,
      avatar: targetUser.avatar,
      online: Boolean(targetUser.isOnline),
      unreadCount: 0,
      lastMessage: "Start your conversation",
      lastMessageAt: new Date().toISOString(),
      participants: [state.currentUser.id, targetUser.id],
      receiverId: targetUser.id,
      username: targetUser.username
    };
    const nextChats = [nextChat, ...state.chatsList];
    const nextMessages = {
      ...state.messagesByChat,
      [chatId]: []
    };
    const nextState = {
      chatsList: nextChats,
      activeChatId: chatId,
      messagesByChat: nextMessages,
      mobileChatOpen: true
    };
    set(nextState);
    persist({ ...state, ...nextState });
    return chatId;
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
  setTyping(chatId, name) {
    const state = get();
    const nextTyping = {
      ...state.typingByChat,
      [chatId]: name
    };
    set({ typingByChat: nextTyping });
  },
  clearTyping(chatId) {
    const state = get();
    const nextTyping = { ...state.typingByChat };
    delete nextTyping[chatId];
    set({ typingByChat: nextTyping });
  },
  appendMessage(message) {
    const state = get();
    const messages = state.messagesByChat[message.chatId] || [];
    if (messages.some((item) => item.id === message.id)) {
      return;
    }
    const nextMessages = {
      ...state.messagesByChat,
      [message.chatId]: sortMessages([...messages, message])
    };
    const nextChats = state.chatsList.some((chat) => chat.id === message.chatId)
      ? state.chatsList.map((chat) =>
          chat.id === message.chatId
            ? {
                ...chat,
                lastMessage: message.type === "text" ? message.text : message.type,
                lastMessageAt: message.timestamp,
                unreadCount:
                  message.senderId !== state.currentUser?.id ? (chat.unreadCount || 0) + 1 : chat.unreadCount || 0
              }
            : chat
        )
      : state.chatsList;
    set({ messagesByChat: nextMessages, chatsList: nextChats });
    persist({ ...state, messagesByChat: nextMessages, chatsList: nextChats });
  },
  updateUserPresence(userId, isOnline, lastSeen) {
    const state = get();
    const nextUsers = state.usersDirectory.map((user) =>
      user.id === userId ? { ...user, isOnline, lastSeen } : user
    );
    const nextChats = state.chatsList.map((chat) =>
      chat.receiverId === userId ? { ...chat, online: isOnline, lastSeen } : chat
    );
    set({ usersDirectory: nextUsers, chatsList: nextChats });
    persist({ ...state, usersDirectory: nextUsers, chatsList: nextChats });
  },
  simulateReceiptLifecycle(chatId, messageId) {
    setTimeout(() => get().updateMessageStatus(chatId, messageId, "delivered"), 1200);
    setTimeout(() => get().updateMessageStatus(chatId, messageId, "read"), 3200);
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
