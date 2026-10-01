'use client';

import { useCallback, useEffect, useState } from 'react';
import { staffLogin, staffLogout, getStaffSession } from './actions';
import type { StaffSessionPayload } from './session';

export type StaffRole = 'admin' | 'corretor';
export type StaffUser = StaffSessionPayload;

// Mesma "forma" do hook de antes (staff, loaded, login, logout) — só a
// implementação trocou, de localStorage pra sessão real no banco de dados
// (cookie assinado, ver lib/session.ts e lib/actions.ts). As telas que já
// usavam esse hook não precisaram mudar.
export function useStaffSession() {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getStaffSession().then((session) => {
      setStaff(session);
      setLoaded(true);
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<StaffUser | null | 'bloqueado'> => {
    const user = await staffLogin(email, password);
    if (user !== 'bloqueado') setStaff(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await staffLogout();
    setStaff(null);
  }, []);

  return { staff, loaded, login, logout };
}
