'use client'
import { useState, useEffect, useRef } from 'react'

export default function Tooltip({ text, position, onClose, children }) {
  const [footnote, setFootnote] = useState('')
  const [loading, setLoading] = useState(true)
  const tooltipRef = useRef(null)

  useEffect(() => {
    const fetchFootnote = async () => {
      try {
        const response = await fetch('/api/footnote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        setFootnote(data.footnote)
      } catch (error) {
        console.error('Footnote error:', error)
        setFootnote('Error generating footnote')
      } finally {
        setLoading(false)
      }
    }

    fetchFootnote()
  }, [text])

  useEffect(() => {
    function handleClickOutside(event) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 bg-white rounded-lg shadow-xl border p-4 max-w-md"
      style={{
        left: position.x,
        top: position.y + 20,
        transform: 'translateX(-50%)',
      }}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading footnote...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-900">{text}</div>
          <div className="text-sm text-gray-600 whitespace-pre-line">{footnote}</div>
        </div>
      )}
    </div>
  )
} 