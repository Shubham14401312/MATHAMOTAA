import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  ImageIcon,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  SendHorizontal,
  Smile
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { sendMessage, uploadFile } from "../../services/api.js";
import { useChatStore } from "../../store/chatStore.js";

const emojiItems = ["😀", "😂", "😍", "🥹", "😘", "🥰", "🤍", "🔥", "✨", "😭", "🙏", "🤌", "🤝", "🤗", "💚", "🎉"];
const stickerItems = ["Love You", "Miss You", "Good Night", "Cute", "Forever", "Hug", "Kiss", "Always", "Baby", "Mine"];
const gifItems = [
  {
    id: "gif-1",
    url: "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif",
    preview: "https://media.giphy.com/media/3oriO0OEd9QIDdllqo/200.gif"
  },
  {
    id: "gif-2",
    url: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif",
    preview: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/200.gif"
  },
  {
    id: "gif-3",
    url: "https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/giphy.gif",
    preview: "https://media.giphy.com/media/l4FGpP4lxGGgK5CBW/200.gif"
  }
];

function formatMessageTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function MessageTicks({ status }) {
  if (status === "sent") return <Check className="h-3.5 w-3.5 text-slate-500" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-slate-500" />;
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  return null;
}

function MediaBlock({ message }) {
  if (message.type === "image" && message.media?.url) {
    return <img src={message.media.url} alt={message.media.name || "image"} className="max-h-72 rounded-xl object-cover" />;
  }
  if ((message.type === "video" || message.type === "gif") && message.media?.url) {
    return (
      <div className="overflow-hidden rounded-xl">
        {message.type === "gif" ? (
          <img src={message.media.url} alt="gif" className="max-h-72 w-full object-cover" />
        ) : (
          <video src={message.media.url} controls className="max-h-72 w-full" />
        )}
      </div>
    );
  }
  if (message.media?.url) {
    return (
      <a
        href={message.media.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-medium underline"
      >
        <Download className="h-4 w-4" />
        {message.media.name || "Open attachment"}
      </a>
    );
  }
  return null;
}

function PickerTabs({ activeTab, setActiveTab, onEmoji, onSticker, onGif }) {
  return (
    <div className="rounded-2xl border border-border-soft bg-white p-3 shadow-lg">
      <div className="mb-3 flex gap-2">
        {["emoji", "stickers", "gifs"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              activeTab === tab ? "bg-accent text-white" : "bg-panel-muted text-text-main"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "emoji" ? (
        <div className="emoji-font grid max-h-44 grid-cols-8 gap-2 overflow-y-auto text-2xl">
          {emojiItems.map((item) => (
            <button key={item} type="button" onClick={() => onEmoji(item)} className="rounded-xl p-2 hover:bg-panel-muted">
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "stickers" ? (
        <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {stickerItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSticker(item)}
              className="rounded-2xl border border-border-soft bg-emerald-50 px-3 py-4 text-sm font-semibold text-text-main hover:bg-emerald-100"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === "gifs" ? (
        <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto">
          {gifItems.map((item) => (
            <button key={item.id} type="button" onClick={() => onGif(item)} className="overflow-hidden rounded-xl">
              <img src={item.preview} alt="gif preview" className="h-24 w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageComposer({ activeChat }) {
  const fileRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("emoji");
  const {
    currentUser,
    appendMessage,
    setError
  } = useChatStore();

  function buildOutgoingMessage(partial) {
    return {
      id: crypto.randomUUID(),
      chatId: activeChat.id,
      senderId: currentUser.id,
      receiverId: activeChat.participants.find((item) => item !== currentUser.id) || activeChat.id,
      status: "sent",
      timestamp: new Date().toISOString(),
      ...partial
    };
  }

  async function dispatchMessage(message) {
    appendMessage(message);
    try {
      await sendMessage({
        message_ID: message.id,
        sender_ID: message.senderId,
        reciever_ID: message.receiverId,
        type: message.type,
        text: message.text || "",
        media_object: message.media || null,
        document: message.document || null
      });
    } catch {
      setError("Network request failed. The message is kept locally.");
    }
  }

  async function handleSend() {
    if (!draft.trim()) return;
    const message = buildOutgoingMessage({
      type: "text",
      text: draft.trim(),
      media: null,
      document: null
    });
    setDraft("");
    await dispatchMessage(message);
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const media = await uploadFile(file);
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : "document";
      const message = buildOutgoingMessage({
        type,
        text: "",
        media: {
          url: media.url || URL.createObjectURL(file),
          fileId: media.file_id || media.id || crypto.randomUUID(),
          name: file.name
        },
        document: type === "document" ? file.name : null
      });
      await dispatchMessage(message);
    } catch {
      setError("Media upload failed. Please try again.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleGif(item) {
    const message = buildOutgoingMessage({
      type: "gif",
      text: "",
      media: {
        url: item.url,
        fileId: item.id,
        name: "GIF"
      },
      document: null
    });
    setPickerOpen(false);
    await dispatchMessage(message);
  }

  return (
    <div className="border-t border-border-soft bg-panel px-4 py-3">
      {pickerOpen ? (
        <div className="mb-3">
          <PickerTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onEmoji={(value) => setDraft((prev) => `${prev}${value}`)}
            onSticker={(value) => setDraft((prev) => `${prev}${prev ? " " : ""}[Sticker: ${value}]`)}
            onGif={handleGif}
          />
        </div>
      ) : null}

      <div className="flex items-end gap-3">
        <div className="flex items-center gap-1 pb-1 text-text-muted">
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={() => setPickerOpen((prev) => !prev)}>
            <Smile className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.zip,.gif"
            onChange={handleUpload}
          />
        </div>

        <label className="flex min-h-12 flex-1 rounded-2xl border border-border-soft bg-white px-4 py-3 shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={1}
            placeholder="Type a message"
            className="max-h-36 w-full resize-none bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </label>

        <button
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-emerald-200 transition hover:bg-accent-dark"
          type="button"
          onClick={draft.trim() ? handleSend : undefined}
          aria-label={draft.trim() ? "Send message" : "Record voice message"}
        >
          {draft.trim() ? <SendHorizontal className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const {
    currentUser,
    chatsList,
    activeChatId,
    messagesByChat,
    socketState,
    error,
    mobileChatOpen,
    openSidebar
  } = useChatStore();

  const activeChat = chatsList.find((chat) => chat.id === activeChatId) || null;
  const messages = useMemo(() => {
    return [...(messagesByChat[activeChatId] || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [activeChatId, messagesByChat]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatId]);

  if (!activeChat) {
    return (
      <section className="hidden flex-1 items-center justify-center bg-chat-bg lg:flex">
        <div className="max-w-md text-center">
          <img src="/logo.svg" alt="logo" className="mx-auto h-16 w-16" />
          <h2 className="mt-5 text-3xl font-semibold">Select a chat</h2>
          <p className="mt-2 text-sm text-text-muted">Your sidebar, chat window, and composer stay in separate slots for a cleaner layout.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${mobileChatOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col bg-panel lg:flex`}>
      <header className="flex items-center justify-between border-b border-border-soft bg-panel px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 hover:bg-panel-muted lg:hidden" type="button" onClick={openSidebar}>
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </button>
          <img src={activeChat.avatar} alt={activeChat.name} className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100" />
          <div>
            <p className="text-sm font-semibold">{activeChat.name}</p>
            <p className="text-xs text-text-muted">
              {activeChat.online ? "online" : socketState === "connected" ? "connected" : "offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button">
            <Search className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button">
            <ImageIcon className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="whatsapp-pattern min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          {messages.map((message) => {
            const mine = message.senderId === currentUser.id;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[84%] rounded-2xl px-3 py-2 shadow-sm md:max-w-[70%] ${
                    mine ? "rounded-br-md bg-message-sent" : "rounded-bl-md bg-message-received"
                  }`}
                >
                  {message.type === "text" ? (
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                  ) : (
                    <MediaBlock message={message} />
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-text-muted">
                    <span>{formatMessageTime(message.timestamp)}</span>
                    {mine ? <MessageTicks status={message.status} /> : null}
                  </div>
                </div>
              </div>
            );
          })}
          {error ? (
            <div className="mx-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <MessageComposer activeChat={activeChat} />
    </section>
  );
}
