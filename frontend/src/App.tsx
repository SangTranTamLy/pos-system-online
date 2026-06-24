import AppRoutes from "./routes/AppRoutes";
import { AppNotificationsProvider } from "./components/common/AppNotifications";

function App() {
  return (
    <AppNotificationsProvider>
      <AppRoutes />
    </AppNotificationsProvider>
  );
}

export default App;
