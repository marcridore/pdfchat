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
      description: 'Click and drag to select text, or click at the start and end of a paragraph to select it',
      position: { top: '40%', left: '50%' },
    },
    {
      id: 'tools',
      title: 'Smart Tools',
      description: 'Use the floating menu to translate, analyze, create footnotes, find similar passages, or get summaries',
      position: { top: '50%', left: '50%' },
    },
    {
      id: 'sidebar',
      title: 'Results Panel',
      description: 'View translations, analysis, footnotes, and search results in the right sidebar. You can resize it by dragging the left edge.',
      position: { top: '30%', right: '400px' },
      arrow: 'right'
    },
    {
      id: 'tabs',
      title: 'Navigation Tabs',
      description: 'Switch between current results, history, footnotes, and search using these tabs',
      position: { top: '80px', right: '300px' },
      arrow: 'right'
    },
    {
      id: 'qa',
      title: 'Quick Q&A',
      description: 'Click this button to ask specific questions about the current page',
      position: { bottom: '120px', right: '100px' },
      arrow: 'bottom-right'
    },
    {
      id: 'chat',
      title: 'Chat with PDF',
      description: 'Have a natural conversation about your document using the chat feature',
      position: { bottom: '60px', right: '100px' },
      arrow: 'bottom-right'
    }
  ]

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenPDFGuide')
    
    if (!hasSeenGuide) {
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

  const getArrowStyles = (arrowDirection) => {
    switch (arrowDirection) {
      case 'right':
        return {
          className: 'absolute -right-8 top-1/2 transform -translate-y-1/2 rotate-90',
          animate: { x: [0, 8, 0] }
        }
      case 'bottom-right':
        return {
          className: 'absolute -bottom-8 -right-8 transform rotate-45',
          animate: { x: [0, 5, 0], y: [0, 5, 0] }
        }
      default:
        return {
          className: 'absolute left-1/2 -bottom-8 transform -translate-x-1/2',
          animate: { y: [0, 8, 0] }
        }
    }
  }

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
            style={currentGuide.position}
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

            {/* Animated arrow */}
            <motion.div
              {...getArrowStyles(currentGuide.arrow)}
              animate={getArrowStyles(currentGuide.arrow).animate}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <svg 
                className="w-6 h-6 text-white drop-shadow-lg" 
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