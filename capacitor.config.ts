import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cloudtunes.music',
  appName: 'CloudTunes',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Allow localhost for development
    cleartext: true,
  },
  android: {
    buildOptions: {
      keystorePath: undefined, // We'll use debug keystore (free)
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
    },
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000",
    },
  },
};

export default config;

