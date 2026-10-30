import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { currentUserRequest, loginRequest, registerRequest } from '../api/authApi.js';
import { useToast } from './ToastContext.jsx';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [ready, setReady] = useState(false); const toast = useToast();
  const clearSession = useCallback(() => { localStorage.removeItem('onboardiq.token'); setUser(null); }, []);
  useEffect(() => {
    const expired = () => { clearSession(); toast('Your session ended. Sign in again to continue.', 'error'); };
    window.addEventListener('onboardiq:session-expired', expired);
    const token = localStorage.getItem('onboardiq.token');
    if (!token) { setReady(true); return () => window.removeEventListener('onboardiq:session-expired', expired); }
    currentUserRequest().then(setUser).catch(clearSession).finally(() => setReady(true));
    return () => window.removeEventListener('onboardiq:session-expired', expired);
  }, [clearSession, toast]);
  const login = useCallback(async (credentials, expectedRole) => {
    const result = await loginRequest(credentials);
    if (expectedRole && result.user?.role !== expectedRole) {
      const roleLabel = { CUSTOMER: 'Customer', MAKER: 'Maker', CHECKER: 'Checker', COMPLIANCE: 'Compliance', ADMIN: 'Admin' }[result.user?.role] || 'another role';
      throw new Error(`This account is registered as ${roleLabel}. Select ${roleLabel} to sign in.`);
    }
    localStorage.setItem('onboardiq.token', result.token); setUser(result.user); return result.user;
  }, []);
  const register = useCallback(async (payload) => {
    const result = await registerRequest(payload);
    localStorage.setItem('onboardiq.token', result.token); setUser(result.user); return result.user;
  }, []);
  const logout = useCallback(() => { clearSession(); toast('You have been signed out.', 'success'); }, [clearSession, toast]);
  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
