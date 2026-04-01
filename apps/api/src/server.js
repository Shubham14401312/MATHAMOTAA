import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import multer from "multer";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { config } from "./config.js";
import { verifyPassword } from "./security.js";
import {
  createChat,
  createUser,
  getAdminOverview,
  getChatState,
  getChatsByUserId,
  getAllUsers,
  getMessagesByUserId,
  getOrCreateDirectChatByUsers,
  getUserById,
  getUserByUsername,
  insertMessage,
  joinChatByInvite,
  setUserPresence,
  updateUserProfile,
  writeAdminAudit
} from "./db.js";
import { getLudoState, resetLudo, rollLudo, syncLudoPlayers, updatePlayerToken } from "./gameState.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

fs.mkdirSync(config.uploadDir, { recursive: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistDir = path.resolve(__dirname, "..", "public");
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.clientOrigin
  },
  perMessageDeflate: true
});

const upload = multer({
  dest: config.uploadDir,
  limits: {
    fileSize: config.uploadMaxBytes
  }
});

const connectedUsers = new Map();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(config.uploadDir));
app.use(express.static(webDistDir));

function issueToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      role: "user"
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

function issueAdminToken() {
  return jwt.sign(
    {
      sub: "admin",
      email: config.adminEmail,
      role: "admin"
    },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

function auth(req, res, next) {
  try {
    const raw = req.headers.authorization?.replace("Bearer ", "");
    req.user = jwt.verify(raw, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

function serializeMessage(message) {
  return {
    message_ID: message.id,
    chatId: message.chatId,
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
    status: message.status || "sent",
    timestamp: message.createdAt
  };
}

function receiverSocketId(userId) {
  const sockets = connectedUsers.get(String(userId));
  if (!sockets?.size) return null;
  return [...sockets][0];
}

function receiverSocketIds(userId) {
  return [...(connectedUsers.get(String(userId)) || [])];
}

function emitToUser(userId, event, payload) {
  receiverSocketIds(userId).forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });
}

function joinUserSocketsToRoom(userId, roomId) {
  receiverSocketIds(userId).forEach((socketId) => {
    io.sockets.sockets.get(socketId)?.join(roomId);
  });
}

function addConnectedUser(userId, socketId) {
  const key = String(userId);
  const sockets = connectedUsers.get(key) || new Set();
  sockets.add(socketId);
  connectedUsers.set(key, sockets);
}

function removeConnectedUser(userId, socketId) {
  const key = String(userId);
  const sockets = connectedUsers.get(key);
  if (!sockets) return 0;
  sockets.delete(socketId);
  if (!sockets.size) {
    connectedUsers.delete(key);
    return 0;
  }
  connectedUsers.set(key, sockets);
  return sockets.size;
}

function ensureRoomAccess(chatId, userId) {
  const chatState = getChatState(chatId, userId);
  if (!chatState) {
    return { error: { status: 404, message: "Room not found." } };
  }
  if (chatState.role === "guest") {
    return { error: { status: 403, message: "You are not a member of this room." } };
  }
  return { chatState };
}

function emitRoomState(chatId) {
  const ownerState = getChatState(chatId, null);
  if (!ownerState) return null;
  const game = getLudoState(ownerState);
  io.to(`room:${chatId}`).emit("room:state", {
    chat: ownerState.chat,
    inviteCode: ownerState.inviteCode,
    participants: ownerState.participants,
    game
  });
  return game;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "MATHAMOTA", uptime: process.uptime() });
});

