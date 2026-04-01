import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  ImageIcon,
  MapPin,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  SendHorizontal,
  Smile
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendMessage, uploadFile } from "../../services/api.js";
import { useChatStore } from "../../store/chatStore.js";

const emojiItems = [
  "\ud83d\ude00", "\ud83d\ude03", "\ud83d\ude04", "\ud83d\ude01", "\ud83d\ude06", "\ud83d\ude05", "\ud83d\ude0a", "\ud83d\ude0d",
  "\ud83e\udd70", "\ud83d\ude18", "\ud83e\udd79", "\ud83d\ude0e", "\ud83e\udd7a", "\ud83d\ude0f", "\ud83e\udd17", "\ud83e\udd2d",
  "\ud83d\udc95", "\ud83d\udc9e", "\ud83d\udc9d", "\u2764\ufe0f", "\ud83d\udd25", "\u2728", "\ud83c\udf38", "\ud83c\udf80",
  "\ud83c\udf19", "\ud83c\udf1f", "\ud83c\udf08", "\ud83d\udc8c", "\ud83d\udc8b", "\ud83e\udd73", "\ud83e\udd8b", "\ud83d\udc90",
  "\ud83c\udf3a", "\ud83c\udf3b", "\ud83c\udf3c", "\ud83c\udf3f", "\ud83c\udf6b", "\ud83c\udf6d", "\ud83c\udf70", "\ud83c\udf7f",
  "\ud83d\udc4d", "\ud83d\udc4c", "\ud83d\ude4f", "\ud83e\udef6", "\ud83e\udef0", "\ud83d\udc40", "\ud83e\udd0d", "\ud83d\udcac"
];

