import { isNative } from './platform'
import type jsPDF from 'jspdf'

/**
 * Saves a jsPDF document. On web, behaves exactly like `doc.save()` (no
 * change to existing behavior). On native, browser-style `<a download>`
 * doesn't reliably reach a visible location in Android/iOS WebViews, so
 * this writes the file into app storage via Filesystem and hands it to
 * the OS share sheet (Save to Files / Drive / etc.), which is the
 * standard native pattern for "download this PDF".
 */
export async function savePdf(doc: jsPDF, filename: string): Promise<void> {
  if (!isNative()) {
    doc.save(filename)
    return
  }
  const base64 = doc.output('datauristring').split(',')[1]
  await writeAndShare(base64, filename, 'application/pdf')
}

/** Same idea as savePdf, but for an arbitrary Blob (e.g. the JSON backup export). */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (!isNative()) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return
  }
  const base64 = await blobToBase64(blob)
  await writeAndShare(base64, filename, blob.type || 'application/octet-stream')
}

async function writeAndShare(base64Data: string, filename: string, mimeType: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const written = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  })
  await Share.share({
    title: filename,
    url: written.uri,
    dialogTitle: `Save or share ${filename}`,
  }).catch(async () => {
    // Some OEM share sheets reject certain mime types; fall back to just
    // confirming the file exists in app cache rather than failing silently.
    console.warn(`[native/share] Share sheet unavailable, file saved at ${written.uri}`)
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
