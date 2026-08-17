import { isNative } from './platform'

/**
 * Real hardware haptic feedback on tap (not a CSS effect — an actual
 * short vibration), the single biggest ingredient in why native apps
 * feel "native" that a web app structurally cannot fake with CSS alone.
 * No-ops instantly on web/PWA (isNative() check short-circuits before
 * ever touching the Capacitor plugin), so this is always safe to call
 * from shared code that also runs in the browser.
 */
export async function tapHaptic() {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Some OEM Android skins/older devices have no haptics hardware or a
    // no-op plugin — never let this block the actual button action.
  }
}

/** Slightly stronger pulse for a completed action (approve, save, submit). */
export async function successHaptic() {
  if (!isNative()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType.Success })
  } catch {}
}
