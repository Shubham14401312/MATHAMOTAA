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
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { config } from "./config.js";
import { hashPassword, verifyPassword } from "./security.js";
import {
  createChat,
  createUser,
  getAdminOverview,
  getChatState,
  getMessages,
  getPrimaryChatByUserId,
  getUserByEmail,
  getUserById,
  insertMessage,
  joinChatByInvite,
  updateChatPrefs,
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

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(config.uploadDir));
app.use(express.static(webDistDir));

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      tokenPiece: user.tokenPiece,
      role: "user"
    },
    config.jwtSecret,
    { expiresIn: "30d" }
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

function attachActiveChat(userId) {
  const activeChat = getPrimaryChatByUserId(userId);
  if (!activeChat) return null;
  return getChatState(activeChat.id, userId);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "MATHAMOTA", uptime: process.uptime() });
});

app.post("/auth/signup", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const avatar = String(req.body?.avatar || "Bloom").trim();
  const tokenPiece = String(req.body?.tokenPiece || "\u2728").trim();

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (getUserByEmail(email)) {
    return res.status(409).json({ error: "This email already has an account. Please log in." });
  }

  const user = createUser({
    email,
    passwordHash: hashPassword(password),
    name,
    avatar,
    tokenPiece
  });
  writeAdminAudit("user_signup", email);
  return res.json({
    token: issueToken(user),
    user
  });
});

app.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const userRecord = getUserByEmail(email);
  if (!userRecord || !verifyPassword(password, userRecord.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const user = getUserById(userRecord.id);
  const activeChat = attachActiveChat(user.id);
  return res.json({
    token: issueToken(user),
    user,
    activeChat,
    notice: activeChat ? "You were already signed in, so the app brought you back to your room." : ""
  });
});

app.get("/auth/me", auth, (req, res) => {
  const user = getUserById(req.user.sub);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({
    user,
    activeChat: attachActiveChat(user.id)
  });
});

app.post("/rooms/create", auth, (req, res) => {
  const title = String(req.body?.title || "Our room").trim();
  const chat = createChat({ ownerId: req.user.sub, title });
  const chatState = getChatState(chat.id, req.user.sub);
  writeAdminAudit("chat_created", `${req.user.email} created ${chat.id}`);
  return res.json(chatState);
});

app.post("/rooms/join", auth, (req, res) => {
  const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();
  if (!inviteCode) {
    return res.status(400).json({ error: "Invite code is required." });
  }

  const joinResult = joinChatByInvite({ inviteCode, userId: req.user.sub });
  if (joinResult.error === "INVITE_NOT_FOUND") {
    return res.status(404).json({ error: "Invite code not found." });
  }
  if (joinResult.error === "ROOM_FULL") {
    return res.status(409).json({ error: "This private room already has two people." });
  }
  if (joinResult.error === "ALREADY_IN_ROOM") {
    return res.status(409).json({ error: "This account is already inside another room." });
  }

  const chatState = getChatState(joinResult.chat.id, req.user.sub);
  writeAdminAudit("chat_joined", `${req.user.email} joined ${joinResult.chat.id}`);
  return res.json(chatState);
});

app.get("/chat/:chatId/state", auth, (req, res) => {
  const chatState = getChatState(req.params.chatId, req.user.sub);
  if (!chatState) {
    return res.status(404).json({ error: "Chat not found." });
  }
  syncLudoPlayers(chatState);
  return res.json({
    ...chatState,
    messages: getMessages(req.params.chatId),
    ludo: getLudoState(chatState)
  });
});

app.post("/profile", auth, (req, res) => {
  const updatedUser = updateUserProfile(req.user.sub, req.body || {});
  if (!updatedUser) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({
    user: updatedUser,
    token: issueToken(updatedUser)
  });
});

app.post("/chat/:chatId/preferences", auth, (req, res) => {
  const updated = updateChatPrefs(req.params.chatId, req.body || {});
  return res.json(updated);
});

app.post("/chat/:chatId/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File is required." });
  }
  const ext = path.extname(req.file.originalname);
  const finalName = `${uuid()}${ext}`;
  const finalPath = path.join(config.uploadDir, finalName);
  fs.renameSync(req.file.path, finalPath);
  const attachmentUrl = `${config.publicAppUrl.replace(/\/$/, "")}/uploads/${finalName}`;
  const message = insertMessage({
    chatId: req.params.chatId,
    senderId: req.user.sub,
    kind: "file",
    body: req.body?.caption || "",
    attachmentUrl,
    attachmentName: req.file.originalname
  });
  io.to(req.params.chatId).emit("message:new", {
    ...message,
    senderName: getUserById(req.user.sub)?.name || req.user.name
  });
  return res.json(message);
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
    req.path.startsWith("/auth") ||
    req.path.startsWith("/rooms") ||
    req.path.startsWith("/chat") ||
    req.path.startsWith("/admin") ||
    req.path.startsWith("/uploads") ||
    req.path.startsWith("/profile") ||
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
    socket.data.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ chatId }) => {
    const chatState = getChatState(chatId, socket.data.user.sub);
    if (!chatState) return;
    socket.join(chatId);
    syncLudoPlayers(chatState);
    socket.emit("room:snapshot", {
      ...chatState,
      messages: getMessages(chatId),
      ludo: getLudoState(chatState)
    });
    socket.to(chatId).emit("room:meta", {
      ...getChatState(chatId, socket.data.user.sub),
      ludo: getLudoState(chatState)
    });
  });

  socket.on("typing", ({ chatId, name }) => {
    socket.to(chatId).emit("typing", { name });
  });

  socket.on("message:send", ({ chatId, body, kind = "text" }) => {
    if (!body?.trim()) return;
    const sender = getUserById(socket.data.user.sub);
    const message = insertMessage({
      chatId,
      senderId: socket.data.user.sub,
      kind,
      body,
      attachmentUrl: null,
      attachmentName: null
    });
    io.to(chatId).emit("message:new", {
      ...message,
      senderName: sender?.name || socket.data.user.name
    });
  });

  socket.on("game:ludo:roll", ({ chatId }) => {
    const chatState = getChatState(chatId, socket.data.user.sub);
    if (!chatState) return;
    const ludo = rollLudo(chatState, socket.data.user.sub);
    io.to(chatId).emit("game:ludo", ludo);
  });

  socket.on("game:ludo:reset", ({ chatId }) => {
    const chatState = getChatState(chatId, socket.data.user.sub);
    if (!chatState) return;
    const ludo = resetLudo(chatState, socket.data.user.sub);
    io.to(chatId).emit("game:ludo", ludo);
  });

  socket.on("game:ludo:token", ({ chatId, tokenPiece }) => {
    updateUserProfile(socket.data.user.sub, { tokenPiece });
    const chatState = getChatState(chatId, socket.data.user.sub);
    if (!chatState) return;
    const ludo = updatePlayerToken(chatState, socket.data.user.sub, tokenPiece);
    io.to(chatId).emit("room:meta", {
      ...getChatState(chatId, socket.data.user.sub),
      ludo
    });
  });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`MATHAMOTA API listening on 0.0.0.0:${config.port}`);
  console.log(`Static build directory: ${webDistDir}`);
  console.log(`Static build present: ${fs.existsSync(path.join(webDistDir, "index.html"))}`);
});
