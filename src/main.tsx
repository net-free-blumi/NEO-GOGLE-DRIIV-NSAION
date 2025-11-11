import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

// Initialize Capacitor plugins for Android
if (Capacitor.isNativePlatform()) {
  // Set status bar style
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {
    // Ignore if not available
  });

  // Hide splash screen after app is ready
  SplashScreen.hide().catch(() => {
    // Ignore if not available
  });
}

createRoot(document.getElementById("root")!).render(<App />);
