import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';
import { AccountProvider } from './lib/account';
import { PlatformProvider } from './lib/platform/context';
import { installDiagnostics } from './lib/diagnostics';
import { LanguageProvider } from './lib/i18n';
import './index.css';

installDiagnostics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AccountProvider>
        <PlatformProvider>
          <LanguageProvider><App /></LanguageProvider>
        </PlatformProvider>
      </AccountProvider>
    </StoreProvider>
  </StrictMode>,
);

// Offline support in production builds only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