app.post("/api/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const avatar = String(req.body?.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${username || "user"}`);

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    if (getUserByUsername(username)) {
      return res.status(409).json({ error: "Username already taken." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({
      username,
      passwordHash,
      avatar,
      name: username
    });
    writeAdminAudit("user_register", username);
    return res.status(201).json({
      message: "User registered successfully",
      token: issueToken(user),
      userId: user.id,
      user
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const userRecord = getUserByUsername(username);

    if (!userRecord) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = userRecord.passwordHash?.startsWith("$2")
      ? await bcrypt.compare(password, userRecord.passwordHash)
      : verifyPassword(password, userRecord.passwordHash || "");

    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = getUserById(userRecord.id);
    return res.status(200).json({
      token: issueToken(user),
      userId: user.id,
      username: user.username,
      user
    });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/me", auth, (req, res) => {
  const user = getUserById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(user);
});

app.get("/api/users", auth, (_req, res) => {
  return res.status(200).json(getAllUsers());
});

app.get("/api/chats", auth, (req, res) => {
  return res.json(getChatsByUserId(req.user.userId));
});

app.get("/api/chats/:chatId", auth, (req, res) => {
  const chatState = getChatState(req.params.chatId, req.user.userId);
  if (!chatState) {
    return res.status(404).json({ error: "Chat not found." });
  }
  if (chatState.role === "guest") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json(chatState);
});

app.post("/api/chats/direct", auth, (req, res) => {
  const partnerId = String(req.body?.partnerId || "");
  if (!partnerId) {
    return res.status(400).json({ error: "partnerId is required." });
  }
  if (partnerId === req.user.userId) {
    return res.status(400).json({ error: "You cannot create a chat with yourself." });
  }
  const partner = getUserById(partnerId);
  if (!partner) {
    return res.status(404).json({ error: "User not found." });
  }
  const chat = getOrCreateDirectChatByUsers(req.user.userId, partnerId);
  joinUserSocketsToRoom(req.user.userId, `room:${chat.id}`);
  joinUserSocketsToRoom(partnerId, `room:${chat.id}`);
  return res.json(getChatState(chat.id, req.user.userId));
});

app.post("/api/rooms", auth, (req, res) => {
  const title = String(req.body?.title || "Private room").trim();
  const chat = createChat({
    ownerId: req.user.userId,
    title: title || "Private room"
  });
  joinUserSocketsToRoom(req.user.userId, `room:${chat.id}`);
  return res.status(201).json(getChatState(chat.id, req.user.userId));
});

app.post("/api/rooms/join", auth, (req, res) => {
  const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();
  if (!inviteCode) {
    return res.status(400).json({ error: "inviteCode is required." });
  }
  const result = joinChatByInvite({ inviteCode, userId: req.user.userId });
  if (result.error === "INVITE_NOT_FOUND") {
    return res.status(404).json({ error: "Invite code not found." });
  }
  if (result.error === "ALREADY_IN_ROOM") {
    return res.status(409).json({ error: "You are already connected to a different room." });
  }
  if (result.error === "ROOM_FULL") {
    return res.status(409).json({ error: "That room is already full." });
  }

  const chatState = getChatState(result.chat.id, req.user.userId);
  joinUserSocketsToRoom(req.user.userId, `room:${result.chat.id}`);
  syncLudoPlayers(chatState);
  emitRoomState(result.chat.id);
  return res.json(chatState);
});

app.get("/api/rooms/:chatId", auth, (req, res) => {
  const access = ensureRoomAccess(req.params.chatId, req.user.userId);
  if (access.error) {
    return res.status(access.error.status).json({ error: access.error.message });
  }
  return res.json({
    ...access.chatState,
    game: getLudoState(access.chatState)
  });
});

app.post("/api/rooms/:chatId/token", auth, (req, res) => {
  const access = ensureRoomAccess(req.params.chatId, req.user.userId);
  if (access.error) {
    return res.status(access.error.status).json({ error: access.error.message });
  }
  const token = String(req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "token is required." });
  }
  const game = updatePlayerToken(access.chatState, req.user.userId, token);
  emitRoomState(req.params.chatId);
  return res.json({ game });
});

app.post("/api/rooms/:chatId/roll", auth, (req, res) => {
  const access = ensureRoomAccess(req.params.chatId, req.user.userId);
  if (access.error) {
    return res.status(access.error.status).json({ error: access.error.message });
  }
  const game = rollLudo(access.chatState, req.user.userId);
  emitRoomState(req.params.chatId);
  return res.json({ game });
});

app.post("/api/rooms/:chatId/reset", auth, (req, res) => {
  const access = ensureRoomAccess(req.params.chatId, req.user.userId);
  if (access.error) {
    return res.status(access.error.status).json({ error: access.error.message });
  }
  const game = resetLudo(access.chatState, req.user.userId);
  emitRoomState(req.params.chatId);
  return res.json({ game });
});

app.get("/messages/:userId", auth, (req, res) => {
  if (req.params.userId !== req.user.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json(getMessagesByUserId(req.params.userId));
});

app.post("/messages", auth, (req, res) => {
  const senderId = req.user.userId;
  const receiverId = String(req.body?.reciever_ID || "");
  const type = String(req.body?.type || "text");
  const text = String(req.body?.text || "");
  const mediaObject = req.body?.media_object || null;
  const document = req.body?.document || null;

  if (!receiverId) {
    return res.status(400).json({ error: "reciever_ID is required." });
  }

  const chat = getOrCreateDirectChatByUsers(senderId, receiverId);
  const message = insertMessage({
    chatId: chat.id,
    senderId,
    receiverId,
    kind: type,
    body: text,
    attachmentUrl: mediaObject?.url || null,
    attachmentName: mediaObject?.name || document || null,
    media_object: mediaObject,
    document,
    status: "sent"
  });

  const socketId = receiverSocketId(receiverId);
  if (socketId) {
    message.status = "delivered";
    emitToUser(receiverId, "receiveMessage", serializeMessage(message));
    emitToUser(receiverId, "messageStatus", { messageId: message.id, status: "delivered" });
    emitToUser(senderId, "messageStatus", { messageId: message.id, status: "delivered" });
  }

  return res.status(200).json({
    status: "sent",
    message: serializeMessage(message)
  });
});

app.post("/v1/media", auth, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File is required." });
  }

  const ext = path.extname(req.file.originalname);
  const finalName = `${uuid()}${ext}`;
  const finalPath = path.join(config.uploadDir, finalName);
  fs.renameSync(req.file.path, finalPath);

  return res.json({
    ok: true,
    file_id: finalName,
    id: finalName,
    url: `${config.publicAppUrl.replace(/\/$/, "")}/v1/media/${req.user.userId}/${finalName}`
  });
});

app.get("/v1/media/:userId/:fileId", auth, (req, res) => {
  const filePath = path.join(config.uploadDir, req.params.fileId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }
  return res.sendFile(filePath);
});

app.post("/profile", auth, (req, res) => {
  const updatedUser = updateUserProfile(req.user.userId, req.body || {});
  if (!updatedUser) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({
    user: updatedUser,
    token: issueToken(updatedUser)
  });
});

app.post("/auth/admin", (req, res) => {
  const email = String(req.body?.email || "");
  const password = String(req.body?.password || "");
  const plainMatch = config.adminPassword && password === config.adminPassword;
  const hashMatch = config.adminPasswordHash && verifyPassword(password, config.adminPasswordHash);
  if (email !== config.adminEmail || (!plainMatch && !hashMatch)) {
    return res.status(401).json({ error: "Invalid admin credentials." });
  }
  writeAdminAudit("admin_login", email);
  return res.json({ token: issueAdminToken() });
});

app.get("/admin/overview", auth, adminOnly, (_req, res) => {
  return res.json(getAdminOverview());
});

app.get("*", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/messages") ||
    req.path.startsWith("/v1") ||
    req.path.startsWith("/admin") ||
    req.path.startsWith("/auth") ||
    req.path.startsWith("/profile") ||
    req.path.startsWith("/uploads") ||
    req.path.startsWith("/socket.io")
  ) {
    return next();
  }
  const indexPath = path.join(webDistDir, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).json({ error: "Web build not found. Run npm run build first." });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));
    const decoded = jwt.verify(token, config.jwtSecret);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  const userId = String(socket.user.userId);
  addConnectedUser(userId, socket.id);
  socket.join(`user:${userId}`);
  getChatsByUserId(userId).forEach((chatState) => {
    socket.join(`room:${chatState.chat.id}`);
  });

  if (receiverSocketIds(userId).length === 1) {
    const presence = setUserPresence(userId, true);
    io.emit("userStatusUpdate", { userId, isOnline: true, lastSeen: presence?.lastSeen || new Date().toISOString() });
  }

  async function handleSendMessage(data, callback = () => {}) {
    try {
      const receiverId = String(data?.receiverId || data?.reciever_ID || "");
      const content = String(data?.content || data?.text || "").trim();
      if (!receiverId || !content) {
        callback({ status: "error", error: "receiverId and content are required" });
        return;
      }

      const chat = getOrCreateDirectChatByUsers(userId, receiverId);
      const message = insertMessage({
        chatId: chat.id,
        senderId: userId,
        receiverId,
        kind: "text",
        body: content,
        attachmentUrl: null,
        attachmentName: null,
        status: "sent"
      });

      callback({ status: "sent", message: serializeMessage(message) });
      socket.emit("messageStatus", { messageId: message.id, status: "sent" });

      if (receiverSocketIds(receiverId).length) {
        emitToUser(receiverId, "receiveMessage", serializeMessage({ ...message, status: "delivered" }));
        emitToUser(userId, "messageStatus", { messageId: message.id, status: "delivered" });
      }
    } catch {
      callback({ status: "error", error: "Failed to send message" });
    }
  }

  socket.on("sendMessage", handleSendMessage);

  socket.on("message:send", (data, callback = () => {}) => {
    handleSendMessage(data, callback);
  });

  socket.on("typing", (data) => {
    emitToUser(data?.receiverId, "userTyping", { senderId: userId });
  });

  socket.on("chat:read", ({ senderId }) => {
    emitToUser(senderId, "messageStatus", { senderId: userId, status: "read" });
  });

  socket.on("room:join", ({ chatId }, callback = () => {}) => {
    const access = ensureRoomAccess(chatId, userId);
    if (access.error) {
      callback({ status: "error", error: access.error.message });
      return;
    }
    socket.join(`room:${chatId}`);
    callback({
      status: "joined",
      room: {
        ...access.chatState,
        game: getLudoState(access.chatState)
      }
    });
  });

  socket.on("game:roll", ({ chatId }, callback = () => {}) => {
    const access = ensureRoomAccess(chatId, userId);
    if (access.error) {
      callback({ status: "error", error: access.error.message });
      return;
    }
    const game = rollLudo(access.chatState, userId);
    emitRoomState(chatId);
    callback({ status: "ok", game });
  });

  socket.on("game:reset", ({ chatId }, callback = () => {}) => {
    const access = ensureRoomAccess(chatId, userId);
    if (access.error) {
      callback({ status: "error", error: access.error.message });
      return;
    }
    const game = resetLudo(access.chatState, userId);
    emitRoomState(chatId);
    callback({ status: "ok", game });
  });

  socket.on("disconnect", async () => {
    const remainingConnections = removeConnectedUser(userId, socket.id);
    if (!remainingConnections) {
      const presence = setUserPresence(userId, false);
      io.emit("userStatusUpdate", {
        userId,
        isOnline: false,
        lastSeen: presence?.lastSeen || new Date().toISOString()
      });
    }
  });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`MATHAMOTA API listening on 0.0.0.0:${config.port}`);
  console.log(`Static build directory: ${webDistDir}`);
  console.log(`Static build present: ${fs.existsSync(path.join(webDistDir, "index.html"))}`);
});
