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
import { verifyPassword } from "./security.js";
import {
  createChat,
  createUser,
  getAdminOverview,
  getChat,
  getMessages,
  getUserById,
  insertMessage,
  joinChatByInvite,
  updateChatPrefs,
  writeAdminAudit
} from "./db.js";
import { getOrCreateGame, playMiniLudo, playTicTacToe } from "./gameState.js";

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
      name: user.name,
      inviteCode: user.inviteCode ?? user.invite_code,
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

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "MATHAMOTA", uptime: process.uptime() });
});

app.post("/auth/start", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const title = String(req.body?.title || "Private space").trim();
  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const user = createUser(name);
  const chat = createChat({ ownerId: user.id, title });
  writeAdminAudit("chat_created", `${name} created ${chat.id}`);
  return res.json({
    token: issueToken(user),
    user,
    chat,
    inviteCode: user.inviteCode
  });
});

app.post("/auth/join", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();
  if (!name || !inviteCode) {
    return res.status(400).json({ error: "Name and invite code are required" });
  }
  const user = createUser(name);
  const chat = joinChatByInvite({ inviteCode, partnerId: user.id });
  if (!chat) {
    return res.status(404).json({ error: "Invite code not found" });
  }
  writeAdminAudit("chat_joined", `${name} joined ${chat.id}`);
  return res.json({
    token: issueToken(user),
    user,
    chat
  });
});

app.post("/auth/admin", (req, res) => {
  const email = String(req.body?.email || "");
  const password = String(req.body?.password || "");
  const plainMatch = config.adminPassword && password === config.adminPassword;
  const hashMatch = config.adminPasswordHash && verifyPassword(password, config.adminPasswordHash);
  if (email !== config.adminEmail || (!plainMatch && !hashMatch)) {
    return res.status(401).json({ error: "Invalid admin credentials" });
  }
  writeAdminAudit("admin_login", email);
  return res.json({ token: issueAdminToken() });
});

app.get("/chat/:chatId/messages", auth, (req, res) => {
  const chat = getChat(req.params.chatId);
  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }
  return res.json({
    chat,
    messages: getMessages(chat.id)
  });
});

app.post("/chat/:chatId/preferences", auth, (req, res) => {
  const updated = updateChatPrefs(req.params.chatId, req.body || {});
  return res.json(updated);
});

app.post("/chat/:chatId/upload", auth, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
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
  io.to(req.params.chatId).emit("message:new", message);
  return res.json(message);
});

app.get("/admin/overview", auth, adminOnly, (_req, res) => {
  return res.json(getAdminOverview());
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/chat") || req.path.startsWith("/admin") || req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) {
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
    socket.join(chatId);
    socket.emit("room:snapshot", { chatId, messages: getMessages(chatId) });
    socket.emit("game:tic", getOrCreateGame(chatId).ticTacToe);
    socket.emit("game:ludo", getOrCreateGame(chatId).miniLudo);
  });

  socket.on("typing", ({ chatId, name }) => {
    socket.to(chatId).emit("typing", { name });
  });

  socket.on("message:send", ({ chatId, body, kind = "text" }) => {
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

  socket.on("game:tic", ({ chatId, index }) => {
    io.to(chatId).emit("game:tic", playTicTacToe(chatId, index));
  });

  socket.on("game:ludo", ({ chatId }) => {
    io.to(chatId).emit("game:ludo", playMiniLudo(chatId));
  });
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`MATHAMOTA API listening on 0.0.0.0:${config.port}`);
  console.log(`Static build directory: ${webDistDir}`);
  console.log(`Static build present: ${fs.existsSync(path.join(webDistDir, "index.html"))}`);
});
