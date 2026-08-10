export function registerPosServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    void navigator.serviceWorker
      .register(`${baseUrl}sw.js`, { scope: baseUrl })
      .catch((error) => {
        console.error("Không đăng ký được service worker POS:", error);
      });
  });
}

