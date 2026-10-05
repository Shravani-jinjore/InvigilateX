// frontend/src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (currentSession) => {
    if (!currentSession?.user?.id) {
      setRole(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentSession.user.id)
        .maybeSingle();

      console.log('[AuthContext] fetchRole →', data, error);

      if (error) {
        console.error('[AuthContext] role fetch error:', error.message);
        const metaRole = currentSession.user.user_metadata?.role;
        setRole(metaRole || null);
      } else {
        setRole(data?.role || null);
      }
    } catch (err) {
      console.error('[AuthContext] fetchRole exception:', err);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      console.log('[AuthContext] initial session:', s?.user?.email);
      setSession(s);
      setUser(s?.user || null);
      fetchRole(s);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      console.log('[AuthContext] auth change:', _event, s?.user?.email);
      setSession(s);
      setUser(s?.user || null);
      if (s) {
        fetchRole(s);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setSession(null);
  };

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  return (
    <AuthContext.Provider value={{ user, role, session, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
