'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function SelectionMenu({
  menuRef,
  menuPosition,
  handleTranslate,
  isTranslating,
  handleAnalyze,
  isAnalyzing,
  handleFootnoteButton,
  handleSimilaritySearch,
  isSearchingSimilar,
  handleSummarize,
  isSummarizing
}) {
  const [showTooltip, setShowTooltip] = useState('')
  const [menuOrientation, setMenuOrientation] = useState('bottom')

  // Determine menu position and orientation
  useEffect(() => {
    const handleMenuPosition = () => {
      if (menuRef.current) {
        const rect = menuRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setMenuOrientation(spaceBelow < 100 && spaceAbove > 100 ? 'top' : 'bottom')
      }
    }
    handleMenuPosition()
  }, [menuPosition])

  const menuItems = [
    {
      id: 'translate',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" 
          />
        </svg>
      ),
      label: 'Translate',
      action: handleTranslate,
      loading: isTranslating,
      color: 'blue'
    },
    {
      id: 'analyze',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
          />
        </svg>
      ),
      label: 'Analyze',
      action: handleAnalyze,
      loading: isAnalyzing,
      color: 'green'
    },
    {
      id: 'footnote',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
      ),
      label: 'Add Footnote',
      action: handleFootnoteButton,
      color: 'yellow'
    },
    {
      id: 'similar',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
      ),
      label: 'Find Similar',
      action: handleSimilaritySearch,
      loading: isSearchingSimilar,
      color: 'purple'
    },
    {
      id: 'summarize',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M4 6h16M4 12h16M4 18h7" 
          />
        </svg>
      ),
      label: 'Summarize',
      action: handleSummarize,
      loading: isSummarizing,
      color: 'orange'
    }
  ]

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`fixed z-50 flex backdrop-blur-sm bg-white/80 shadow-lg rounded-full p-1.5 gap-1
          ${menuOrientation === 'top' ? '-translate-y-full' : 'translate-y-2'}`}
        style={{
          left: menuPosition.x,
          top: menuPosition.y,
        }}
      >
        {menuItems.map((item) => (
          <div key={item.id} className="relative">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onMouseEnter={() => setShowTooltip(item.id)}
              onMouseLeave={() => setShowTooltip('')}
              onClick={item.action}
              disabled={item.loading}
              className={`p-2 rounded-full transition-colors relative
                ${item.loading 
                  ? `bg-${item.color}-100 cursor-not-allowed` 
                  : `bg-${item.color}-500 hover:bg-${item.color}-600 text-white hover:shadow-lg`
                }
                disabled:opacity-50 group`}
            >
              {item.loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                item.icon
              )}
              
              {/* Tooltip */}
              <AnimatePresence>
                {showTooltip === item.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className={`absolute ${
                      menuOrientation === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                    } left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium text-white 
                    bg-gray-900 rounded whitespace-nowrap`}
                  >
                    {item.label}
                    <div 
                      className={`absolute left-1/2 -translate-x-1/2 ${
                        menuOrientation === 'top' ? 'bottom-[-4px]' : 'top-[-4px]'
                      } border-4 border-transparent ${
                        menuOrientation === 'top' ? 'border-t-gray-900' : 'border-b-gray-900'
                      }`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  )
} 