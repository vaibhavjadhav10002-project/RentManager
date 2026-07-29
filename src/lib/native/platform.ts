import { Capacitor } from '@capacitor/core'

/** True when running inside the Capacitor Android/iOS shell (not a browser tab, not the installed PWA). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web'
}
