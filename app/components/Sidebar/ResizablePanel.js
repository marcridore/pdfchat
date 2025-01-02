'use client'
import { useState, useEffect, useCallback } from 'react'

export default function ResizablePanel({ children, defaultWidth = 384, minWidth = 280, maxWidth = 800 }) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)

  const startResizing = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (e) => {
      if (isResizing) {
        const newWidth = document.documentElement.clientWidth - e.clientX
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setWidth(newWidth)
        }
      }
    },
    [isResizing, minWidth, maxWidth]
  )

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', resize)
      document.addEventListener('mouseup', stopResizing)
    }

    return () => {
      document.removeEventListener('mousemove', resize)
      document.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  return (
    <div 
      className="relative flex h-screen" 
      style={{ width: width }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group hover:bg-blue-500/50 transition-colors"
        onMouseDown={startResizing}
      >
        <div className="absolute left-0 top-0 bottom-0 w-4 -translate-x-1/2 group-hover:bg-blue-500/30" />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
} 