import { registerPlugin } from '@capacitor/core'

export interface ApkInstallerPlugin {
  /** Launches Android's package installer for a local APK file/URI. */
  install(options: { path: string }): Promise<{ started: boolean }>
  /** Android 8+: whether this app currently has permission to install unknown apps. */
  canInstallUnknownApps(): Promise<{ value: boolean }>
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller')
export default ApkInstaller
