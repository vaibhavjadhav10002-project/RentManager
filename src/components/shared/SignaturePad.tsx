'use client'
import { useRef, useState, useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

interface Props {
  onChange: (dataUrl: string | null) => void
}

export default function SignaturePad({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasSignature) setHasSignature(true)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    onChange(canvasRef.current!.toDataURL('image/png'))
  }

  function clear() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    onChange(null)
  }

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full h-36 touch-none cursor-crosshair rounded-xl"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none">
            Sign here with your finger or mouse
          </div>
        )}
      </div>
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700">
        <RotateCcw className="w-3.5 h-3.5" /> Clear signature
      </button>
    </div>
  )
}
