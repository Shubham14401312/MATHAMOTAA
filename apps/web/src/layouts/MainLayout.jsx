import Sidebar from "../components/chat/Sidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import InstallFooter from "../components/layout/InstallFooter.jsx";
import { useChatStore } from "../store/chatStore.js";

export default function MainLayout() {
  const mobileChatOpen = useChatStore((state) => state.mobileChatOpen);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden bg-white shadow-2xl shadow-slate-200/60">
        <div className={`${mobileChatOpen ? "hidden" : "flex"} w-full min-h-0 flex-col lg:flex lg:w-[420px]`}>
          <Sidebar />
        </div>
        <ChatWindow />
      </div>
      <InstallFooter />
    </div>
  );
}
