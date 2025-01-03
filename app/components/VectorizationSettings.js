'use client'
import { useState, useEffect } from 'react'
import { clientLocalStore } from '../lib/clientLocalStore'

export default function VectorizationSettings({ onSettingChange, setNotification }) {
  // Initialize with false, then update after mount
  const [useLocalStorage, setUseLocalStorage] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load preference from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('useLocalVectorization')
      const value = stored ? JSON.parse(stored) : false
      setUseLocalStorage(value)
      setIsInitialized(true)
    }
  }, [])

  const handleToggle = async () => {
    const newValue = !useLocalStorage
    
    if (newValue) {
      try {
        console.log('Switching to local storage...')
        await clientLocalStore.init()
        console.log('Local store ready')
      } catch (error) {
        console.error('Failed to initialize local store:', error)
        setNotification({
          type: 'error',
          message: 'Failed to initialize local storage'
        })
        return
      }
    }
    
    setUseLocalStorage(newValue)
    localStorage.setItem('useLocalVectorization', JSON.stringify(newValue))
    onSettingChange(newValue)
    
    const message = newValue 
      ? 'Switched to local storage. Using browser IndexedDB for vectors.'
      : 'Switched to cloud storage. Using Pinecone for vectors.'
      
    setNotification({
      type: 'info',
      message
    })
  }

  // Only render the toggle when initialized
  if (!isInitialized) {
    return null
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900">Local Vectorization</h3>
        <p className="text-xs text-gray-500">
          Store document vectors locally in your browser instead of the cloud
        </p>
      </div>
      
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          useLocalStorage ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span className="sr-only">Enable local storage</span>
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            useLocalStorage ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
} 