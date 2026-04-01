import { useEffect } from "react";
import MainLayout from "./layouts/MainLayout.jsx";
import { useChatBootstrap } from "./hooks/useChatBootstrap.js";
import { useChatStore } from "./store/chatStore.js";

export default function App() {
  const setInstallPromptEvent = useChatStore((state) => state.setInstallPromptEvent);
  useChatBootstrap();

  useEffect(() => {
    function handleInstallPrompt(event) {
      event.preventDefault();
      setInstallPromptEvent(event);
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, [setInstallPromptEvent]);

  return <MainLayout />;
}
