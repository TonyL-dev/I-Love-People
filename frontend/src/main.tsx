import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initializeRecovery } from './auth/client';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
initializeRecovery();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/service-worker.js').catch(() => {
    // In-app reminders and account access work without a service worker.
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
