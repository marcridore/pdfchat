'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function UserGuide() {
  const [showGuide, setShowGuide] = useState(false)
  const [step, setStep] = useState(0)

  const guides = [
    {
      id: 'select',
      title: 'Select Text',
      description: 'Click and drag to select text, or click at the start and end of a paragraph',
      position: { top: '40%', left: '50%' },
    },
    {
      id: 'tools',
      title: 'Smart Tools',
      description: 'Use the floating menu to translate, analyze, or create footnotes',
      position: { top: '50%', left: '50%' },
    }
  ]

  useEffect(() => {
    // Check if user has seen the guide before
    const hasSeenGuide = localStorage.getItem('hasSeenPDFGuide')
    
    if (!hasSeenGuide) {
      // Show guide after a short delay
      const timer = setTimeout(() => {
        setShowGuide(true)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = () => {
    setShowGuide(false)
    localStorage.setItem('hasSeenPDFGuide', 'true')
  }

  const currentGuide = guides[step]

  return (
    <AnimatePresence>
      {showGuide && currentGuide && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={handleDismiss}
          />

          {/* Guide Tooltip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-50 bg-white rounded-xl shadow-xl p-4 max-w-sm"
            style={{
              ...currentGuide.position,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">
                  {currentGuide.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {currentGuide.description}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-500 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {guides.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === step ? 'bg-blue-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Previous
                  </button>
                )}
                {step < guides.length - 1 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>

            {/* Animated arrow pointing to selection area */}
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute left-1/2 -bottom-8 transform -translate-x-1/2"
            >
              <svg 
                className="w-6 h-6 text-white" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M12 2L6 8h12l-6-6z" />
              </svg>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
} 