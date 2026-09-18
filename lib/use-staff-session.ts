'use client';

import { useCallback, useEffect, useState } from 'react';

// Login da equipe (admin/corretor) — separado do login de cliente com Google
// (lib/use-session.ts), que só serve pra favoritos. Aqui é RBAC de verdade
// (ver documento de arquitetura, seção "Painel administrativo e RBAC").
// Credenciais mockadas — em produção isso é NextAuth/Clerk + banco de dados.

export type StaffRole = 'admin' | 'corretor';
export type StaffUser = { name: string; email: string; role: StaffRole };

const STORAGE_KEY = 'mn_staff_session';

const MOCK_STAFF: { email: string; password: string; name: string; role: StaffRole }[] = [
  { email: 'admin@maisnovos.com', password: 'admin123', name: 'Admin', role: 'admin' },
  { email: 'corretor@maisnovos.com', password: 'corretor123', name: 'Corretor Demo', role: 'corretor' }
];

export function useStaffSession() {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setStaff(JSON.parse(stored));
    } catch {
      // sem sessão salva
    }
    setLoaded(true);
  }, []);

  const login = useCallback((email: string, password: string): StaffUser | null => {
    const match = MOCK_STAFF.find((s) => s.email === email && s.password === password);
    if (!match) return null;
    const user: StaffUser = { name: match.name, email: match.email, role: match.role };
    setStaff(user);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      // ignora falha de storage
    }
    return user;
  }, []);

  const logout = useCallback(() => {
    setStaff(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora falha de storage
    }
  }, []);

  return { staff, loaded, login, logout };
}
