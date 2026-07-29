import type { CapacitorConfig } from '@capacitor/cli'

// ─────────────────────────────────────────────────────────────────────────
// WHY "server.url" INSTEAD OF A STATIC BUNDLE
// ─────────────────────────────────────────────────────────────────────────
// This app has real server-side routes that must keep running on a real
// Node server: api/push/send (VAPID web-push), api/cron/automatic-backup
// (Vercel Cron), api/whatsapp. A `next export` static bundle can't serve
// those, and rewriting them onto edge/serverless functions would be an
// architectural change to business logic — explicitly out of scope here.
//
// Pointing Capacitor's WebView at the live production URL keeps ONE
// codebase for web + Android + iOS: the native shell just becomes a
// WebView with the native bridge (Camera, Share, Push, Back Button, Deep
// Links, etc.) injected into the same site you already deploy to Vercel.
// This is Capacitor's documented, supported configuration for exactly
// this situation — not a workaround.
//
// Replace PRODUCTION_URL below with your real deployed domain before
// building. Until then it falls back to a placeholder that will visibly
// fail, on purpose, rather than silently pointing at nothing.
// ─────────────────────────────────────────────────────────────────────────
const PRODUCTION_URL = process.env.CAPACITOR_SERVER_URL || 'https://REPLACE-WITH-YOUR-PRODUCTION-DOMAIN.example'

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    throw new Error(
      `[capacitor.config.ts] CAPACITOR_SERVER_URL is not a valid absolute URL: "${url}". ` +
      `Set it to your real deployed domain, e.g. https://your-app.vercel.app`
    )
  }
}

const config: CapacitorConfig = {
  appId: 'com.pgmanager.app',
  appName: 'PG Manager',
  webDir: 'public', // unused in remote-url mode, but required by the CLI schema
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
    // Supabase storage/CDN + your own domain are the only origins the
    // shell should ever navigate to inline; anything else (e.g. tapping an
    // external link) should open in the system browser instead of hijacking
    // the app's webview.
    allowNavigation: [
      '*.supabase.co',
      safeHostname(PRODUCTION_URL),
    ],
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic', // respects safe area / Dynamic Island
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#2563EB', // matches manifest.json theme_color
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK', // overridden at runtime per theme in native/bootstrap.ts
      backgroundColor: '#2563EB',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
