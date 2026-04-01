import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import { config } from "./config.js";

const dbFilePath = path.join(config.storageDir, "db.json");

function now() {
  return new Date().toISOString();
}

function ensureStorage() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(
      dbFilePath,
      JSON.stringify(
        {
          users: [],
          chats: [],
          messages: [],
          adminAudit: []
        },
        null,
        2
      )
    );
  }
}

function readState() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(dbFilePath, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(dbFilePath, JSON.stringify(state, null, 2));
}

function cryptoCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    name: user.name || user.username,
    avatar: user.avatar || "Bloom",
    tokenPiece: user.tokenPiece || "\u2728",
    createdAt: user.createdAt,
    lastSeen: user.lastSeen || user.createdAt,
    isOnline: Boolean(user.isOnline)
  };
}

function chatParticipants(state, chat) {
  return {
    owner: normalizeUser(state.users.find((user) => user.id === chat.owner_id)),
    partner: normalizeUser(state.users.find((user) => user.id === chat.partner_id))
  };
}

function clientDirectChatId(userA, userB) {
  return [String(userA), String(userB)].sort().join(":");
}

function serializeChatState(state, chat, currentUserId) {
  const participants = chatParticipants(state, chat);
  const role =
    currentUserId === chat.owner_id ? "owner" : currentUserId === chat.partner_id ? "partner" : "guest";

  return {
    chat,
    inviteCode: chat.inviteCode,
    participants,
    role
  };
}

export function getUserByEmail(email) {
  const state = readState();
  return state.users.find((user) => (user.email || "").toLowerCase() === email.toLowerCase()) || null;
}

export function getUserByUsername(username) {
  const state = readState();
  return state.users.find((user) => (user.username || "").toLowerCase() === username.toLowerCase()) || null;
}

export function createUser({ username, passwordHash, name, avatar = "Bloom", tokenPiece = "\u2728" }) {
  const state = readState();
  const user = {
    id: uuid(),
    username,
    passwordHash,
    name: name || username,
    avatar,
    tokenPiece,
    createdAt: now(),
    lastSeen: now(),
    isOnline: false
  };
  state.users.push(user);
  writeState(state);
  return normalizeUser(user);
}

export function updateUserProfile(userId, profile) {
  const state = readState();
  const user = state.users.find((item) => item.id === userId);
  if (!user) return null;
  if (profile.name) user.name = profile.name;
  if (profile.avatar) user.avatar = profile.avatar;
  if (profile.tokenPiece) user.tokenPiece = profile.tokenPiece;
  writeState(state);
  return normalizeUser(user);
}

export function getUserById(id) {
  const state = readState();
  const user = state.users.find((item) => item.id === id);
  return normalizeUser(user);
}

export function getAllUsers() {
  const state = readState();
  return state.users.map(normalizeUser);
}

export function setUserPresence(userId, isOnline) {
  const state = readState();
  const user = state.users.find((item) => item.id === userId);
  if (!user) return null;
  user.isOnline = Boolean(isOnline);
  user.lastSeen = now();
  writeState(state);
  return normalizeUser(user);
}

export function getPrimaryChatByUserId(userId) {
  const state = readState();
  return state.chats.find((chat) => chat.owner_id === userId || chat.partner_id === userId) || null;
}

export function getChatsByUserId(userId) {
  const state = readState();
  return state.chats
    .filter((chat) => chat.owner_id === userId || chat.partner_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((chat) => serializeChatState(state, chat, userId));
}

export function getOrCreateDirectChatByUsers(userA, userB) {
  const state = readState();
  let chat = state.chats.find((item) => {
    return (
      (item.owner_id === userA && item.partner_id === userB) ||
      (item.owner_id === userB && item.partner_id === userA)
    );
  });

  if (!chat) {
    chat = {
      id: uuid(),
      inviteCode: cryptoCode(),
      owner_id: userA,
      partner_id: userB,
      title: "Private chat",
      wallpaper: "blush",
      gallery_visible: 1,
      created_at: now()
    };
    state.chats.push(chat);
    writeState(state);
  }

  return chat;
}

export function createChat({ ownerId, title }) {
  const state = readState();
  const existing = state.chats.find((chat) => chat.owner_id === ownerId);
  if (existing) return existing;
  const chat = {
    id: uuid(),
    inviteCode: cryptoCode(),
    owner_id: ownerId,
    partner_id: null,
    title,
    wallpaper: "blush",
    gallery_visible: 1,
    created_at: now()
  };
  state.chats.push(chat);
  writeState(state);
  return chat;
}

export function joinChatByInvite({ inviteCode, userId }) {
  const state = readState();
  const chat = state.chats.find((item) => item.inviteCode === inviteCode);
  if (!chat) return { error: "INVITE_NOT_FOUND" };
  const currentMembership = state.chats.find(
    (item) =>
      (item.owner_id === userId || item.partner_id === userId) &&
      item.id !== chat.id
  );
  if (currentMembership) {
    return { error: "ALREADY_IN_ROOM" };
  }
  if (chat.owner_id === userId || chat.partner_id === userId) {
    return { chat };
  }
  if (chat.partner_id) {
    return { error: "ROOM_FULL" };
  }
  chat.partner_id = userId;
  writeState(state);
  return { chat };
}

export function getChat(chatId) {
  const state = readState();
  return state.chats.find((chat) => chat.id === chatId) || null;
}

export function getChatState(chatId, currentUserId) {
  const state = readState();
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return null;
  return serializeChatState(state, chat, currentUserId);
}

export function getMessages(chatId) {
  const state = readState();
  return state.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getMessagesByUserId(userId) {
  const state = readState();
  const chatIds = new Set(
    state.chats
      .filter((chat) => chat.owner_id === userId || chat.partner_id === userId)
      .map((chat) => chat.id)
  );

  return state.messages
    .filter((message) => chatIds.has(message.chatId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((message) => ({
      message_ID: message.id,
      chatId: clientDirectChatId(message.senderId, message.receiverId),
      sender_ID: message.senderId,
      reciever_ID: message.receiverId,
      type: message.kind || "text",
      text: message.body || "",
      media_object: message.attachmentUrl
        ? {
            url: message.attachmentUrl,
            name: message.attachmentName || message.kind
          }
        : message.media_object || null,
      document: message.attachmentName || message.document || null,
      status: message.status || "delivered",
      timestamp: message.createdAt
    }));
}

export function insertMessage(message) {
  const state = readState();
  const payload = {
    id: uuid(),
    createdAt: now(),
    ...message
  };
  state.messages.push(payload);
  writeState(state);
  return payload;
}

export function updateChatPrefs(chatId, prefs) {
  const state = readState();
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return null;
  if (prefs.wallpaper !== undefined) chat.wallpaper = prefs.wallpaper;
  if (typeof prefs.galleryVisible === "boolean") {
    chat.gallery_visible = Number(prefs.galleryVisible);
  }
  writeState(state);
  return chat;
}

export function getAdminOverview() {
  const state = readState();
  const recentMessages = [...state.messages]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((message) => {
      const sender = state.users.find((user) => user.id === message.senderId);
      return {
        body: message.body,
        kind: message.kind,
        createdAt: message.createdAt,
        sender: sender?.name || "Unknown"
      };
    });

  return {
    users: state.users.length,
    chats: state.chats.length,
    messages: state.messages.length,
    recentMessages
  };
}

export function writeAdminAudit(action, detail) {
  const state = readState();
  state.adminAudit.push({
    id: uuid(),
    action,
    detail,
    createdAt: now()
  });
  writeState(state);
}
