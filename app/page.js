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

    const userMessage = { role: 'user', content: chatInput }
    
    // Update chat immediately with user message
    setChatHistory(prev => [...prev, userMessage])
    setChatInput('')
    setIsChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: chatInput,
          documentName: currentDocument?.name
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        // Create the assistant message with both response and context
        const assistantMessage = {
          role: 'assistant',
          content: data.response,    // This is the LLM's response text
          context: data.context      // This is the reference material
        }
        
        // Add the complete message to chat history
        setChatHistory(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.'
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
    <main className="flex min-h-screen bg-gray-50">
      {/* Notification Toast */}
      {notification && (
        <div 
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl z-50 flex items-center backdrop-blur-sm ${
            notification.type === 'error' ? 'bg-red-500/90' : 'bg-blue-500/90'
          } text-white max-w-md transform transition-all duration-300 ease-out`}
        >
          <span className="flex-1 mr-2">{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            className="ml-2 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-6 relative">
        {/* Header Section */}
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Upload PDF
          </button>

          {documents.length > 0 && (
            <select
              value={currentDocument?.id || ''}
              onChange={(e) => handleDocumentSwitch(Number(e.target.value))}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {documents.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm ml-auto"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Chat with PDF
          </button>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center gap-4">
          <select
            value={targetLanguage}
            onChange={handleLanguageChange}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
          </select>

          <div className="flex items-center gap-3">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-sm font-medium">
              Page {currentPage} of {numPages}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage >= numPages}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              Next
            </button>
          </div>

          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>100%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
            <option value={2.5}>250%</option>
          </select>

          <button
            onClick={handleScreenshotAnalysis}
            disabled={isAnalyzingImage}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
              isAnalyzingImage 
              ? 'bg-purple-300 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            }`}
          >
            {isAnalyzingImage ? 'Analyzing...' : 'Analyze View'}
          </button>
        </div>

        {/* PDF Viewer */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="relative mx-auto" style={{ width: 'fit-content' }}>
            <canvas ref={canvasRef} className="max-w-full" />
            <div
              ref={textLayerRef}
              className="absolute top-0 left-0 right-0 bottom-0 textLayer"
              style={{ pointerEvents: 'none' }}
              onMouseUp={handleTextSelection}
              onMouseMove={handleTextHover}
              onMouseLeave={() => setShowFootnote(false)}
            />
            
            {/* Selection Menu - Keep original functionality but update styling */}
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute bg-white shadow-lg rounded-lg p-2 z-50 transform -translate-x-1/2 flex gap-2"
                style={{
                  left: menuPosition.x,
                  top: menuPosition.y - 40,
                }}
              >
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className={`px-3 py-1 text-sm rounded ${
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
                  className={`px-3 py-1 text-sm rounded ${
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
                  className={`px-3 py-1 text-sm rounded ${
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
                  className={`px-3 py-1 text-sm rounded ${
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
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Keep original structure but update styling */}
      <div className="w-96 border-l border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
        <div className="p-4">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {['Current', 'History', 'Footnotes', 'Search', 'Chat'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.toLowerCase()
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Keep original tab content logic but add consistent styling */}
          <div className="mt-4 space-y-4">
            {activeTab === 'current' && (
              // ... (keep original current tab content with updated styling)
              <div className="space-y-6">
                {selectedText && (
                  <>
                    <div className="border-b pb-4">
                      <h3 className="font-medium text-gray-900 mb-2">Selected Text:</h3>
                      <p className="p-3 bg-gray-50 rounded-lg text-gray-600">{selectedText}</p>
                    </div>

                    {translatedText && (
                      <div className="border-b pb-4">
                        <h3 className="font-medium text-gray-900 mb-2">Translation:</h3>
                        <p className="p-3 bg-gray-50 rounded-lg text-gray-600">{translatedText}</p>
                      </div>
                    )}

                    {analysis && (
                      <div className="border-b pb-4">
                        <h3 className="font-medium text-gray-900 mb-2">Analysis:</h3>
                        <div className="p-3 bg-gray-50 rounded-lg prose prose-sm">
                          <p className="text-gray-600 whitespace-pre-line">{analysis}</p>
                        </div>
                      </div>
                    )}

                    {summary && (
                      <div className="border-b pb-4">
                        <h3 className="font-medium text-gray-900 mb-2">Summary:</h3>
                        <div className="p-3 bg-gray-50 rounded-lg prose prose-sm">
                          <p className="text-gray-600 whitespace-pre-line">{summary}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!selectedText && (
                  <div className="text-gray-500 text-center py-8">
                    Select text from the PDF to see translation and analysis
                  </div>
                )}
              </div>
            )}

            {/* Keep other tab content with similar styling patterns */}
            {activeTab === 'history' && <TranslationsCarousel translations={translationHistory} />}
            {/* ... (keep other tab content) */}
          </div>
        </div>
      </div>

      {/* Keep all existing modals and components */}
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

      <DocumentQA 
        isOpen={isQAOpen}
        onClose={() => setIsQAOpen(false)}
        pageContent={currentPageContent}
        documentName={currentDocument?.name || ''}
        currentPage={currentPage}
        pdfDoc={pdfDocRef.current}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={() => setIsQAOpen(true)}
          className="bg-green-600 text-white p-3 rounded-full shadow-lg hover:bg-green-700 transition-colors"
          title="Open Q&A"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </button>

        <button
          onClick={() => setIsChatOpen(true)}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Open Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
            />
          </svg>
        </button>
      </div>

      {/* Loading States */}
      {isProcessingDocument && (
        <div className="fixed bottom-24 right-6 bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Processing document...</span>
        </div>
      )}
    </main>
  )
}
