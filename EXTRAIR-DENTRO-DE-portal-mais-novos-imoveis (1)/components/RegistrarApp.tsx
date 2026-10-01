'use client';

import { useEffect } from 'react';

// Registra o service worker do app (só é montado para quem está logado na equipe)
export default function RegistrarApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
