import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";
import { useChatBootstrap } from "./hooks/useChatBootstrap.js";
import { useChatStore } from "./store/chatStore.js";
import AuthPage from "./pages/AuthPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

function ProtectedRoute({ children }) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
}

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
