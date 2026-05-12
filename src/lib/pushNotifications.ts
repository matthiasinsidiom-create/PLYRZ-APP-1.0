import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabaseService } from '../services/supabaseService';

let pushSetupDone = false;

export const setupPushNotifications = async () => {
  console.log('[PUSH] setupPushNotifications started');
  console.log('[PUSH] isNativePlatform', Capacitor.isNativePlatform());

  if (!Capacitor.isNativePlatform()) {
    console.log('[PUSH] Not a native platform, skipping push notifications setup.');
    return;
  }

  if (pushSetupDone) {
    console.log('[PUSH] setup already done, skipping duplicate listener registration.');
    return;
  }

  pushSetupDone = true;

  try {
    await PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async (token) => {
      console.log('[PUSH] token received', token.value?.slice(0, 30));

      try {
        const platform = Capacitor.getPlatform();
        await supabaseService.savePushToken(token.value, platform);
      } catch (error) {
        console.error('[PUSH] error while saving token', error);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] registration error', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PUSH] push received', JSON.stringify(notification));
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[PUSH] push action performed', JSON.stringify(notification));
    });

    const currentPermission = await PushNotifications.checkPermissions();
    console.log('[PUSH] current permission', currentPermission);

    let permission = currentPermission;

    if (currentPermission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
      console.log('[PUSH] permission request result', permission);
    }

    if (permission.receive === 'granted') {
      console.log('[PUSH] registering for push notifications...');
      await PushNotifications.register();
    } else {
      console.warn('[PUSH] permission not granted', permission);
    }
  } catch (error) {
    pushSetupDone = false;
    console.error('[PUSH] setup error', error);
  }
};
