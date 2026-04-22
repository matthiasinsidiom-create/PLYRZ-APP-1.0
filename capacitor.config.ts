import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'at.plyrz.app',
  appName: 'PLYRZ',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      // Configuration for geolocation if needed
    }
  }
};

export default config;
