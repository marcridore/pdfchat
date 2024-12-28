'use client'
import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'

// Modal component
function Modal({ isOpen, onClose, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-lg shadow-xl w-[800px] max-h-[80vh] relative overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
}

// Main component
export default function TranslationsCarousel({ translations }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!translations.length) {
    return (
      <div className="text-center text-gray-500 p-4">
        No translations yet
      </div>
    )
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % translations.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + translations.length) % translations.length)
  }

  const exportToPDF = () => {
    setIsExporting(true)
    try {
      const doc = new jsPDF()
      const pageHeight = doc.internal.pageSize.height
      let cursorY = 20

      // Add title
      doc.setFontSize(16)
      doc.text('Translation History', 20, cursorY)
      cursorY += 10

      // Add timestamp
      doc.setFontSize(10)
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, cursorY)
      cursorY += 20

      // Add translations
      doc.setFontSize(12)
      translations.forEach((translation, index) => {
        // Check if we need a new page
        if (cursorY > pageHeight - 60) {
          doc.addPage()
          cursorY = 20
        }

        // Add translation number
        doc.setFont(undefined, 'bold')
        doc.text(`Translation ${index + 1} (Page ${translation.pageNumber})`, 20, cursorY)
        cursorY += 10

        // Add original text
        doc.setFont(undefined, 'normal')
        const originalLines = doc.splitTextToSize(`Original: ${translation.originalText}`, 170)
        doc.text(originalLines, 20, cursorY)
        cursorY += (originalLines.length * 7)

        // Check if we need a new page
        if (cursorY > pageHeight - 40) {
          doc.addPage()
          cursorY = 20
        }

        // Add translated text
        const translatedLines = doc.splitTextToSize(
          `${languageNames[translation.language]}: ${translation.translatedText}`, 
          170
        )
        doc.text(translatedLines, 20, cursorY)
        cursorY += (translatedLines.length * 7) + 15

        // Add timestamp
        doc.setFontSize(8)
        doc.text(`Translated on: ${new Date(translation.timestamp).toLocaleString()}`, 20, cursorY)
        doc.setFontSize(12)
        cursorY += 20

        // Add separator
        if (index < translations.length - 1) {
          doc.setDrawColor(200)
          doc.line(20, cursorY - 10, 190, cursorY - 10)
        }
      })

      // Save the PDF
      doc.save('translation-history.pdf')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF')
    } finally {
      setIsExporting(false)
    }
  }

  const current = translations[currentIndex]
  const languageNames = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
  }

  return (
    <div>
      {/* Summary view in sidebar */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">Translation History</h3>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded"
            >
              View Full History
            </button>
          </div>
        </div>

        {/* Show latest translation in sidebar */}
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-700">Latest Translation</h4>
            <p className="text-sm text-gray-500">Page {translations[translations.length - 1].pageNumber}</p>
            <p className="bg-gray-50 p-3 rounded border mt-1 text-sm">
              {translations[translations.length - 1].translatedText}
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Total translations: {translations.length}
          </div>
        </div>
      </div>

      {/* Full history modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Translation History</h2>
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className={`px-4 py-2 rounded transition-colors ${
                isExporting
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>

          <div className="relative">
            <button
              onClick={prevSlide}
              className="absolute left-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-30 text-white p-2 rounded-l"
              disabled={translations.length <= 1}
            >
              ←
            </button>

            <div className="px-12">
              <div className="space-y-6">
                <div className="text-center text-gray-500 mb-4">
                  {currentIndex + 1} of {translations.length}
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Original Text (Page {current.pageNumber})</h4>
                  <p className="bg-gray-50 p-4 rounded border mt-2">{current.originalText}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">
                    {languageNames[current.language]} Translation
                  </h4>
                  <p className="bg-gray-50 p-4 rounded border mt-2">{current.translatedText}</p>
                </div>
                <div className="text-sm text-gray-500">
                  Translated on: {new Date(current.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            <button
              onClick={nextSlide}
              className="absolute right-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-30 text-white p-2 rounded-r"
              disabled={translations.length <= 1}
            >
              →
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
} 