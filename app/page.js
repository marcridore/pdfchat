'use client'
import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import TranslationsCarousel from './components/TranslationsCarousel'
import Tooltip from './components/Tooltip'

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
  const [footnoteText, setFootnoteText] = useState('')
  const [footnotePosition, setFootnotePosition] = useState({ x: 0, y: 0 })
  const [showFootnote, setShowFootnote] = useState(false)
  const [footnotesHistory, setFootnotesHistory] = useState({})
  const [footnoteCounter, setFootnoteCounter] = useState(1)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const textLayerRef = useRef(null)
  const pdfDocRef = useRef(null)
  const menuRef = useRef(null)

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

  // Add useEffect for click outside handling
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside)
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Add footnote handler
  const handleFootnote = (event) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    
    if (text) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const container = textLayerRef.current.getBoundingClientRect()

      setFootnotePosition({
        x: rect.left + rect.width / 2 - container.left,
        y: rect.bottom - container.top,
      })
      setFootnoteText(text)
      setShowFootnote(true)
    }
  }

  // Add footnote handler for the button
  const handleFootnoteButton = async () => {
    if (!selectedText) return
    
    setShowMenu(false)
    const range = window.getSelection().getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const container = textLayerRef.current.getBoundingClientRect()

    // Create marker element
    const marker = document.createElement('sup')
    marker.className = 'footnote-marker text-xs text-blue-500 cursor-pointer select-none'
    marker.textContent = `[${footnoteCounter}]`
    marker.style.position = 'absolute'
    marker.style.zIndex = '30'
    
    // Position the marker
    const markerPosition = {
      left: rect.right - container.left,
      top: rect.top - container.top,
    }
    
    marker.style.left = `${markerPosition.left}px`
    marker.style.top = `${markerPosition.top}px`
    
    // Add hover and click handlers
    marker.addEventListener('mouseenter', () => {
      setFootnotePosition({
        x: rect.left + rect.width / 2 - container.left,
        y: rect.bottom - container.top,
      })
      setFootnoteText(selectedText)
      setShowFootnote(true)
    })
    
    marker.addEventListener('mouseleave', () => {
      if (!showFootnote) return
      setShowFootnote(false)
    })

    // Add to text layer
    textLayerRef.current.appendChild(marker)

    // Store position data
    const position = {
      x: rect.left + rect.width / 2 - container.left,
      y: rect.bottom - container.top,
      absoluteTop: rect.top + window.scrollY,
      textLayerTop: container.top + window.scrollY,
      marker: {
        left: markerPosition.left,
        top: markerPosition.top,
      }
    }

    // Update footnotes history
    setFootnotesHistory(prev => ({
      ...prev,
      [selectedText]: {
        position,
        pageNumber: currentPage,
        timestamp: new Date().toISOString(),
        markerId: footnoteCounter
      }
    }))

    setFootnoteCounter(prev => prev + 1)
  }

  // Add function to restore markers when changing pages
  useEffect(() => {
    // Clear existing markers
    const existingMarkers = textLayerRef.current?.querySelectorAll('.footnote-marker')
    existingMarkers?.forEach(marker => marker.remove())

    // Restore markers for current page
    Object.entries(footnotesHistory).forEach(([text, data]) => {
      if (data.pageNumber === currentPage) {
        const marker = document.createElement('sup')
        marker.className = 'footnote-marker text-xs text-blue-500 cursor-pointer select-none'
        marker.textContent = `[${data.markerId}]`
        marker.style.position = 'absolute'
        marker.style.zIndex = '30'
        marker.style.left = `${data.position.marker.left}px`
        marker.style.top = `${data.position.marker.top}px`

        marker.addEventListener('mouseenter', () => {
          setFootnotePosition({
            x: data.position.x,
            y: data.position.y,
          })
          setFootnoteText(text)
          setShowFootnote(true)
        })

        marker.addEventListener('mouseleave', () => {
          if (!showFootnote) return
          setShowFootnote(false)
        })

        textLayerRef.current?.appendChild(marker)
      }
    })
  }, [currentPage, footnotesHistory])

  // Add scroll to reference function
  const scrollToReference = (text, data) => {
    // First ensure we're on the right page
    if (currentPage !== data.pageNumber) {
      setCurrentPage(data.pageNumber)
      // Wait for page render
      setTimeout(() => {
        window.scrollTo({
          top: data.position.absoluteTop - 100, // Offset for better visibility
          behavior: 'smooth'
        })
        // Highlight the reference temporarily
        highlightReference(text)
      }, 300) // Adjust timeout based on page render time
    } else {
      window.scrollTo({
        top: data.position.absoluteTop - 100,
        behavior: 'smooth'
      })
      highlightReference(text)
    }
  }

  // Add highlight function
  const highlightReference = (text) => {
    const textLayer = textLayerRef.current
    if (!textLayer) return

    // Create highlight overlay
    const highlight = document.createElement('div')
    highlight.className = 'absolute bg-yellow-200 bg-opacity-50 transition-opacity duration-1000'
    highlight.style.zIndex = '40'
    
    // Position the highlight
    const textNodes = Array.from(textLayer.childNodes)
    for (const node of textNodes) {
      if (node.textContent.includes(text)) {
        const rect = node.getBoundingClientRect()
        highlight.style.left = `${rect.left - textLayer.getBoundingClientRect().left}px`
        highlight.style.top = `${rect.top - textLayer.getBoundingClientRect().top}px`
        highlight.style.width = `${rect.width}px`
        highlight.style.height = `${rect.height}px`
        textLayer.appendChild(highlight)
        
        // Fade out and remove after animation
        setTimeout(() => {
          highlight.style.opacity = '0'
          setTimeout(() => highlight.remove(), 1000)
        }, 2000)
        break
      }
    }
  }

  // Update the text layer to show stored footnotes on hover
  const handleTextHover = (event) => {
    const selection = window.getSelection()
    const text = selection.toString().trim()
    
    if (text && footnotesHistory[text]) {
      setFootnotePosition(footnotesHistory[text].position)
      setFootnoteText(text)
      setShowFootnote(true)
    }
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
                onMouseMove={handleTextHover}
                onMouseLeave={() => setShowFootnote(false)}
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
                  ref={menuRef}
                  className="absolute bg-white shadow-lg rounded-lg p-2 z-50 transform -translate-x-1/2"
                  style={{
                    left: menuPosition.x,
                    top: menuPosition.y - 40,
                  }}
                >
                  <div className="flex gap-2">
                    <button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className={`px-3 py-1 text-sm rounded flex items-center gap-2 ${
                        isTranslating
                          ? 'bg-blue-300 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isTranslating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Translating...</span>
                        </>
                      ) : (
                        'Translate'
                      )}
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className={`px-3 py-1 text-sm rounded flex items-center gap-2 ${
                        isAnalyzing
                          ? 'bg-green-300 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        'Analyze'
                      )}
                    </button>
                    <button
                      onClick={handleFootnoteButton}
                      className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Footnote
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
            <button
              onClick={() => setActiveTab('footnotes')}
              className={`px-4 py-2 ${
                activeTab === 'footnotes'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Footnotes
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

          {/* Add footnotes content */}
          {activeTab === 'footnotes' && (
            <div className="space-y-4">
              <h3 className="font-bold text-gray-700">Saved Footnotes</h3>
              {Object.entries(footnotesHistory)
                .sort((a, b) => a[1].markerId - b[1].markerId)
                .map(([text, data]) => (
                  <div key={text} className="border-b pb-4">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <span className="text-blue-500">[{data.markerId}]</span>
                        Page {data.pageNumber}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(data.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{text}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setFootnotePosition(data.position)
                          setFootnoteText(text)
                          setShowFootnote(true)
                        }}
                        className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                      >
                        Show Footnote
                      </button>
                      <button
                        onClick={() => scrollToReference(text, data)}
                        className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        Jump to Reference
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Tooltip */}
      {showFootnote && (
        <Tooltip
          text={footnoteText}
          position={footnotePosition}
          onClose={() => setShowFootnote(false)}
        />
      )}
    </main>
  )
}
