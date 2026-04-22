import { createClient, SupportedStorage } from '@supabase/supabase-js';
import { appConfig } from './config';

// Custom storage implementation that handles localStorage errors in iframes
const customStorage: SupportedStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('SupabaseStorage: getItem failed', e);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('SupabaseStorage: setItem failed', e);
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('SupabaseStorage: removeItem failed', e);
    }
  }
};

export const supabase = createClient(
  appConfig.supabaseUrl,
  appConfig.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
      storage: customStorage
    }
  }
);
