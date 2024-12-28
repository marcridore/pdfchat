'use client'
import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import TranslationsCarousel from './components/TranslationsCarousel'

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export default function Home() {
  const [pdfFile, setPdfFile] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)
  const [selectedText, setSelectedText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [isTranslating, setIsTranslating] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState('')
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false)
  const [imageAnalysis, setImageAnalysis] = useState('')
  const [translationHistory, setTranslationHistory] = useState([])
  const [activeTab, setActiveTab] = useState('current')
  
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const textLayerRef = useRef(null)
  const pdfDocRef = useRef(null)

  // Load PDF document
  const loadPDF = async (file) => {
    try {
      // Clean up previous PDF and canvas
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
      cleanupCanvas()
      resetOutputs() // Reset any previous outputs

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      pdfDocRef.current = pdf
      setNumPages(pdf.numPages)
      setCurrentPage(1)
      renderPage(1)
    } catch (error) {
      console.error('Error loading PDF:', error)
    }
  }

  // Add a cleanup function
  const cleanupCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const context = canvas.getContext('2d')
      // Clear the entire canvas
      context.clearRect(0, 0, canvas.width, canvas.height)
      // Reset canvas dimensions
      canvas.width = 0
      canvas.height = 0
    }
    if (textLayerRef.current) {
      textLayerRef.current.innerHTML = ''
    }
  }

  // Update renderPage function
  const renderPage = async (pageNumber) => {
    if (!pdfDocRef.current) return

    try {
      // Ensure previous operations are cleaned up
      cleanupCanvas()

      const page = await pdfDocRef.current.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      // Set canvas dimensions
      canvas.height = viewport.height
      canvas.width = viewport.width

      // Create a new render task
      const renderTask = page.render({
        canvasContext: context,
        viewport,
      })

      // Wait for render to complete
      await renderTask.promise

      // Setup text layer
      const textContent = await page.getTextContent()
      const textLayer = textLayerRef.current
      if (textLayer) {
        textLayer.style.height = `${viewport.height}px`
        textLayer.style.width = `${viewport.width}px`
        textLayer.innerHTML = ''

        // Create text layer
        const textDivs = []
        pdfjsLib.renderTextLayer({
          textContent,
          container: textLayer,
          viewport,
          textDivs,
          enhanceTextSelection: true,
        })

        // Add padding to text elements
        setTimeout(() => {
          const spans = textLayer.getElementsByTagName('span')
          for (const span of spans) {
            span.style.padding = '3px 0'
            span.style.lineHeight = '1.25'
          }
        }, 100)
      }
    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'application/pdf') {
      // Clear previous states
      setPdfFile(null)
      setNumPages(0)
      setCurrentPage(1)
      setScale(1.5)
      setSelectedText('')
      setShowMenu(false)
      
      // Load new PDF
      setPdfFile(file)
      loadPDF(file)
    }
  }

  // Handle text selection
  const handleTextSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection()
      const text = selection.toString().trim()
      
      if (text) {
        resetOutputs()
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const container = textLayerRef.current.getBoundingClientRect()
        const viewerContainer = textLayerRef.current.parentElement

        // Calculate position relative to the viewer
        const x = rect.left + rect.width / 2 - container.left
        const y = rect.top - container.top

        setMenuPosition({
          x,
          y,
        })
        setSelectedText(text)
        setShowMenu(true)
      }
    }, 10)
  }

  // Add new function to reset outputs
  const resetOutputs = () => {
    setTranslatedText('')
    setAnalysis('')
    setImageAnalysis('')
  }

  // Handle translation
  const handleTranslate = async () => {
    if (!selectedText) return
    
    setIsTranslating(true)
    resetOutputs()
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedText,
          targetLanguage,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setTranslatedText(data.translatedText)
      
      // Add to history
      setTranslationHistory(prev => [...prev, {
        originalText: selectedText,
        translatedText: data.translatedText,
        language: targetLanguage,
        pageNumber: currentPage,
        timestamp: new Date().toISOString(),
      }])
    } catch (error) {
      console.error('Translation error:', error)
      setTranslatedText('Error translating text')
    } finally {
      setIsTranslating(false)
      setShowMenu(false)
    }
  }

  // Add analyze function
  const handleAnalyze = async () => {
    if (!selectedText) return
    
    setIsAnalyzing(true)
    resetOutputs()
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedText,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setAnalysis(data.analysis)
    } catch (error) {
      console.error('Analysis error:', error)
      setAnalysis('Error analyzing text')
    } finally {
      setIsAnalyzing(false)
      setShowMenu(false)
    }
  }

  // Add screenshot and analysis handler
  const handleScreenshotAnalysis = async () => {
    try {
      setIsAnalyzingImage(true)
      resetOutputs()
      
      // Create a canvas to capture the current view
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const pdfCanvas = canvasRef.current
      const textLayer = textLayerRef.current
      
      // Match screenshot canvas size to PDF canvas
      canvas.width = pdfCanvas.width
      canvas.height = pdfCanvas.height

      // Draw PDF canvas
      context.drawImage(pdfCanvas, 0, 0)

      // Convert to base64
      const imageData = canvas.toDataURL('image/png')

      // Send to API
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setImageAnalysis(data.analysis)
    } catch (error) {
      console.error('Screenshot analysis error:', error)
      setImageAnalysis('Error analyzing screenshot')
    } finally {
      setIsAnalyzingImage(false)
    }
  }

  // Navigation handlers
  const nextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCanvas()
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
    }
  }, [])

  // Update page rendering effect
  useEffect(() => {
    if (currentPage && scale) {
      renderPage(currentPage)
    }
    return () => {
      cleanupCanvas()
    }
  }, [currentPage, scale])

  // Update the language change handler
  const handleLanguageChange = (e) => {
    setTargetLanguage(e.target.value)
    // Clear previous translation when language changes
    setTranslatedText('')
  }

  return (
    <main className="min-h-screen flex">
      {/* Main content area */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">PDF Reader with Translation</h1>
          
          {/* Controls */}
          <div className="flex gap-4 mb-6">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Upload PDF
            </button>
            
            <select
              value={targetLanguage}
              onChange={handleLanguageChange}
              className="border rounded p-2"
            >
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={currentPage <= 1}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={nextPage}
                disabled={currentPage >= numPages}
                className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="border rounded p-2"
            >
              <option value={1}>100%</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
              <option value={2.5}>250%</option>
            </select>

            <button
              onClick={handleScreenshotAnalysis}
              disabled={isAnalyzingImage}
              className={`px-4 py-2 rounded transition-colors ${
                isAnalyzingImage 
                ? 'bg-purple-300 cursor-not-allowed' 
                : 'bg-purple-500 hover:bg-purple-600'
              } text-white`}
            >
              {isAnalyzingImage ? 'Analyzing...' : 'Analyze Current View'}
            </button>
          </div>

          {/* PDF Viewer */}
          <div className="border rounded p-4 bg-gray-100 relative">
            <div className="relative mx-auto" style={{ width: 'fit-content' }}>
              <canvas ref={canvasRef} />
              <div
                ref={textLayerRef}
                className="absolute top-0 left-0 right-0 bottom-0 textLayer"
                style={{
                  pointerEvents: 'none',
                }}
                onMouseUp={handleTextSelection}
              />
              
              {/* Loading Overlay */}
              {isAnalyzingImage && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-4 flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mb-2"></div>
                    <p className="text-sm text-gray-600">Analyzing current view...</p>
                  </div>
                </div>
              )}
              
              {/* Selection Menu */}
              {showMenu && (
                <div
                  className="absolute bg-white shadow-lg rounded-lg p-2 z-50 transform -translate-x-1/2"
                  style={{
                    left: menuPosition.x,
                    top: menuPosition.y - 40,
                  }}
                >
                  <div className="flex gap-2">
                    <button
                      onClick={handleTranslate}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      Translate
                    </button>
                    <button
                      onClick={handleAnalyze}
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Analyze
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="w-96 border-l bg-white p-4 h-screen sticky top-0 overflow-y-auto">
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 ${
                activeTab === 'current'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Current
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 ${
                activeTab === 'history'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              History
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'current' ? (
            // Current translation content
            <div className="space-y-6">
              {/* Translation Settings */}
              <div className="mb-4">
                <h2 className="text-lg font-bold mb-2">Translation Settings</h2>
                <select
                  value={targetLanguage}
                  onChange={handleLanguageChange}
                  className="w-full border rounded p-2"
                >
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                </select>
              </div>

              {/* Selected Text */}
              {selectedText && (
                <div className="border-b pb-4">
                  <h3 className="font-bold text-gray-700">Selected Text:</h3>
                  <p className="p-2 bg-gray-50 rounded border mt-1">{selectedText}</p>
                </div>
              )}

              {/* Translation Results */}
              {selectedText && (
                <div className="border-b pb-4">
                  <h3 className="font-bold text-gray-700">Translation:</h3>
                  {isTranslating ? (
                    <div className="p-2 bg-gray-50 rounded border mt-1">
                      <p className="text-gray-600">Translating...</p>
                    </div>
                  ) : (
                    translatedText && (
                      <p className="p-2 bg-gray-50 rounded border mt-1">{translatedText}</p>
                    )
                  )}
                </div>
              )}

              {/* Analysis Results */}
              {selectedText && (
                <div>
                  <h3 className="font-bold text-gray-700">Analysis:</h3>
                  {isAnalyzing ? (
                    <div className="p-2 bg-gray-50 rounded border mt-1">
                      <p className="text-gray-600">Analyzing...</p>
                    </div>
                  ) : (
                    analysis && (
                      <div className="p-2 bg-gray-50 rounded border mt-1 prose prose-sm">
                        <p className="whitespace-pre-line">{analysis}</p>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Image Analysis Results */}
              {imageAnalysis && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-bold text-gray-700">Page Analysis:</h3>
                  {isAnalyzingImage ? (
                    <div className="p-2 bg-gray-50 rounded border mt-1">
                      <p className="text-gray-600">Analyzing current view...</p>
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded border mt-1 prose prose-sm">
                      <p className="whitespace-pre-line">{imageAnalysis}</p>
                    </div>
                  )}
                </div>
              )}

              {!selectedText && (
                <div className="text-gray-500 text-center mt-8">
                  Select text from the PDF to see translation and analysis
                </div>
              )}
            </div>
          ) : (
            // Translation history
            <TranslationsCarousel translations={translationHistory} />
          )}
        </div>
      </div>
    </main>
  )
}
