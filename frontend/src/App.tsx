import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmailListPage } from './pages/EmailListPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { ComposePage } from './pages/ComposePage';
import { IntegrationsPage } from './pages/IntegrationsPage';

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
