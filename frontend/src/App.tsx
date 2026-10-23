import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
import { LoginPage } from './pages/LoginPage';
import { EmailListPage } from './pages/EmailListPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { ComposePage } from './pages/ComposePage';

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
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/*"
            element={
              <AuthGate>
                <AppShell>
                  <Routes>
                    <Route path="/" element={<Navigate to="/scheduled" replace />} />
                    <Route path="/scheduled" element={<EmailListPage mode="scheduled" />} />
                    <Route path="/sent" element={<EmailListPage mode="sent" />} />
                    <Route path="/emails/:id" element={<EmailDetailPage />} />
                    <Route path="/compose" element={<ComposePage />} />
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
