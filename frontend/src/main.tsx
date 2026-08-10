import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { registerPosServiceWorker } from "./offline/registerServiceWorker";
import { startOutboxSyncWorker } from "./offline/startSyncWorker";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

registerPosServiceWorker();
startOutboxSyncWorker();
