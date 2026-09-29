'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCliente, sairCliente, type Cliente } from './cliente-auth';

// Sessão do CLIENTE (login com Google). Um único "store" compartilhado por
// todos os componentes: logou no modal do coração, o topo e o feed já sabem.
type Session = { loggedIn: boolean; userId: string | null; cliente: Cliente | null };

const EMPTY: Session = { loggedIn: false, userId: null, cliente: null };
const DEMO_KEY = 'mn_session'; // modo de teste (sem Google configurado)

let atual: Session = EMPTY;
let carregado: Promise<void> | null = null;
const ouvintes = new Set<(s: Session) => void>();
function publicar(s: Session) {
  atual = s;
  ouvintes.forEach((fn) => fn(s));
}

function carregar() {
  if (!carregado) {
    carregado = (async () => {
      try {
        const c = await getCliente();
        if (c) return publicar({ loggedIn: true, userId: c.email, cliente: c });
      } catch {
        // servidor indisponível
      }
      try {
        const demo = localStorage.getItem(DEMO_KEY);
        if (demo) publicar({ ...EMPTY, ...JSON.parse(demo), cliente: null });
      } catch {
        // sem sessão salva
      }
    })();
  }
  return carregado;
}

export function useSession() {
  const [session, setSession] = useState<Session>(atual);

  useEffect(() => {
    ouvintes.add(setSession);
    carregar().then(() => setSession(atual));
    return () => {
      ouvintes.delete(setSession);
    };
  }, []);

  // Chamado pelo LoginModal depois do login com Google (ou no modo de teste)
  const signIn = useCallback((cliente?: Cliente | null) => {
    const next: Session = cliente
      ? { loggedIn: true, userId: cliente.email, cliente }
      : { loggedIn: true, userId: `demo-user-${Math.random().toString(36).slice(2, 8)}`, cliente: null };
    if (!cliente) {
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify({ loggedIn: true, userId: next.userId }));
      } catch {
        // ignora
      }
    }
    publicar(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      // ignora
    }
    await sairCliente().catch(() => {});
    publicar(EMPTY);
  }, []);

  return { session, signIn, signOut };
}
