import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getStoredToken, setStoredToken } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

const STORED_USER_KEY = 'bromise_user';

export function getStoredUser(): User | null {
  try {
    const data = localStorage.getItem(STORED_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  if (user) {
    localStorage.setItem(STORED_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORED_USER_KEY);
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const token = getStoredToken();
    return token ? getStoredUser() : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    return Boolean(token && !storedUser);
  });

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then(res => {
          if (res.user) {
            setUser(res.user);
            setStoredUser(res.user);
          }
        })
        .catch((err: any) => {
          console.warn('Auth verification check failed (network/server sleeping):', err.message);
          // Do NOT clear stored token or user here! The token is valid for 30 days.
          // Token will only be cleared if server returns 401 (via auth:unauthorized event in api.ts).
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const handleUnauthorized = () => {
      setUser(null);
      setStoredUser(null);
      setStoredToken(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setLoading(true);
    try {
      const res = await api.googleAuth(credential);
      setStoredToken(res.token);
      setStoredUser(res.user);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStoredToken(null);
    setStoredUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

