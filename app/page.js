'use client'
import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import TranslationsCarousel from './components/TranslationsCarousel'
import Tooltip from './components/Tooltip'
import ChatModal from './components/ChatModal'
import { 
  storePageEmbeddings, 
  storeDocumentEmbeddings 
} from './lib/embeddings'
import DocumentQA from './components/DocumentQnA'

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export default function Home() {
  const [documents, setDocuments] = useState([])
  const [currentDocument, setCurrentDocument] = useState(null)
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
  const [similarPassages, setSimilarPassages] = useState([])
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false)
  const [isStoringEmbeddings, setIsStoringEmbeddings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [processedPagesMap, setProcessedPagesMap] = useState({})
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summary, setSummary] = useState('')
  const [isProcessingDocument, setIsProcessingDocument] = useState(false)
  const [processedDocuments, setProcessedDocuments] = useState({})
  const [notification, setNotification] = useState(null)
  const [isQAOpen, setIsQAOpen] = useState(false)
  const [currentPageContent, setCurrentPageContent] = useState('')

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const textLayerRef = useRef(null)
  const pdfDocRef = useRef(null)
  const menuRef = useRef(null)

  // Add useEffect to load from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('processedDocuments')
      if (saved) {
        setProcessedDocuments(JSON.parse(saved))
      }
    } catch (error) {
      console.error('Error loading processed documents:', error)
    }
  }, []) // Empty dependency array means this runs once after mount

  // Load PDF document
  const loadPDF = async (file, doc = null) => {
    const activeDoc = doc || currentDocument

    try {
      if (!file) {
        console.log('No file available:', {
          docName: activeDoc?.name,
          docId: activeDoc?.id
        })
        return
      }

      // Check if document exists via API
      const checkResponse = await fetch('/api/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkDocumentOnly: true,
          metadata: {
            pdfName: activeDoc.name
          }
        })
      })

      const { exists, pageCount, firstUploadedAt } = await checkResponse.json()

      if (exists) {
        console.log('Document already exists in Pinecone:', {
          pdfName: activeDoc.name,
          pageCount,
          firstUploadedAt: new Date(firstUploadedAt).toLocaleString()
        })

        // Add notification
        setNotification({
          type: 'info',
          message: `Document "${activeDoc.name}" already exists with ${pageCount} pages. First uploaded on ${new Date(firstUploadedAt).toLocaleString()}`
        })

        // Still render the document but skip processing
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
        setCurrentPage(1)
        renderPage(1, activeDoc)
        return
      }

      console.log('Loading new PDF for processing:', {
        fileName: file.name,
        isNewDocument: activeDoc?.isNewDocument,
        documentId: activeDoc?.id
      })

      // Clean up previous PDF and canvas
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
      cleanupCanvas()
      resetOutputs()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      pdfDocRef.current = pdf
      setNumPages(pdf.numPages)
      setCurrentPage(1)

      // Process all pages in background
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        await processPage(page, activeDoc)
        console.log(`Processed page ${pageNum} in background`)
      }

      // Still render the first page for viewing
      renderPage(1, activeDoc)
    } catch (error) {
      console.error('Error loading PDF:', error)
      setNotification({
        type: 'error',
        message: 'Error loading PDF: ' + error.message
      })
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
  const renderPage = async (pageNumber, doc = null) => {
    if (!pdfDocRef.current) {
      console.log('No PDF document loaded')
      return
    }

    try {
      const page = await pdfDocRef.current.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
      
      // Update text layer
      const textContent = await page.getTextContent()
      const textLayer = textLayerRef.current
      
      textLayer.innerHTML = ''
      textLayer.style.height = `${viewport.height}px`
      textLayer.style.width = `${viewport.width}px`
      
      pdfjsLib.renderTextLayer({
        textContent: textContent,
        container: textLayer,
        viewport: viewport,
        textDivs: []
      })

      // After getting text content, update currentPageContent
      const pageText = textContent.items.map(item => item.str).join(' ')
      setCurrentPageContent(pageText)

    } catch (error) {
      console.error('Error rendering page:', error)
    }
  }

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'application/pdf') {
      console.log('Uploading new document:', {
        fileName: file.name,
        timestamp: Date.now()
      })

      // Create new document object
      const newDoc = {
        id: Date.now(),
        name: file.name,
        currentPage: 1,
        scale: 1.5,
        footnotesHistory: {},
        footnoteCounter: 1,
        isNewDocument: true,
        file: file
      }

      // Update state
      const updatedDocuments = [...documents, newDoc]
      setDocuments(updatedDocuments)
      
      // Store document metadata in localStorage
      const docForStorage = { ...newDoc }
      delete docForStorage.file
      localStorage.setItem('pdfDocuments', JSON.stringify(updatedDocuments.map(d => {
        const docCopy = { ...d }
        delete docCopy.file
        return docCopy
      })))

      setCurrentDocument(newDoc)
      setPdfFile(file)
      
      // Process the PDF
      await loadPDF(file, newDoc)
    }
  }

  // Add handler for switching documents
  const handleDocumentSwitch = (docId) => {
    console.log('Switching document:', {
      fromId: currentDocument?.id,
      toId: docId
    })

    const doc = documents.find(d => d.id === docId)
    if (doc) {
      doc.isNewDocument = false
      // Ensure document has an entry in processedPagesMap
      if (!processedPagesMap[doc.id]) {
        setProcessedPagesMap(prev => ({
          ...prev,
          [doc.id]: new Set()
        }))
      }
      
      console.log('Switched to document:', {
        id: doc.id,
        name: doc.name,
        isNewDocument: doc.isNewDocument,
        hasFile: !!doc.file
      })

      setCurrentDocument(doc)
      if (doc.file) {
        setPdfFile(doc.file)
        loadPDF(doc.file, doc)
      } else {
        setPdfFile(null)
        cleanupCanvas()
        console.log('No file available for document:', doc.name)
      }
      setCurrentPage(doc.currentPage)
      setScale(doc.scale)
      setFootnotesHistory(doc.footnotesHistory)
      setFootnoteCounter(doc.footnoteCounter)
    }
  }

  // Update document state when relevant properties change
  useEffect(() => {
    if (currentDocument) {
      const updatedDocuments = documents.map(doc => {
        if (doc.id === currentDocument.id) {
          return {
            ...doc,
            currentPage,
            scale,
            footnotesHistory,
            footnoteCounter,
            file: doc.file // Preserve the file
          }
        }
        return doc
      })
      setDocuments(updatedDocuments)
      
      // Store document metadata in localStorage (without the file)
      localStorage.setItem('pdfDocuments', JSON.stringify(updatedDocuments.map(d => {
        const docCopy = { ...d }
        delete docCopy.file
        return docCopy
      })))
    }
  }, [currentPage, scale, footnotesHistory, footnoteCounter])

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
    setSummary('')
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
      // console.error('Translation error:', error)
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
      // console.error('Analysis error:', error)
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
      // console.error('Screenshot analysis error:', error)
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

  // Add handler for similarity search
  const handleSimilaritySearch = async () => {
    if (!selectedText) return
    
    setIsSearchingSimilar(true)
    try {
      const response = await fetch('/api/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedText,
        }),
      })

      if (!response.ok) throw new Error('Failed to search similar passages')

      const { similar } = await response.json()
      setSimilarPassages(similar)
    } catch (error) {
      // console.error('Similar search error:', error)
    } finally {
      setIsSearchingSimilar(false)
      setShowMenu(false)
    }
  }

  // Add handler for manual similarity search
  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearchingSimilar(true)
    try {
      const response = await fetch('/api/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: searchQuery,
        }),
      })

      if (!response.ok) throw new Error('Failed to search similar passages')

      const { similar } = await response.json()
      setSimilarPassages(similar)
    } catch (error) {
      // console.error('Similar search error:', error)
    } finally {
      setIsSearchingSimilar(false)
    }
  }

  // Add chat handler
  const handleChat = async () => {
    if (!chatInput.trim()) return
    
    setIsChatLoading(true)
    const userMessage = chatInput.trim()
    setChatInput('')
    
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }])
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage
        }),
      })

      if (!response.ok) throw new Error('Failed to get chat response')

      const { answer, context } = await response.json()
      
      // Add assistant message with context to chat history
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: answer,
        context: context
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question.'
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Update processPage function
  const processPage = async (page, doc) => {
    try {
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      
      console.log('Processing page:', {
        pageNumber: page._pageIndex + 1,
        documentId: doc.id,
        textLength: pageText.length
      })

      // Use the API endpoint for both checking and storing
      const response = await fetch('/api/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: pageText,
          metadata: {
            documentId: doc.id,
            pageNumber: page._pageIndex + 1,
            pdfName: doc.name
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to process page')
      }

      const result = await response.json()
      
      if (result.exists) {
        console.log('Page already exists:', {
          documentId: doc.id,
          pageNumber: page._pageIndex + 1
        })
      } else {
        console.log('Page processed successfully:', {
          documentId: doc.id,
          pageNumber: page._pageIndex + 1
        })
      }

    } catch (error) {
      console.error('Error processing page:', {
        pageNumber: page._pageIndex + 1,
        error: error.message
      })
      throw error
    }
  }

  // Add summarize function
  const handleSummarize = async () => {
    if (!selectedText) return
    
    setIsSummarizing(true)
    resetOutputs()
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: selectedText,
        }),
      })

      if (!response.ok) throw new Error('Failed to get summary')

      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error('Summary error:', error)
      setSummary('Error creating summary')
    } finally {
      setIsSummarizing(false)
      setShowMenu(false)
    }
  }

  // Update useEffect that loads from localStorage
  useEffect(() => {
    try {
      // Clear documents from localStorage on page load/refresh
      localStorage.removeItem('pdfDocuments')
      setDocuments([]) // Clear documents state
      console.log('Cleared documents list on page refresh')
    } catch (error) {
      console.error('Error clearing documents:', error)
    }
  }, [])

  // Add cleanup function for document processing state
  const clearProcessedDocuments = () => {
    if (typeof window !== 'undefined') {
      setProcessedDocuments({})
      localStorage.removeItem('processedDocuments')
      console.log('Cleared processed documents state')
    }
  }

  return (
    <main className="flex min-h-screen">
      {notification && (
        <div 
          className={`fixed top-4 right-4 p-4 rounded shadow-lg z-50 flex items-center ${
            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          } text-white max-w-md`}
          style={{ transform: 'translateX(0)' }}
        >
          <span className="flex-1 mr-2">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 text-white hover:text-gray-200 p-1 rounded-full hover:bg-black/10 flex items-center justify-center"
            aria-label="Close notification"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>
      )}
      <div className="flex-1 p-4 relative">
        {/* PDF Upload and Document Selection Section */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Upload PDF
            </button>

            {/* Add document selector dropdown */}
            {documents.length > 0 && (
              <select
                value={currentDocument?.id || ''}
                onChange={(e) => handleDocumentSwitch(Number(e.target.value))}
                className="border rounded p-2"
              >
                {documents.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            )}

            {/* Show chat button always */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Chat with PDF
            </button>

            {/* Add this near your document selector dropdown */}
            {documents.length > 0 && !pdfFile && (
              <div className="text-sm text-gray-600">
                Please re-upload the PDF to view its contents
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
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
                  <button
                    onClick={handleSimilaritySearch}
                    disabled={isSearchingSimilar}
                    className={`px-3 py-1 text-sm rounded flex items-center gap-2 ${
                      isSearchingSimilar
                        ? 'bg-purple-300 cursor-not-allowed'
                        : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  >
                    {isSearchingSimilar ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Searching...</span>
                      </>
                    ) : (
                      'Find Similar'
                    )}
                  </button>
                  <button
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                    className={`px-3 py-1 text-sm rounded flex items-center gap-2 ${
                      isSummarizing
                        ? 'bg-orange-300 cursor-not-allowed'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {isSummarizing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Summarizing...</span>
                      </>
                    ) : (
                      'Summarize'
                    )}
                  </button>
                </div>
              </div>
            )}
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
            <button
              onClick={() => setActiveTab('similar')}
              className={`px-4 py-2 ${
                activeTab === 'similar'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 ${
                activeTab === 'chat'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              Chat
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

              {/* Summary Results */}
              {selectedText && (
                <div>
                  <h3 className="font-bold text-gray-700">Summary:</h3>
                  {isSummarizing ? (
                    <div className="p-2 bg-gray-50 rounded border mt-1">
                      <p className="text-gray-600">Creating summary...</p>
                    </div>
                  ) : (
                    summary && (
                      <div className="p-2 bg-gray-50 rounded border mt-1 prose prose-sm">
                        <p className="whitespace-pre-line">{summary}</p>
                      </div>
                    )
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

          {/* Add similar search tab content */}
          {activeTab === 'similar' && (
            <div className="p-4">
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-2">Search Similar Passages</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter text to search..."
                    className="flex-1 border rounded p-2"
                  />
                  <button
                    onClick={handleManualSearch}
                    disabled={isSearchingSimilar || !searchQuery.trim()}
                    className={`px-4 py-2 rounded flex items-center gap-2 ${
                      isSearchingSimilar || !searchQuery.trim()
                        ? 'bg-blue-300 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isSearchingSimilar ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Searching...</span>
                      </>
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </div>
              
              {similarPassages.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-700">Similar Passages Found:</h3>
                  {similarPassages.map((match, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded border">
                      <div className="text-xs text-gray-500 mb-1">
                        Page {match.metadata.pageNumber} - {match.metadata.pdfName}
                      </div>
                      <p className="text-sm text-gray-600">{match.metadata.text}</p>
                      <div className="text-xs text-gray-400 mt-1">
                        Similarity: {(match.score * 100).toFixed(1)}%
                      </div>
                      <button
                        onClick={() => setCurrentPage(match.metadata.pageNumber)}
                        className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                      >
                        Go to Page
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center">
                  {searchQuery.trim() ? 'No similar passages found.' : 'Enter text to search for similar passages.'}
                </div>
              )}
            </div>
          )}

          {/* Add chat tab content */}
          {activeTab === 'chat' && (
            <div className="p-4">
              <div className="mb-4">
                <h2 className="text-lg font-bold mb-2">Chat with PDF</h2>
                <div className="space-y-4 mb-4 max-h-[500px] overflow-y-auto">
                  {chatHistory.map((message, index) => (
                    <div
                      key={index}
                      className={`flex flex-col ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`rounded-lg p-3 max-w-[80%] ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.context && (
                        <div className="mt-2 text-xs text-gray-500">
                          <p className="font-semibold">Based on these passages:</p>
                          {message.context.map((ctx, i) => (
                            <div key={i} className="mt-1 p-2 bg-gray-50 rounded">
                              <p>{ctx.metadata.text}</p>
                              <p className="mt-1 text-gray-400">
                                Page {ctx.metadata.pageNumber} - 
                                Similarity: {(ctx.score * 100).toFixed(1)}%
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                    placeholder="Ask a question about the PDF..."
                    className="flex-1 border rounded p-2"
                    disabled={isChatLoading}
                  />
                  <button
                    onClick={handleChat}
                    disabled={isChatLoading || !chatInput.trim()}
                    className={`px-4 py-2 rounded flex items-center gap-2 ${
                      isChatLoading || !chatInput.trim()
                        ? 'bg-blue-300 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isChatLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Thinking...</span>
                      </>
                    ) : (
                      'Send'
                    )}
                  </button>
                </div>
              </div>
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

      {/* Add loading indicator to the UI */}
      {isStoringEmbeddings && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Creating embeddings...</span>
        </div>
      )}

      {/* Add chat button */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        pdfName={currentDocument?.name || ''}
        chatHistory={chatHistory}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleChat={handleChat}
        isChatLoading={isChatLoading}
      />

      {/* Add loading indicator for document processing */}
      {isProcessingDocument && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Processing document...</span>
        </div>
      )}

      {/* Add Q&A and Chat buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        {/* Q&A Button */}
        <button
          onClick={() => setIsQAOpen(true)}
          className="bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600"
          title="Open Q&A"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </button>

        {/* Existing Chat Button */}
        <button
          onClick={() => setIsChatOpen(true)}
          className="bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600"
          title="Open Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
            />
          </svg>
        </button>
      </div>

      {/* Chat Modal */}
      <ChatModal 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        pdfName={currentDocument?.name || ''}
        chatHistory={chatHistory}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleChat={handleChat}
        isChatLoading={isChatLoading}
      />

      {/* Add loading indicator for document processing */}
      {isProcessingDocument && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Processing document...</span>
        </div>
      )}

      {/* Add DocumentQA component */}
      <DocumentQA 
        isOpen={isQAOpen}
        onClose={() => setIsQAOpen(false)}
        pageContent={currentPageContent}
        documentName={currentDocument?.name || ''}
        currentPage={currentPage}
        pdfDoc={pdfDocRef.current}
      />
    </main>
  )
}
