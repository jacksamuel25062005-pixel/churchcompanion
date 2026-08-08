import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.churchcompanion.app',
  appName: 'Church Companion',
  webDir: 'dist',
  server: {
    // The app is a TanStack Start SSR app deployed on Lovable's infrastructure
    // (server functions, Supabase, OneSignal push). We shell the live deployment
    // rather than bundling a static build, since SSR/server-function routes
    // cannot run inside an offline WebView bundle.
    url: 'https://churchcompanion.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
