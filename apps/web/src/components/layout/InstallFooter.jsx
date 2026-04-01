import { Download, Smartphone } from "lucide-react";
import { useChatStore } from "../../store/chatStore.js";

const apkUrl = import.meta.env.VITE_APK_URL || "";

export default function InstallFooter() {
  const installPromptEvent = useChatStore((state) => state.installPromptEvent);

  async function handleInstall() {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
  }

  return (
    <footer className="border-t border-border-soft bg-white px-4 py-3">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 text-center text-sm text-text-muted md:flex-row">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="logo" className="h-9 w-9" />
          <div className="text-left">
            <p className="font-semibold text-text-main">MATHAMOTA Chat</p>
            <p>Install the web app or download the Android build when attached.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            disabled={!installPromptEvent}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Smartphone className="h-4 w-4" />
            Install app
          </button>
          <a
            href={apkUrl || "#"}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              apkUrl ? "bg-slate-900 text-white" : "pointer-events-none bg-slate-200 text-slate-500"
            }`}
          >
            <Download className="h-4 w-4" />
            {apkUrl ? "Download APK" : "APK not attached"}
          </a>
        </div>
      </div>
    </footer>
  );
}
