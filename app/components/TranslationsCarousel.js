'use client'
import { useState } from 'react'

export default function TranslationsCarousel({ translations }) {
  const [currentIndex, setCurrentIndex] = useState(0)

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

  const current = translations[currentIndex]
  const languageNames = {
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Translation History</h3>
        <div className="text-sm text-gray-500">
          {currentIndex + 1} of {translations.length}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={prevSlide}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-black bg-opacity-30 text-white p-2 rounded-l"
          disabled={translations.length <= 1}
        >
          ←
        </button>

        <div className="px-10">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">Original Text (Page {current.pageNumber})</h4>
              <p className="bg-gray-50 p-3 rounded border mt-1">{current.originalText}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">
                {languageNames[current.language]} Translation
              </h4>
              <p className="bg-gray-50 p-3 rounded border mt-1">{current.translatedText}</p>
            </div>
            <div className="text-xs text-gray-500">
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
  )
} 