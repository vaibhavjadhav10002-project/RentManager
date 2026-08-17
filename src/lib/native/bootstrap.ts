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

  // NOTE: deliberately 'none', not 'body'. Capacitor's 'body' resize mode
  // works by applying a height/position constraint to <body> whenever the
  // keyboard shows — and on some Android WebView versions that constraint
  // doesn't reliably get cleared afterwards, leaving the whole app
  // permanently "stuck"/unscrollable until something else forces a
  // reflow. 'none' lets the keyboard simply overlap content instead
  // (our forms are in modals/bottom-sheets that already scroll
  // internally, so nothing actually needs the page to auto-resize).
  try {
    await Keyboard.setResizeMode({ mode: 'none' as any })
  } catch {}

  // Global light haptic on every button/link tap — same reach as the CSS
  // `:active` scale feedback in globals.css (one listener, every button in
  // the app picks it up automatically), but this is real hardware
  // vibration instead of a visual cue. Capturing + passive so it can't
  // block or interfere with the actual click handler underneath; a bad
  // tap target (disabled button, aria-disabled) is skipped so users don't
  // feel a buzz for a tap that visibly did nothing.
  const { tapHaptic } = await import('./haptics')
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('button, a, [role="button"]')
    if (!target) return
    if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
    tapHaptic()
  }, { capture: true, passive: true })
}
