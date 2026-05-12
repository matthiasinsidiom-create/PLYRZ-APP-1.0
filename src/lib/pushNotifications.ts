import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabaseService } from '../services/supabaseService';

export const setupPushNotifications = async () => {
  console.log('[PUSH] setupPushNotifications started');
  console.log('[PUSH] isNativePlatform', Capacitor.isNativePlatform());

  if (!Capacitor.isNativePlatform()) {
    console.log('DEBUG: [PUSH] Not a native platform, skipping push notifications setup.');
    return;
  }

  try {
    // Request permission to use push notifications
    // iOS will prompt user and return if they granted permission or not
    // Android will just grant without prompting
    const result = await PushNotifications.requestPermissions();
    console.log('[PUSH] permission result', result.receive);

    if (result.receive === 'granted') {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();
    } else {
      console.log('DEBUG: [PUSH] Permission not granted.');
    }

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PUSH] token received', token.value?.slice(0, 30));
      const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
      await supabaseService.savePushToken(token.value, platform);
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] registration error', error);
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('DEBUG: [PUSH] Push received:', JSON.stringify(notification));
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('DEBUG: [PUSH] Push action performed:', JSON.stringify(notification));
    });

  } catch (error) {
    console.error('DEBUG: [PUSH] Error setting up push notifications:', error);
  }
};
