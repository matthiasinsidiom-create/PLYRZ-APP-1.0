import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  hasAdminAccess: boolean;
  clubAdminLeagueIds: string[];
  clubAdminClubIds: string[];
  profileError: any | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<any | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [clubAdminLeagueIds, setClubAdminLeagueIds] = useState<string[]>([]);
  const [clubAdminClubIds, setClubAdminClubIds] = useState<string[]>([]);

  useEffect(() => {
    console.log('AuthContext: Fetching initial session...');
    console.log('AuthContext: Full Current URL:', window.location.href);
    console.log('AuthContext: Current origin:', window.location.origin);
    console.log('AuthContext: Current hash:', window.location.hash || 'Empty');
    console.log('AuthContext: Current search:', window.location.search || 'Empty');
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hasAccessToken = window.location.hash.includes('access_token');
    
    console.log('AuthContext: URL Analysis:', {
      hasCode: !!code,
      hasAccessToken,
      hasError: window.location.hash.includes('error') || urlParams.has('error')
    });

    if (window.location.hash) {
      const hasError = window.location.hash.includes('error');
      if (hasError) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        console.error('AuthContext: Auth error in hash:', params.get('error_description') || params.get('error'));
      }
    }
    
    let isMounted = true;
    let loadingFinished = false;

    // Safety timeout: Ensure loading is false after 10 seconds even if Supabase hangs
    const timeout = setTimeout(() => {
      if (isMounted && !loadingFinished) {
        console.warn('AuthContext: Session fetch timed out after 10s, forcing loading to false');
        setLoading(false);
        // If we timed out, maybe the session is actually there but getSession hung
        // Let's try one last desperate check of localStorage directly
        try {
          const storedSession = localStorage.getItem('sb-auth-token');
          if (storedSession) {
            console.log('AuthContext: Found session in localStorage after timeout');
          }
        } catch (e) {
          console.error('AuthContext: localStorage inaccessible', e);
        }
      }
    }, 10000);

    // Small delay to allow the URL hash/code to be processed by the SDK if returning from OAuth
    const initAuth = async () => {
      console.log('AuthContext: initAuth starting...');
      
      // Check if we can access localStorage (important for iframes)
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
      } catch (e) {
        console.warn('AuthContext: localStorage is NOT accessible. Auth might fail in this iframe.', e);
      }

      // Small delay to allow the URL hash/code to be processed by the SDK
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Explicitly handle OAuth code if present (PKCE flow)
        if (code) {
          console.log('AuthContext: OAuth code detected, exchanging...');
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('AuthContext: Error exchanging code:', exchangeError);
          } else {
            console.log('AuthContext: Code exchange successful');
          }
          // Clean up URL regardless of success (to avoid infinite loops or stale codes)
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }

        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('AuthContext: getSession error:', sessionError);
          // Error "Refresh Token Not Found" or "Invalid Refresh Token" indicates a stale/invalid session
          // that cannot be refreshed. We must clear it to allow the user to log in again.
          if (
            sessionError.message?.includes('refresh_token') || 
            sessionError.message?.includes('Refresh Token') ||
            sessionError.status === 400 ||
            sessionError.status === 401
          ) {
            console.warn('AuthContext: Stale refresh token detected. Cleaning up...');
            await supabase.auth.signOut();
            setSession(null);
            setProfile(null);
            if (isMounted) setLoading(false);
            loadingFinished = true;
            return;
          }
        }

        if (!isMounted) return;

        if (initialSession) {
          console.log('AuthContext: Initial session found');
          setSession(initialSession);
          await fetchProfile(initialSession.user.id, initialSession);
        } else {
          console.log('AuthContext: No initial session');
          // Wait a bit for onAuthStateChange to possibly fire INITIAL_SESSION
          setTimeout(() => {
            if (isMounted && !loadingFinished) {
              setLoading(false);
              loadingFinished = true;
            }
          }, 1500);
        }
      } catch (err) {
        console.error('AuthContext: Unexpected error in initAuth:', err);
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('AuthContext: Auth state changed', { event: _event, session: !!session });
      
      if (!isMounted) return;

      if (_event === 'INITIAL_SESSION' || _event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        setSession(session);
        if (session) {
          setLoading(true);
          fetchProfile(session.user.id, session);
        } else if (_event === 'INITIAL_SESSION') {
          setLoading(false);
        }
      } else if (_event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setLoading(false);
      }
      
      if (session || _event === 'INITIAL_SESSION') {
        loadingFinished = true;
        clearTimeout(timeout);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchProfile = async (userId: string, session: Session) => {
    setProfileError(null);
    try {
      console.log('AuthContext: Fetching profile for', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('AuthContext: Supabase error fetching profile:', error);
        setProfileError(error);
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('AuthContext: No profile found for user', userId, '- Attempting to create one...');
        // Try to create a profile automatically if it's missing
      const isSuper = session.user.email?.toLowerCase() === "matthias.insidiom@gmail.com";
        
        // IMPORTANT: We use 'role' as the leading field now.
        // Default for new users is 'fan' unless it's the admin email.
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'New User',
            role: isSuper ? 'admin' : 'fan',
            onboarding_completed: false // Everyone starts with onboarding
          })
          .select()
          .single();

        if (createError) {
          console.error('AuthContext: Error creating profile:', createError);
          setProfile(null);
          setProfileError(createError);
        } else {
          console.log('AuthContext: Profile created successfully', newProfile);
          setProfile(newProfile);
          setProfileError(null);
          
          // Check for club admin access
          const { data: clubAdmins } = await supabase.from('club_admins').select('id, club_id, clubs(league_id)').eq('user_id', userId).eq('is_active', true);
          setHasAdminAccess(isSuper || (clubAdmins && clubAdmins.length > 0) || false);
          
          if (clubAdmins) {
            setClubAdminClubIds(clubAdmins.map(ca => ca.club_id));
            setClubAdminLeagueIds(Array.from(new Set(clubAdmins.map(ca => (ca.clubs as any)?.league_id).filter(Boolean))));
          }
        }
      } else {
        // Heal profile if role is missing or invalid
        const isSuper = session.user.email?.toLowerCase() === "matthias.insidiom@gmail.com";
        
        // If role is missing or 'user' (legacy), or if it's admin email but role isn't admin
        if (!data.role || data.role === 'user' || (isSuper && data.role !== 'admin')) {
          console.warn('AuthContext: Profile needs healing...', { role: data.role, isSuper });
          const { data: healedProfile, error: healError } = await supabase
            .from('profiles')
            .update({ 
              role: isSuper ? 'admin' : (data.role && data.role !== 'user' ? data.role : 'fan'),
              onboarding_completed: isSuper ? true : data.onboarding_completed
            })
            .eq('id', userId)
            .select()
            .single();
          
          if (!healError && healedProfile) {
            console.log('AuthContext: Profile healed successfully', healedProfile);
            setProfile(healedProfile);
          } else {
            console.error('AuthContext: Error healing profile:', healError);
            setProfile(data);
          }
        } else {
          console.log('AuthContext: Profile fetched successfully', data);
          setProfile(data);
        }
        setProfileError(null);
        
        // Check for club admin access
        const { data: clubAdmins } = await supabase.from('club_admins').select('id, club_id, clubs(league_id)').eq('user_id', userId).eq('is_active', true);
        setHasAdminAccess(isSuper || (clubAdmins && clubAdmins.length > 0) || data.role === 'admin' || false);
        
        if (clubAdmins) {
          setClubAdminClubIds(clubAdmins.map(ca => ca.club_id));
          setClubAdminLeagueIds(Array.from(new Set(clubAdmins.map(ca => (ca.clubs as any)?.league_id).filter(Boolean))));
        }
      }
    } catch (error) {
      console.error('AuthContext: Unexpected error fetching profile:', error);
      setProfileError(error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.user?.id && session) {
      setLoading(true);
      await fetchProfile(session.user.id, session);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: (profile?.role === 'admin') || (session?.user?.email?.toLowerCase() === "matthias.insidiom@gmail.com"),
      hasAdminAccess,
      clubAdminLeagueIds,
      clubAdminClubIds,
      profileError,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
