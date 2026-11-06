import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';
import { AccountProvider } from './lib/account';
import { PlatformProvider } from './lib/platform/context';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AccountProvider>
        <PlatformProvider>
          <App />
        </PlatformProvider>
      </AccountProvider>
    </StoreProvider>
  </StrictMode>,
);

// Offline support in production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