const stickerItems = [
  { id: "stk-love", label: "Love you", emoji: "\u2764\ufe0f" },
  { id: "stk-hug", label: "Need a hug", emoji: "\ud83e\udd17" },
  { id: "stk-kiss", label: "Kiss", emoji: "\ud83d\udc8b" },
  { id: "stk-miss", label: "Miss you", emoji: "\ud83e\udd79" },
  { id: "stk-cute", label: "So cute", emoji: "\ud83e\udd70" },
  { id: "stk-sleep", label: "Good night", emoji: "\ud83c\udf19" },
  { id: "stk-morning", label: "Good morning", emoji: "\u2600\ufe0f" },
  { id: "stk-wow", label: "Wow", emoji: "\u2728" },
  { id: "stk-sorry", label: "Sorry", emoji: "\ud83e\udd7a" },
  { id: "stk-busy", label: "Busy now", emoji: "\ud83d\udcac" },
  { id: "stk-call", label: "Call me", emoji: "\ud83d\udcde" },
  { id: "stk-date", label: "Date night", emoji: "\ud83c\udf77" }
];

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
  if (message.type === "sticker") {
    return (
      <div className="emoji-font rounded-[24px] bg-white/45 px-4 py-3 text-center">
        <div className="text-4xl">{message.media?.emoji || "\u2728"}</div>
        <div className="mt-2 text-sm font-semibold">{message.text}</div>
      </div>
    );
  }

  if (message.type === "location") {
    return (
      <a
        href={message.media?.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-3 text-sm font-medium"
      >
        <MapPin className="h-4 w-4" />
        {message.text || "Open shared location"}
      </a>
    );
  }

  if (message.type === "audio" && message.media?.url) {
    return <audio src={message.media.url} controls className="max-w-full" preload="metadata" />;
  }

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
    <div className="glass-strong rounded-2xl border border-border-soft p-3 shadow-lg">
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
              key={item.id}
              type="button"
              onClick={() => onSticker(item)}
              className="rounded-2xl border border-border-soft bg-rose-50/80 px-3 py-4 text-left text-sm font-semibold text-text-main hover:bg-rose-100/80"
            >
              <span className="emoji-font mr-2 text-xl">{item.emoji}</span>
              {item.label}
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

function HeaderMenu({ onGallery, onLocation, onProfile }) {
  return (
    <div className="glass-strong absolute right-0 top-12 z-20 w-52 rounded-2xl border border-border-soft p-2 shadow-xl">
      <button type="button" onClick={onGallery} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/60">
        <ImageIcon className="h-4 w-4" />
        Open media gallery
      </button>
      <button type="button" onClick={onLocation} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/60">
        <MapPin className="h-4 w-4" />
        Share location
      </button>
      <button type="button" onClick={onProfile} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/60">
        <Smile className="h-4 w-4" />
        View profile
      </button>
    </div>
  );
}

function MessageComposer({ activeChat }) {
  const fileRef = useRef(null);
  const chunksRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("emoji");
  const [isRecording, setIsRecording] = useState(false);
  const {
    currentUser,
    appendMessage,
    setError,
    setSending,
    simulateReceiptLifecycle,
    socketSend
  } = useChatStore();

  function buildOutgoingMessage(partial) {
    const targetUserId = activeChat.receiverId || activeChat.participants.find((item) => item !== currentUser.id) || activeChat.id;
    return {
      id: crypto.randomUUID(),
      message_ID: crypto.randomUUID(),
      chatId: activeChat.id,
      senderId: currentUser.id,
      receiverId: targetUserId,
      sender_ID: currentUser.id,
      reciever_ID: targetUserId,
      status: "sent",
      timestamp: new Date().toISOString(),
      ...partial
    };
  }

  async function dispatchMessage(message) {
    setSending(true);
    appendMessage(message);
    simulateReceiptLifecycle(message.chatId, message.id);
    try {
      await sendMessage({
        message_ID: message.id,
        sender_ID: message.senderId,
        reciever_ID: message.receiverId,
        type: message.type,
        text: message.text || "",
        media_object: message.media || null,
        document: message.document || null,
        chatId: message.chatId
      });
    } catch {
      setError("Network request failed. The message is kept locally.");
    } finally {
      setSending(false);
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

  async function handleSticker(item) {
    const message = buildOutgoingMessage({
      type: "sticker",
      text: item.label,
      media: {
        emoji: item.emoji,
        fileId: item.id
      },
      document: null
    });
    setPickerOpen(false);
    await dispatchMessage(message);
  }

  async function handleShareLocation() {
    if (!navigator.geolocation) {
      setError("Location sharing is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const mapsUrl = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
        const message = buildOutgoingMessage({
          type: "location",
          text: "Shared live location",
          media: {
            url: mapsUrl,
            latitude: coords.latitude,
            longitude: coords.longitude
          },
          document: null
        });
        await dispatchMessage(message);
      },
      () => setError("Location permission was denied."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const objectUrl = URL.createObjectURL(blob);
        const message = buildOutgoingMessage({
          type: "audio",
          text: "",
          media: {
            url: objectUrl,
            name: file.name
          },
          document: null
        });
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        try {
          const media = await uploadFile(file);
          message.media = {
            ...message.media,
            url: media.url || objectUrl,
            fileId: media.file_id || media.id || crypto.randomUUID()
          };
        } catch {
          setError("Voice note upload failed, so it was kept locally.");
        }
        await dispatchMessage(message);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone access was denied.");
    }
  }

  function handleDraftChange(value) {
    setDraft(value);
    if (activeChat.receiverId) {
      socketSend({
        type: "typing",
        receiverId: activeChat.receiverId
      });
    }
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {}, 1200);
  }

  useEffect(() => {
    const listener = () => {
      handleShareLocation();
    };
    window.addEventListener("mathamota:share-location", listener);
    return () => {
      window.clearTimeout(typingTimeoutRef.current);
      window.removeEventListener("mathamota:share-location", listener);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="border-t border-border-soft bg-panel px-4 py-3">
      {pickerOpen ? (
        <div className="mb-3">
          <PickerTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onEmoji={(value) => setDraft((prev) => `${prev}${value}`)}
            onSticker={handleSticker}
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
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={handleShareLocation}>
            <MapPin className="h-5 w-5" />
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.zip,.gif,audio/*"
            onChange={handleUpload}
          />
        </div>

        <label className="glass-strong flex min-h-12 flex-1 rounded-2xl px-4 py-3 shadow-sm">
          <textarea
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            rows={1}
            placeholder="Type a message"
            className="max-h-36 w-full resize-none bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </label>

        <button
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition ${
            isRecording ? "bg-red-700 shadow-red-200" : "bg-accent shadow-rose-200 hover:bg-accent-dark"
          }`}
          type="button"
          onClick={draft.trim() ? handleSend : toggleRecording}
          aria-label={draft.trim() ? "Send message" : isRecording ? "Stop recording" : "Record voice message"}
        >
          {draft.trim() ? <SendHorizontal className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export default function ChatWindow() {
  const navigate = useNavigate();
  const {
    currentUser,
    chatsList,
    activeChatId,
    messagesByChat,
    socketState,
    socketSend,
    typingByChat,
    error,
    mobileChatOpen,
    openSidebar
  } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeChat = chatsList.find((chat) => chat.id === activeChatId) || null;
  const messages = useMemo(() => {
    const ordered = [...(messagesByChat[activeChatId] || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    if (!searchValue.trim()) return ordered;
    const query = searchValue.trim().toLowerCase();
    return ordered.filter((message) => {
      return (
        (message.text || "").toLowerCase().includes(query) ||
        (message.media?.name || "").toLowerCase().includes(query) ||
        (message.type || "").toLowerCase().includes(query)
      );
    });
  }, [activeChatId, messagesByChat, searchValue]);
  const mediaMessages = useMemo(() => {
    return [...(messagesByChat[activeChatId] || [])].filter((message) => ["image", "video", "gif", "audio"].includes(message.type));
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
          <h2 className="mt-5 text-3xl font-semibold text-white">Select a chat</h2>
          <p className="mt-2 text-sm text-rose-100/80">
            Your sidebar, chat window, and composer stay in separate slots for a cleaner layout.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${mobileChatOpen ? "flex" : "hidden"} glass-surface min-h-0 flex-1 flex-col bg-panel lg:flex`}>
      <header className="relative flex items-center justify-between border-b border-border-soft bg-panel px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="rounded-full p-2 hover:bg-panel-muted lg:hidden" type="button" onClick={openSidebar}>
            <ArrowLeft className="h-5 w-5 text-text-muted" />
          </button>
          <img
            src={activeChat.avatar}
            alt={activeChat.name}
            className="h-10 w-10 rounded-full border border-white/70 bg-slate-100 object-cover"
          />
          <div>
            <p className="text-sm font-semibold">{activeChat.name}</p>
            <p className="text-xs text-text-muted">
              {typingByChat[activeChat.id]
                ? `${typingByChat[activeChat.id]} is typing...`
                : activeChat.online
                  ? "online"
                  : socketState === "connected"
                    ? "connected"
                    : "offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={() => setSearchOpen((prev) => !prev)}>
            <Search className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={() => setGalleryOpen((prev) => !prev)}>
            <ImageIcon className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 hover:bg-panel-muted" type="button" onClick={() => setMenuOpen((prev) => !prev)}>
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
        {menuOpen ? (
          <HeaderMenu
            onGallery={() => {
              setGalleryOpen(true);
              setMenuOpen(false);
            }}
            onLocation={() => {
              window.dispatchEvent(new CustomEvent("mathamota:share-location"));
              setMenuOpen(false);
            }}
            onProfile={() => {
              navigate("/profile");
              setMenuOpen(false);
            }}
          />
        ) : null}
      </header>

      {searchOpen ? (
        <div className="border-b border-border-soft px-4 py-3">
          <label className="glass-strong flex items-center gap-2 rounded-2xl px-3 py-2">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search in this chat"
              className="w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
            />
          </label>
        </div>
      ) : null}

      {galleryOpen ? (
        <div className="border-b border-border-soft px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Shared media</p>
            <button type="button" className="text-sm text-text-muted" onClick={() => setGalleryOpen(false)}>
              Close
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-5">
            {mediaMessages.length ? mediaMessages.map((message) => (
              <a
                key={message.id}
                href={message.media?.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-2xl bg-white/55"
              >
                {message.type === "audio" ? (
                  <div className="flex h-24 items-center justify-center text-xs font-medium text-text-muted">Voice note</div>
                ) : (
                  <img src={message.media?.url} alt={message.type} className="h-24 w-full object-cover" />
                )}
              </a>
            )) : <p className="col-span-full text-sm text-text-muted">No shared media yet.</p>}
          </div>
        </div>
      ) : null}

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
