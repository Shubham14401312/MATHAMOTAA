import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = import.meta.env.VITE_API_URL || window.location.origin;
const wallpapers = ["blush", "rose", "peach", "lavender"];
const stickers = ["love", "xoxo", "kiss", "miss you", "hug", "cute", "moon", "always"];
const avatars = ["Bloom", "Rose", "Moon", "Butterfly"];
const tokenChoices = ["\u2728", "\u2665", "\u2605", "\u25C6", "\u25CF", "\u2666"];

function api(path, options = {}) {
  return fetch(`${API}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    ...options
  }).then((response) => response.json());
}

function renderAttachment(item) {
  const name = item.attachmentName?.toLowerCase() || "";
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) {
    return <img src={item.attachmentUrl} alt={item.attachmentName} className="media-preview" />;
  }
  if (/\.(mp4|webm|mov)$/i.test(name)) {
    return <video src={item.attachmentUrl} className="media-preview" controls />;
  }
  if (/\.(mp3|wav|m4a|ogg)$/i.test(name)) {
    return <audio src={item.attachmentUrl} controls />;
  }
  return (
    <a href={item.attachmentUrl} target="_blank" rel="noreferrer">
      {item.attachmentName || "Open file"}
    </a>
  );
}

function Message({ item, currentUser }) {
  const mine = item.senderId === currentUser?.id;
  return (
    <div className={`bubble ${mine ? "mine" : ""}`}>
      <span>{item.body}</span>
      {item.attachmentUrl ? renderAttachment(item) : null}
    </div>
  );
}

function AuthScreen({
  authMode,
  setAuthMode,
  credentials,
  setCredentials,
  signupFields,
  setSignupFields,
  onSignup,
  onLogin,
  installPrompt,
  notice,
  error
}) {
  return (
    <main className="shell landing blush">
      <section className="hero">
        <div className="hero-copy">
          <img src="/logo.svg" alt="MATHAMOTA logo" className="logo-mark" />
          <p className="eyebrow">MATHAMOTA</p>
          <h1>Private chat, sweet visuals, and Ludo for two.</h1>
          <p className="sub">
            Sign in once, come back anytime, and keep one private room for you and your partner with a mobile-friendly layout.
          </p>
          {installPrompt ? (
            <button
              onClick={async () => {
                await installPrompt.prompt();
              }}
            >
              Download / install app
            </button>
          ) : null}
          {notice ? <p className="notice-text">{notice}</p> : null}
        </div>

        <div className="card stack login-card">
          <div className="mode-switch">
            <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
              Sign up
            </button>
            <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Log in
            </button>
          </div>

          {authMode === "signup" ? (
            <>
              <input
                value={signupFields.name}
                onChange={(event) => setSignupFields((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Your name"
              />
              <input
                value={signupFields.email}
                onChange={(event) => setSignupFields((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email address"
              />
              <input
                value={signupFields.password}
                onChange={(event) => setSignupFields((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Password"
                type="password"
              />
              <div className="row">
                <select
                  value={signupFields.avatar}
                  onChange={(event) => setSignupFields((prev) => ({ ...prev, avatar: event.target.value }))}
                >
                  {avatars.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={signupFields.tokenPiece}
                  onChange={(event) => setSignupFields((prev) => ({ ...prev, tokenPiece: event.target.value }))}
                >
                  {tokenChoices.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={onSignup}>Create account</button>
            </>
          ) : (
            <>
              <input
                value={credentials.email}
                onChange={(event) => setCredentials((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email address"
              />
              <input
                value={credentials.password}
                onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Password"
                type="password"
              />
              <button onClick={onLogin}>Log in</button>
            </>
          )}

          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

function LobbyScreen({
  session,
  roomForm,
  setRoomForm,
  onCreateRoom,
  onJoinRoom,
  onLogout,
  installPrompt,
  notice,
  error
}) {
  return (
    <main className="shell landing blush">
      <section className="hero">
        <div className="hero-copy">
          <img src="/logo.svg" alt="MATHAMOTA logo" className="logo-mark" />
          <p className="eyebrow">Welcome back</p>
          <h1>Hello, {session.user.name}.</h1>
          <p className="sub">
            Create your private room or join your partner using an invite code. If you sign in again on this device, the app will bring you back here automatically.
          </p>
          {installPrompt ? (
            <button
              onClick={async () => {
                await installPrompt.prompt();
              }}
            >
              Download / install app
            </button>
          ) : null}
          {notice ? <p className="notice-text">{notice}</p> : null}
        </div>

        <div className="card stack login-card">
          <input
            value={roomForm.title}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Private room title"
          />
          <button onClick={onCreateRoom}>Create my room</button>
          <div className="divider" />
          <input
            value={roomForm.inviteCode}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, inviteCode: event.target.value.toUpperCase() }))}
            placeholder="Enter invite code"
          />
          <button className="ghost" onClick={onJoinRoom}>
            Join room
          </button>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

function LudoPanel({ ludo, myColor, roomReady, onRoll, onReset, onTokenChange, open }) {
  const diceFace = useMemo(() => ["1", "2", "3", "4", "5", "6"][Math.max(0, (ludo?.lastDice || 1) - 1)], [ludo]);
  const boardCells = Array.from({ length: ludo?.boardSize || 30 }, (_, index) => index);
  if (!open) return null;

  return (
    <aside className="games">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Ludo Lounge</p>
          <h3>Live two-player room</h3>
        </div>
        <div className="dice-card">
          <span className="dice-face">{diceFace}</span>
          <small>Last roll</small>
        </div>
      </div>

      <div className="ludo-status">
        <p>{ludo?.status || "Waiting for room state..."}</p>
        <p>
          Turn: <strong>{ludo?.turn || "-"}</strong>
          {myColor ? ` | You are ${myColor}` : ""}
        </p>
      </div>

      <div className="token-picker">
        {tokenChoices.map((item) => (
          <button
            key={item}
            className={item === ludo?.pieces?.[myColor || "red"]?.token ? "active" : ""}
            onClick={() => onTokenChange(item)}
            disabled={!myColor}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="ludo-board">
        {boardCells.map((cell) => {
          const redHere = ludo?.pieces?.red?.position === cell;
          const blueHere = ludo?.pieces?.blue?.position === cell;
          return (
            <div key={cell} className={`ludo-cell ${cell === 0 ? "start" : ""} ${cell === 29 ? "finish" : ""}`}>
              <span className="cell-number">{cell + 1}</span>
              <div className="cell-pieces">
                {redHere ? <span className="red-piece">{ludo.pieces.red.token}</span> : null}
                {blueHere ? <span className="blue-piece">{ludo.pieces.blue.token}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="home-row">
        <div className="home-card">
          <strong>Red home</strong>
          <span>{ludo?.pieces?.red?.position === -1 ? ludo?.pieces?.red?.token : "On board"}</span>
        </div>
        <div className="home-card">
          <strong>Blue home</strong>
          <span>{ludo?.pieces?.blue?.position === -1 ? ludo?.pieces?.blue?.token : "On board"}</span>
        </div>
      </div>

      <div className="row">
        <button className="roll-button" onClick={onRoll} disabled={!roomReady || !myColor || ludo?.winner}>
          Roll dice
        </button>
        {ludo?.winner ? (
          <button className="ghost" onClick={onReset}>
            Play again
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem("mathamota-session");
    return stored ? JSON.parse(stored) : null;
  });
  const [authMode, setAuthMode] = useState("signup");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signupFields, setSignupFields] = useState({
    name: "",
    email: "",
    password: "",
    avatar: "Bloom",
    tokenPiece: "\u2728"
  });
  const [roomForm, setRoomForm] = useState({ title: "Our private room", inviteCode: "" });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [wallpaper, setWallpaper] = useState("blush");
  const [galleryVisible, setGalleryVisible] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [ludo, setLudo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    localStorage.setItem("mathamota-session", JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session?.token || !session?.chat?.id) return;
    setWallpaper(session.chat.wallpaper || "blush");
    setGalleryVisible(Boolean(session.chat.gallery_visible ?? true));

    const socket = io(API, { auth: { token: session.token } });
    socketRef.current = socket;
    socket.emit("room:join", { chatId: session.chat.id });

    socket.on("room:snapshot", (payload) => {
      setMessages(payload.messages || []);
      setLudo(payload.ludo || null);
      setSession((prev) => ({ ...prev, ...payload }));
    });
    socket.on("room:meta", (payload) => {
      setLudo(payload.ludo || null);
      setSession((prev) => ({ ...prev, ...payload }));
    });
    socket.on("message:new", (incoming) => setMessages((prev) => [...prev, incoming]));
    socket.on("typing", ({ name: senderName }) => setTyping(`${senderName} is typing...`));
    socket.on("game:ludo", (payload) => setLudo(payload));

    return () => socket.disconnect();
  }, [session?.token, session?.chat?.id]);

  async function loadCurrentUser(token) {
    return api("/auth/me", { token });
  }

  async function hydrateChat(token, chatId, baseUser) {
    const chatState = await api(`/chat/${chatId}/state`, { token });
    if (chatState.error) {
      setError(chatState.error);
      return;
    }
    setMessages(chatState.messages || []);
    setLudo(chatState.ludo || null);
    setSession({
      token,
      user: baseUser,
      ...chatState
    });
  }

  async function handleSignup() {
    setError("");
    setNotice("");
    const payload = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify(signupFields)
    });
    if (payload.error) {
      setError(payload.error);
      return;
    }
    setSession({ token: payload.token, user: payload.user });
    setNotice("Account created. Now create your private room or join with an invite code.");
  }

  async function handleLogin() {
    setError("");
    const payload = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    if (payload.error) {
      setError(payload.error);
      return;
    }
    if (payload.activeChat) {
      setNotice(payload.notice);
      await hydrateChat(payload.token, payload.activeChat.chat.id, payload.user);
      return;
    }
    setSession({ token: payload.token, user: payload.user });
    setNotice(payload.notice || "Logged in successfully.");
  }

  async function createRoom() {
    setError("");
    const payload = await api("/rooms/create", {
      method: "POST",
      token: session.token,
      body: JSON.stringify({ title: roomForm.title })
    });
    if (payload.error) {
      setError(payload.error);
      return;
    }
    await hydrateChat(session.token, payload.chat.id, session.user);
  }

  async function joinRoom() {
    setError("");
    const payload = await api("/rooms/join", {
      method: "POST",
      token: session.token,
      body: JSON.stringify({ inviteCode: roomForm.inviteCode })
    });
    if (payload.error) {
      setError(payload.error);
      return;
    }
    await hydrateChat(session.token, payload.chat.id, session.user);
  }

  async function refreshCurrentUser() {
    const payload = await loadCurrentUser(session.token);
    if (payload.user) {
      if (payload.activeChat) {
        await hydrateChat(session.token, payload.activeChat.chat.id, payload.user);
      } else {
        setSession((prev) => ({ ...prev, user: payload.user, chat: null }));
      }
    }
  }

  function logout() {
    localStorage.removeItem("mathamota-session");
    setSession(null);
    setMessages([]);
    setLudo(null);
    setNotice("");
    setError("");
    setAdminData(null);
    setGameOpen(false);
  }

  async function updateProfile(nextToken) {
    const payload = await api("/profile", {
      method: "POST",
      token: session.token,
      body: JSON.stringify({
        name: signupFields.name || session.user.name,
        avatar: signupFields.avatar || session.user.avatar,
        tokenPiece: nextToken
      })
    });
    if (payload.error) {
      setError(payload.error);
      return;
    }
    setSession((prev) => ({ ...prev, token: payload.token, user: payload.user }));
    await refreshCurrentUser();
  }

  async function savePrefs(nextWallpaper, nextGalleryVisible) {
    const updatedChat = await api(`/chat/${session.chat.id}/preferences`, {
      method: "POST",
      token: session.token,
      body: JSON.stringify({
        wallpaper: nextWallpaper,
        galleryVisible: nextGalleryVisible
      })
    });
    setWallpaper(nextWallpaper);
    setGalleryVisible(nextGalleryVisible);
    setSession((prev) => ({ ...prev, chat: updatedChat }));
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const uploaded = await api(`/chat/${session.chat.id}/upload`, {
      method: "POST",
      token: session.token,
      body: form
    });
    if (!uploaded.error) {
      setMessages((prev) => [...prev, uploaded]);
    }
  }

  function sendMessage() {
    if (!draft.trim()) return;
    socketRef.current?.emit("message:send", {
      chatId: session.chat.id,
      body: draft
    });
    setDraft("");
  }

  async function adminLogin() {
    const auth = await api("/auth/admin", {
      method: "POST",
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    if (auth.token) {
      const overview = await api("/admin/overview", { token: auth.token });
      setAdminData(overview);
    }
  }

  if (!session?.token) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        credentials={credentials}
        setCredentials={setCredentials}
        signupFields={signupFields}
        setSignupFields={setSignupFields}
        onSignup={handleSignup}
        onLogin={handleLogin}
        installPrompt={installPrompt}
        notice={notice}
        error={error}
      />
    );
  }

  if (!session?.chat?.id) {
    return (
      <LobbyScreen
        session={session}
        roomForm={roomForm}
        setRoomForm={setRoomForm}
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        onLogout={logout}
        installPrompt={installPrompt}
        notice={notice}
        error={error}
      />
    );
  }

  const myColor = session.role === "owner" ? "red" : session.role === "partner" ? "blue" : null;
  const roomReady = Boolean(session.participants?.owner && session.participants?.partner);

  return (
    <main className={`shell app ${wallpaper}`}>
      <section className="sidebar">
        <div className="brand card stack compact">
          <div className="panel-header">
            <div>
              <img src="/logo.svg" alt="MATHAMOTA logo" className="mini-logo" />
              <p className="eyebrow">Invite code</p>
              <strong>{session.inviteCode}</strong>
            </div>
            <button className="ghost menu-toggle" onClick={() => setMenuOpen((prev) => !prev)}>
              ...
            </button>
          </div>

          {menuOpen ? (
            <div className="menu-panel">
              <button className="ghost" onClick={() => setGameOpen((prev) => !prev)}>
                {gameOpen ? "Hide Ludo" : "Open Ludo"}
              </button>
              <button className="ghost" onClick={logout}>
                Log out
              </button>
            </div>
          ) : null}
        </div>

        <div className="card stack">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Profile</p>
              <h3>{session.user.name}</h3>
            </div>
            <span className="avatar-pill">{session.user.avatar}</span>
          </div>
          <p className="tip">{session.user.email}</p>
        </div>

        <div className="card stack">
          <h3>Room look</h3>
          <div className="chips">
            {wallpapers.map((item) => (
              <button
                key={item}
                className={item === wallpaper ? "active" : ""}
                onClick={() => savePrefs(item, galleryVisible)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={galleryVisible}
              onChange={(event) => savePrefs(wallpaper, event.target.checked)}
            />
            <span>Show shared media in gallery</span>
          </label>
        </div>

        <LudoPanel
          ludo={ludo}
          myColor={myColor}
          roomReady={roomReady}
          open={gameOpen}
          onRoll={() => socketRef.current?.emit("game:ludo:roll", { chatId: session.chat.id })}
          onReset={() => socketRef.current?.emit("game:ludo:reset", { chatId: session.chat.id })}
          onTokenChange={(token) => {
            socketRef.current?.emit("game:ludo:token", { chatId: session.chat.id, tokenPiece: token });
            updateProfile(token);
          }}
        />

        <div className="card stack">
          <h3>Admin panel</h3>
          <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Admin email" />
          <input
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            type="password"
            placeholder="Admin password"
          />
          <button onClick={adminLogin}>Open admin panel</button>
          {adminData ? (
            <div className="admin-box">
              <p>Users: {adminData.users}</p>
              <p>Chats: {adminData.chats}</p>
              <p>Messages: {adminData.messages}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="chat-panel">
        <header className="chat-top">
          <div>
            <p className="eyebrow">Private room</p>
            <h2>{session.chat.title}</h2>
            <p className="presence-text">
              {session.participants?.owner?.name || "Owner"} and {session.participants?.partner?.name || "waiting..."}
            </p>
          </div>
          <label className="file-button">
            <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip" onChange={onFile} />
            Share media or file
          </label>
        </header>

        <div className="messages">
          {messages.map((item) => (
            <Message key={item.id} item={item} currentUser={session.user} />
          ))}
          {typing ? <p className="typing">{typing}</p> : null}
        </div>

        <div className="composer">
          <div className="stickers">
            {stickers.map((item) => (
              <button key={item} onClick={() => setDraft((prev) => `${prev}${prev ? " " : ""}${item}`)}>
                {item}
              </button>
            ))}
          </div>
          <div className="row">
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                socketRef.current?.emit("typing", {
                  chatId: session.chat.id,
                  name: session.user.name
                });
              }}
              placeholder="Write a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>
          {notice ? <p className="notice-text">{notice}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
