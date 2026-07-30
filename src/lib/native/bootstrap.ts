import { isNative } from './platform'

/**
 * Runs once on app mount inside the native shell. Every piece here is
 * additive shell behavior (status bar color, back button, deep links,
 * splash screen) — none of it touches routing, auth, or business logic.
 * On web/PWA this is a no-op beyond adding a CSS marker class.
 */
export async function bootstrapNative() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add(isNative() ? 'native-app' : 'web-app')
  }
  if (!isNative()) return

  const [{ StatusBar, Style }, { SplashScreen }, { App }, { Keyboard }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
    import('@capacitor/keyboard'),
  ])

  // Match status bar to the app's existing dark/light state instead of
  // guessing — the app already toggles a `.dark` class on <html>.
  const applyStatusBarForTheme = async () => {
    const dark = document.documentElement.classList.contains('dark')
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
      await StatusBar.setBackgroundColor({ color: dark ? '#0f172a' : '#2563EB' })
    } catch {
      // StatusBar plugin has no-ops on some OEM skins — never block app load on this.
    }
  }
  await applyStatusBarForTheme()
  // Re-apply whenever the app's own theme toggle flips the `.dark` class.
  new MutationObserver(applyStatusBarForTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  // Edge-to-edge on Android 13/14 — content draws under the status/nav bars,
  // safe-area CSS (added in globals.css) handles the padding.
  try {
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {}

  try {
    await SplashScreen.hide()
  } catch {}

  // Hardware back button: mimic normal browser back; only exit the app
  // when there's nowhere left to go back to. Doesn't touch app routing —
  // it just drives the existing browser history the app already uses.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })

  // Deep links (yourapp://... and https://yourdomain.com/... universal
  // links) resolve to a path on the SAME production site already loaded
  // in the WebView — this just navigates within it, it does not
  // reimplement routing.
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const parsed = new URL(url)
      window.location.href = parsed.pathname + parsed.search + parsed.hash
    } catch {
      // Malformed deep link — ignore rather than crash the shell.
    }
  })

  try {
    await Keyboard.setResizeMode({ mode: 'body' as any })
  } catch {}
}
