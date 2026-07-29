import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center">
        <SearchX className="w-7 h-7" />
      </div>
      <h1 className="text-lg font-extrabold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-500 max-w-sm">
        This page doesn&rsquo;t exist, or you may not have access to it.
      </p>
      <Link href="/"
        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
        Go Home
      </Link>
    </div>
  )
}
