import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AdminAuthContextType {
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (emailOrUsername: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const ADMIN_STORAGE_KEY = 'ana_admin_auth_session';

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Listen to Supabase auth changes if configured
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const userObj: AdminUser = {
            id: session.user.id,
            email: session.user.email || 'admin@anachiangmai.vn',
            name: session.user.user_metadata?.name || 'Quản trị viên ANA Chiang Mai',
            role: 'ADMIN'
          };
          setAdminUser(userObj);
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(userObj));
        } else if (!session) {
          // If supabase logs out
          // setAdminUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (emailOrUsername: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const cleanedIdentifier = emailOrUsername.trim().toLowerCase();
    const cleanedPass = pass.trim();

    try {
      // 1. Default standard admin credential verification for ANA CHIANG MAI
      // Priority check for administrator identity for instant, offline-capable and reliable authentication
      const isValidAdminId = 
        cleanedIdentifier === 'admin' || 
        cleanedIdentifier === 'admin@anachiangmai.vn' ||
        cleanedIdentifier === 'administrator';

      const isCorrectPassword = 
        cleanedPass === 'admin123' || 
        cleanedPass === 'anachiangmai2026' || 
        cleanedPass === '123456' || 
        cleanedPass === 'admin';

      if (isValidAdminId && isCorrectPassword) {
        const userObj: AdminUser = {
          id: 'admin-master',
          email: 'admin@anachiangmai.vn',
          name: 'Quản trị viên ANA Chiang Mai',
          role: 'ADMIN'
        };
        setAdminUser(userObj);
        try {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(userObj));
        } catch {
          // ignore
        }
        setIsLoading(false);
        return { success: true };
      }

      // 2. If Supabase is configured, attempt Supabase Auth for registered team accounts
      if (isSupabaseConfigured && supabase) {
        try {
          const emailToTry = cleanedIdentifier.includes('@') 
            ? cleanedIdentifier 
            : `${cleanedIdentifier}@anachiangmai.vn`;

          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailToTry,
            password: pass
          });

          if (!error && data?.user) {
            const userObj: AdminUser = {
              id: data.user.id,
              email: data.user.email || emailToTry,
              name: data.user.user_metadata?.name || 'Quản trị viên ANA Chiang Mai',
              role: 'ADMIN'
            };
            setAdminUser(userObj);
            try {
              localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(userObj));
            } catch {
              // ignore
            }
            setIsLoading(false);
            return { success: true };
          }
        } catch (err: unknown) {
          console.warn('Supabase auth attempt error:', err);
        }
      }

      setIsLoading(false);
      return { success: false, error: 'Tài khoản hoặc mật khẩu không chính xác.' };
    } catch (err: unknown) {
      console.error('Unexpected error during admin login:', err);
      setIsLoading(false);
      return { success: false, error: 'Có lỗi xảy ra khi xác thực. Vui lòng thử lại.' };
    }
  };

  const logout = () => {
    setAdminUser(null);
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isAdmin: !!adminUser && adminUser.role === 'ADMIN',
        isLoading,
        login,
        logout
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
