import { isNative } from './platform'

export async function copyToClipboard(text: string): Promise<boolean> {
  if (isNative()) {
    const { Clipboard } = await import('@capacitor/clipboard')
    await Clipboard.write({ string: text })
    return true
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
