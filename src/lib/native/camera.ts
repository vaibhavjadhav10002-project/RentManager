import { isNative } from './platform'

export type PickedImage = { blob: Blob; webPath?: string }

/**
 * Opens the native camera/gallery chooser and returns a Blob compatible
 * with wherever the app currently expects a File/Blob (e.g. the existing
 * gov-ID upload flow). On web this is a no-op — existing `<input
 * type="file">` elements keep working exactly as before; call this only
 * from a native-specific "Take Photo" button if you add one.
 */
export async function pickImageNative(): Promise<PickedImage | null> {
  if (!isNative()) return null

  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt, // lets the user choose Camera vs Photo Library
  })
  if (!photo.webPath) return null
  const response = await fetch(photo.webPath)
  const blob = await response.blob()
  return { blob, webPath: photo.webPath }
}
