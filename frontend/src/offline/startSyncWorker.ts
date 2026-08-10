import { syncOutbox } from "./syncOutbox";

let workerStarted = false;

export function startOutboxSyncWorker() {
  if (workerStarted) return;
  workerStarted = true;

  const attemptSync = () => {
    if (!navigator.onLine) return;
    void syncOutbox().catch((error) => {
      console.error("POS outbox background sync failed:", error);
    });
  };

  window.addEventListener("online", attemptSync);
  window.setInterval(attemptSync, 45_000);
  window.setTimeout(attemptSync, 0);
}

