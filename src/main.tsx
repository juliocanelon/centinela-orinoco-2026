import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ManualApp from './manual/ManualApp.tsx';
import './index.css';

function RootApp() {
  const [hash, setHash] = useState<string>(() => window.location.hash || '');

  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash || '');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isManualRoute = hash.startsWith('#/manual') || hash.startsWith('/manual');

  return isManualRoute ? <ManualApp /> : <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
