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
    const initialState = {
      users: [],
      chats: [],
      messages: [],
      adminAudit: []
    };
    fs.writeFileSync(dbFilePath, JSON.stringify(initialState, null, 2));
  }
}

function readState() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(dbFilePath, "utf8"));
}

function writeState(state) {
  fs.writeFileSync(dbFilePath, JSON.stringify(state, null, 2));
}

function cryptoInvite() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export function createUser(name) {
  const state = readState();
  const user = {
    id: uuid(),
    name,
    inviteCode: cryptoInvite(),
    createdAt: now()
  };
  state.users.push(user);
  writeState(state);
  return user;
}

export function createChat({ ownerId, title }) {
  const state = readState();
  const chat = {
    id: uuid(),
    owner_id: ownerId,
    partner_id: null,
    title,
    wallpaper: "aurora",
    gallery_visible: 1,
    created_at: now()
  };
  state.chats.push(chat);
  writeState(state);
  return chat;
}

export function joinChatByInvite({ inviteCode, partnerId }) {
  const state = readState();
  const owner = state.users.find((user) => user.inviteCode === inviteCode || user.invite_code === inviteCode);
  if (!owner) return null;
  const chat = state.chats.find((item) => item.owner_id === owner.id);
  if (!chat) return null;
  chat.partner_id = partnerId;
  writeState(state);
  return chat;
}

export function getChat(chatId) {
  const state = readState();
  return state.chats.find((chat) => chat.id === chatId) || null;
}

export function getUserById(id) {
  const state = readState();
  return state.users.find((user) => user.id === id) || null;
}

export function getMessages(chatId) {
  const state = readState();
  return state.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
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
