import { CirclePlus, MessageCircleMore, Settings, Search } from "lucide-react";
import { useMemo } from "react";
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
        active ? "bg-emerald-50" : "bg-white hover:bg-slate-50"
      }`}
    >
      <img src={chat.avatar} alt={chat.name} className="h-12 w-12 rounded-full border border-slate-200 bg-slate-100" />
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
  const { currentUser, chatsList, activeChatId, searchTerm, setSearchTerm, selectChat } = useChatStore();

  const filteredChats = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return chatsList;
    return chatsList.filter((chat) => {
      return (
        chat.name.toLowerCase().includes(value) ||
        (chat.lastMessage || "").toLowerCase().includes(value)
      );
    });
  }, [chatsList, searchTerm]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border-soft bg-sidebar">
      <header className="flex items-center justify-between border-b border-border-soft bg-sidebar px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={currentUser.avatar} alt={currentUser.name} className="h-10 w-10 rounded-full border border-slate-200 bg-white" />
          <div>
            <p className="text-sm font-semibold text-text-main">{currentUser.name}</p>
            <p className="text-xs text-text-muted">Messages</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button className="rounded-full p-2 hover:bg-white" type="button" aria-label="New chat">
            <CirclePlus className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-white" type="button" aria-label="Status">
            <MessageCircleMore className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-white" type="button" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="border-b border-border-soft bg-sidebar px-3 py-2">
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
          <Search className="h-4 w-4 text-text-muted" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search or start new chat"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </label>
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
