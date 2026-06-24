import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';

// Page Imports
import Auth from './pages/Auth';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Notifications from './pages/Notifications';
import Bookmarks from './pages/Bookmarks';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Communities from './pages/Communities';

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Guarded Route component to redirect unauthenticated sessions to the Auth page
function GuardedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public Auth Page */}
          <Route path="/" element={<Auth />} />

          {/* Guarded Social Pages */}
          <Route
            path="/home"
            element={
              <GuardedRoute>
                <Home />
              </GuardedRoute>
            }
          />
          <Route
            path="/explore"
            element={
              <GuardedRoute>
                <Explore />
              </GuardedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <GuardedRoute>
                <Notifications />
              </GuardedRoute>
            }
          />
          <Route
            path="/bookmarks"
            element={
              <GuardedRoute>
                <Bookmarks />
              </GuardedRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <GuardedRoute>
                <Profile />
              </GuardedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <GuardedRoute>
                <Messages />
              </GuardedRoute>
            }
          />
          <Route
            path="/communities"
            element={
              <GuardedRoute>
                <Communities />
              </GuardedRoute>
            }
          />

          {/* Fallback Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      
      {/* Floating Notifications */}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  );
}
