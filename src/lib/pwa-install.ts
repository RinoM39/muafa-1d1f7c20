export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener(deferredPrompt));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function subscribeToInstallPrompt(
  listener: (prompt: BeforeInstallPromptEvent | null) => void,
) {
  listeners.add(listener);
  listener(deferredPrompt);
  return () => {
    listeners.delete(listener);
  };
}
