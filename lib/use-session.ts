'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mn_session';

type Session = { loggedIn: boolean; userId: string | null };

const EMPTY_SESSION: Session = { loggedIn: false, userId: null };

export function useSession() {
  const [session, setSession] = useState<Session>(EMPTY_SESSION);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSession(JSON.parse(stored));
    } catch {
      // sem sessão salva — segue deslogado
    }
  }, []);

  // Login "sob demanda": disparado só quando a pessoa tenta favoritar.
  // Em produção troca por Google Identity Services de verdade — o backend
  // troca o credential do Google por uma sessão própria (ver documento de
  // arquitetura, seção "Login sob demanda e coleta comportamental").
  const signIn = useCallback(() => {
    const next: Session = { loggedIn: true, userId: `demo-user-${Math.random().toString(36).slice(2, 8)}` };
    setSession(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignora falha de storage
    }
    return next;
  }, []);

  return { session, signIn };
}
