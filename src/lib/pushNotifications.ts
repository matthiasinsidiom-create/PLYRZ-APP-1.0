import { PushNotifications, PermissionStatus } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabaseService } from '../services/supabaseService';
import { supabase } from './supabase';

export interface PushDebugState {
  started: boolean;
  isNative: boolean;
  platform: string;
  permissionStatus: string;
  registerCalled: boolean;
  tokenReceived: boolean;
  tokenStart: string;
  userId: string;
  saveCalled: boolean;
  lastError: string;
  lastSuccess: boolean;
  lastAttempt: string;
  testPushResult?: {
    success: boolean;
    data?: any;
    error?: any;
    timestamp: string;
  };
}

let pushState: PushDebugState = {
  started: false,
  isNative: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  permissionStatus: 'unknown',
  registerCalled: false,
  tokenReceived: false,
  tokenStart: '',
  userId: '',
  saveCalled: false,
  lastError: '',
  lastSuccess: false,
  lastAttempt: '',
  testPushResult: undefined
};

const listeners: ((state: PushDebugState) => void)[] = [];

const updateState = (update: Partial<PushDebugState>) => {
  pushState = { ...pushState, ...update };
  listeners.forEach(cb => cb(pushState));
};

export const getPushState = () => pushState;

export const onPushStateChange = (cb: (state: PushDebugState) => void) => {
  listeners.push(cb);
  return () => {
    const index = listeners.indexOf(cb);
    if (index > -1) listeners.splice(index, 1);
  };
};

export const setupPushNotifications = async () => {
  updateState({ 
    started: true, 
    lastAttempt: new Date().toISOString(),
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform()
  });

  console.log('[PUSH] setupPushNotifications started');
  console.log('[PUSH] isNativePlatform', Capacitor.isNativePlatform());

  if (!Capacitor.isNativePlatform()) {
    console.log('DEBUG: [PUSH] Not a native platform, skipping push notifications setup.');
    updateState({ permissionStatus: 'n/a (web)' });
    return;
  }

  try {
    // Get Session Info
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || '';
    updateState({ userId });
    console.log('[PUSH] session user id', userId);

    // Remove existing listeners to avoid duplicates
    await PushNotifications.removeAllListeners();

    // Set Listeners BEFORE Register
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[PUSH] token received', token.value?.slice(0, 30));
      updateState({ 
        tokenReceived: true, 
        tokenStart: token.value?.slice(0, 25) || '' 
      });

      const platform = Capacitor.getPlatform();
      updateState({ saveCalled: true });
      
      try {
        const { error } = await supabaseService.savePushToken(token.value, platform);
        if (error) {
          updateState({ lastError: JSON.stringify(error), lastSuccess: false });
        } else {
          updateState({ lastSuccess: true, lastError: '' });
        }
      } catch (err: any) {
        updateState({ lastError: err.message || String(err), lastSuccess: false });
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] registration error', error);
      updateState({ lastError: JSON.stringify(error) });
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('DEBUG: [PUSH] Push received:', JSON.stringify(notification));
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('DEBUG: [PUSH] Push action performed:', JSON.stringify(notification));
    });

    // Permission check
    let permStatus = await PushNotifications.checkPermissions();
    console.log('[PUSH] initial permission check', permStatus.receive);

    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }
    
    console.log('[PUSH] permission result', permStatus.receive);
    updateState({ permissionStatus: permStatus.receive });

    if (permStatus.receive === 'granted') {
      updateState({ registerCalled: true });
      await PushNotifications.register();
    } else {
      console.log('DEBUG: [PUSH] Permission not granted.');
    }

  } catch (error: any) {
    console.error('DEBUG: [PUSH] Error setting up push notifications:', error);
    updateState({ lastError: error.message || String(error) });
  }
};

export const sendTestPush = async () => {
  console.log('[PUSH] Invoking send-test-push function...');
  updateState({
    testPushResult: {
      success: false,
      timestamp: new Date().toISOString(),
      data: 'Sending...'
    }
  });

  try {
    const { data, error } = await supabase.functions.invoke('send-test-push', {
      body: {}
    });

    console.log('[PUSH] send-test-push result:', { data, error });

    updateState({
      testPushResult: {
        success: !error,
        data,
        error,
        timestamp: new Date().toISOString()
      }
    });

    return { data, error };
  } catch (err: any) {
    console.error('[PUSH] Unexpected error calling send-test-push:', err);
    updateState({
      testPushResult: {
        success: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString()
      }
    });
    return { error: err };
  }
};
