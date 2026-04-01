import {
  CirclePlus,
  LogOut,
  MessageCircleMore,
  MessageSquareText,
  Search,
  Settings,
  UserRound
} from "lucide-react";
import { useMemo, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useChatStore } from "../../store/chatStore.js";

function formatChatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function ChatRow({ chat, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(chat.id)}
      className={`flex w-full items-center gap-3 border-b border-border-soft px-4 py-3 text-left transition ${
        active ? "bg-rose-50/80" : "bg-white/20 hover:bg-white/40"
      }`}
    >
      <img
        src={chat.avatar}
        alt={chat.name}
        className="h-12 w-12 rounded-full border border-white/70 bg-white/60 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-text-main">{chat.name}</p>
          <span className="shrink-0 text-xs text-text-muted">{formatChatTime(chat.lastMessageAt)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-sm text-text-muted">{chat.lastMessage}</p>
          {chat.unreadCount ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-unread px-1.5 text-[11px] font-semibold text-white">
              {chat.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const {
    currentUser,
    chatsList,
    activeChatId,
    searchTerm,
    onlineOnly,
    setSearchTerm,
    setOnlineOnly,
    selectChat,
    createChat,
    clearSession,
    setError
  } = useChatStore();

  const filteredChats = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    const base = onlineOnly ? chatsList.filter((chat) => chat.online) : chatsList;
    if (!value) return base;
    return base.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(value) ||
        (chat.lastMessage || "").toLowerCase().includes(value)
      );
    });
  }, [chatsList, onlineOnly, searchTerm]);

  return (
    <aside className="glass-surface flex h-full min-h-0 flex-col border-r border-border-soft bg-sidebar">
      <header className="flex items-center justify-between border-b border-border-soft bg-sidebar/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="h-10 w-10 rounded-full border border-white/70 bg-white object-cover"
          />
          <div>
            <p className="text-sm font-semibold text-text-main">{currentUser.name}</p>
            <p className="text-xs text-text-muted">Private messages</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button
            className="rounded-full p-2 hover:bg-white"
            type="button"
            aria-label="New chat"
            onClick={async () => {
              const name = window.prompt("Enter the name for the new chat");
              if (!name?.trim()) return;
              const created = await createChat(name);
              if (!created) {
                setError("That username was not found. Ask them to sign up first.");
                return;
              }
              navigate("/chat");
            }}
          >
            <CirclePlus className="h-5 w-5" />
          </button>
          <button
            className={`rounded-full p-2 ${onlineOnly ? "bg-rose-100 text-accent" : "hover:bg-white"}`}
            type="button"
            aria-label="Status"
            onClick={() => setOnlineOnly(!onlineOnly)}
            title={onlineOnly ? "Show all chats" : "Show online chats"}
          >
            <MessageCircleMore className="h-5 w-5" />
          </button>
          <button
            className="rounded-full p-2 hover:bg-white"
            type="button"
            aria-label="Settings"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            className="rounded-full p-2 hover:bg-white"
            type="button"
            aria-label="Logout"
            onClick={() => {
              clearSession();
              navigate("/auth");
            }}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="border-b border-border-soft bg-sidebar px-3 py-2">
        <label className="glass-strong flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search or start new chat"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                isActive ? "bg-rose-100 text-rose-900" : "glass-strong text-text-main"
              }`
            }
          >
            <MessageSquareText className="h-4 w-4" />
            Chats
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                isActive ? "bg-rose-100 text-rose-900" : "glass-strong text-text-main"
              }`
            }
          >
            <UserRound className="h-4 w-4" />
            Profile
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                isActive ? "bg-rose-100 text-rose-900" : "glass-strong text-text-main"
              }`
            }
          >
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            active={chat.id === activeChatId}
            onSelect={selectChat}
          />
        ))}
      </div>
    </aside>
  );
}
