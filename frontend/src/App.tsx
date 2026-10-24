import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { User } from './types';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmailListPage } from './pages/EmailListPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { ComposePage } from './pages/ComposePage';
import { IntegrationsPage } from './pages/IntegrationsPage';

export function useAuth() {
  const query = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const ticket = urlParams.get('auth_ticket') || localStorage.getItem('auth_ticket');
      if (urlParams.get('auth_ticket')) {
        localStorage.setItem('auth_ticket', urlParams.get('auth_ticket')!);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const headers: Record<string, string> = {};
      if (ticket) headers['x-auth-ticket'] = ticket;

      const res = await fetch(`/api/me${ticket ? `?auth_ticket=${ticket}` : ''}`, {
        headers,
        credentials: 'include',
      });
      if (res.status === 401) {
        localStorage.removeItem('auth_ticket');
        return null;
      }
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: !!query.data,
    refetch: query.refetch,
  };
}

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Landing & Login */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Workspace */}
          <Route
            path="/*"
            element={
              <AuthGate>
                <AppShell>
                  <Routes>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/scheduled" element={<EmailListPage mode="scheduled" />} />
                    <Route path="/sent" element={<EmailListPage mode="sent" />} />
                    <Route path="/compose" element={<ComposePage />} />
                    <Route path="/integrations" element={<IntegrationsPage />} />
                    <Route path="/settings" element={<IntegrationsPage />} />
                    <Route path="/emails/:id" element={<EmailDetailPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppShell>
              </AuthGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
