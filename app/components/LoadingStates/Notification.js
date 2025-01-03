import React, { useEffect } from 'react'

export default function Notification({ notification, onClose }) {
  useEffect(() => {
    if (notification?.duration) {
      const timer = setTimeout(() => {
        onClose()
      }, notification.duration)
      return () => clearTimeout(timer)
    }
  }, [notification, onClose])

  if (!notification) return null

  const bgColor = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700'
  }[notification.type] || 'bg-gray-100 border-gray-400 text-gray-700'

  return (
    <div className={`fixed top-4 right-4 px-4 py-3 rounded border ${bgColor} max-w-md z-50`}>
      <span className="block sm:inline">{notification.message}</span>
      <button 
        onClick={onClose}
        className="absolute top-0 bottom-0 right-0 px-4 py-3"
      >
        <span className="sr-only">Close</span>
        <svg className="h-6 w-6 fill-current" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
        </svg>
      </button>
    </div>
  )
} 