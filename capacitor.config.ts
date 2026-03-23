import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.snab.app',
  appName: 'Snab App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;