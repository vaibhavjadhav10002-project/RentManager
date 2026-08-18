import { redirect } from 'next/navigation'

/**
 * This should almost never actually execute — middleware.ts now handles
 * the auth+role redirect for `/` directly (before Next.js even reaches
 * this route), which is what removed the extra ~300-800ms of redundant
 * getUser()/profile round-trips this page used to make on every cold
 * launch. This is kept only as a defensive fallback (e.g. if middleware's
 * matcher is ever changed to exclude `/`), so it deliberately does the
 * simplest possible thing rather than re-adding the same duplicate
 * network calls middleware already just made.
 */
export default function RootPage() {
  redirect('/login')
}
