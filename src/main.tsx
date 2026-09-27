import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AppProvider } from './state/AppContext';
import './styles.css';

function Gate() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    // Keyed by account so switching users starts from a clean slate.
    <AppProvider key={user.id} userId={user.id}>
      <App />
    </AppProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </StrictMode>,
);
