'use client'
import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import DocumentControls from './components/Header/DocumentControls'
import SelectionMenu from './components/PDFViewer/SelectionMenu'
import TabNavigation from './components/Sidebar/TabNavigation'
import Notification from './components/LoadingStates/Notification'
import TranslationsCarousel from './components/TranslationsCarousel'
import Tooltip from './components/Tooltip'
import ChatModal from './components/ChatModal'
// import { storePageEmbeddings } from './lib/embeddings'
import DocumentQA from './components/DocumentQnA'
import CurrentTab from './components/Sidebar/CurrentTab'
import FootnotesTab from './components/Sidebar/FootnotesTab'
import SearchTab from './components/Sidebar/SearchTab'
import Sidebar from './components/Sidebar/Sidebar'
import UserGuide from './components/PDFViewer/UserGuide'
import { localVectorStore } from './lib/localVectorStore'
import { VECTOR_STORE } from './lib/localVectorStore'
import { handleLocalChat } from './lib/localChat'
import { clientLocalStore } from './lib/clientLocalStore'
import { handleClientChat } from './lib/clientChat'

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
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const [useLocalVectorization, setUseLocalVectorization] = useState(false)
  const [isStoragePreferenceLoaded, setIsStoragePreferenceLoaded] = useState(false)
  const [isLocalStoreReady, setIsLocalStoreReady] = useState(false)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const textLayerRef = useRef(null)
  const pdfDocRef = useRef(null)
  const menuRef = useRef(null)
  const currentRenderTask = useRef(null)

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

  // Add effect to load storage preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('useLocalVectorization')
      const value = stored ? JSON.parse(stored) : false
      setUseLocalVectorization(value)
      setIsStoragePreferenceLoaded(true)
    }
  }, [])

  // Load PDF document
  const loadPDF = async (file, doc = null) => {
    setIsPdfLoading(true)
    const activeDoc = doc || currentDocument

    try {
      if (!file) {
        console.log('No file available:', {
          docName: activeDoc?.name,
          docId: activeDoc?.id
        })
        setIsPdfLoading(false)
        return
      }

      // Clean up previous PDF and canvas
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
      cleanupCanvas()
      resetOutputs()

      // Load and render first page immediately
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      pdfDocRef.current = pdf
      setNumPages(pdf.numPages)
      setCurrentPage(1)
      
      // Render first page and make it visible quickly
      await renderPage(1, activeDoc)
      setIsPdfLoading(false)

      // Start processing pages in background
      setIsProcessingDocument(true)
      setProcessingProgress({ current: 0, total: pdf.numPages })
      
      // Process pages in background
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        await processPage(page, activeDoc, useLocalVectorization)
        setProcessingProgress(prev => ({ 
          ...prev, 
          current: pageNum 
        }))
      }

      if (useLocalVectorization) {
        console.log('Checking final database state...')
        await localVectorStore.checkDatabaseContents()
      }

      setIsProcessingDocument(false)
      setProcessingProgress({ current: 0, total: 0 })

    } catch (error) {
      console.error('Error loading PDF:', error)
      setIsPdfLoading(false)
      setIsProcessingDocument(false)
      setProcessingProgress({ current: 0, total: 0 })
      setNotification({
        type: 'error',
        message: 'Failed to load PDF'
      })
    }
  }

  // Add a cleanup function
  const cleanupCanvas = () => {
    if (currentRenderTask.current) {
      currentRenderTask.current.cancel()
      currentRenderTask.current = null
    }

    const canvas = canvasRef.current
    if (canvas) {
      const context = canvas.getContext('2d')
      context.clearRect(0, 0, canvas.width, canvas.height)
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

    // Add check for canvas reference
    if (!canvasRef.current) {
      console.log('Canvas not ready')
      return
    }

    try {
      // Cancel any ongoing render task
      if (currentRenderTask.current) {
        await currentRenderTask.current.cancel()
        currentRenderTask.current = null
      }

      const page = await pdfDocRef.current.getPage(pageNumber)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!canvas || !context) {
        console.log('Canvas or context not available')
        return
      }
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      // Store the render task
      currentRenderTask.current = page.render(renderContext)
      await currentRenderTask.current.promise
      currentRenderTask.current = null

      // Process text layer
      if (textLayerRef.current) {
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

        const pageText = textContent.items.map(item => item.str).join(' ')
        setCurrentPageContent(pageText)
      }

    } catch (error) {
      if (error.name === 'RenderingCancelled') {
        console.log('Rendering was cancelled')
      } else {
        console.error('Error rendering page:', error)
        setNotification({
          type: 'error',
          message: 'Failed to render page'
        })
      }
    }
  }

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (file && file.type === 'application/pdf') {
      console.log('Uploading new document:', {
        fileName: file.name,
        useLocalStorage: useLocalVectorization // Log storage choice
      })

      // Create new document object
      const newDoc = {
        id: Date.now(),
        name: file.name,
        file: file,
        timestamp: Date.now()
      }

      // Add to documents list
      setDocuments(prev => [...prev, newDoc])
      setCurrentDocument(newDoc)

      // Reset states
      setSelectedText('')
      setTranslatedText('')
      setAnalysis('')
      setSummary('')
      setImageAnalysis('')
      setTranslationHistory([])
      setFootnotesHistory({})
      setFootnoteCounter(1)
      setSimilarPassages([])
      setSearchQuery('')
      setChatHistory([])
      setActiveTab('current')

      // Load PDF
      await loadPDF(file, newDoc)

      // Clear file input
      if (event.target) {
        event.target.value = ''
      }
    } else {
      setNotification({
        type: 'error',
        message: 'Please upload a PDF file'
      })
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
      if (useLocalVectorization) {
        // Get embedding for selected text
        const response = await fetch('/api/local-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedText })
        })

        const { embedding } = await response.json()
        
        // Search in local store
        const results = await localVectorStore.findSimilar(embedding, 5, {
          documentId: currentDocument.id // Exclude current document
        })
        
        setSimilarPassages(results)
      } else {
        // Existing Pinecone search flow
        const response = await fetch('/api/similar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: selectedText })
        })
        const data = await response.json()
        setSimilarPassages(data)
      }
      setActiveTab('search')
    } catch (error) {
      console.error('Error searching similar passages:', error)
      setNotification({
        type: 'error',
        message: 'Failed to search similar passages'
      })
    } finally {
      setIsSearchingSimilar(false)
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
  const handleChat = async (input = chatInput) => {
    const message = input || chatInput
    if (!message || !message.trim()) return

    setIsChatLoading(true)
    const newMessage = { role: 'user', content: message }
    const updatedHistory = [...chatHistory, newMessage]
    setChatHistory(updatedHistory)
    setChatInput('')

    try {
      let response
      const storageType = useLocalVectorization ? 'local' : 'remote'
      console.log(`Using ${storageType} storage for chat...`)

      if (useLocalVectorization) {
        // Check if local store is ready
        if (!clientLocalStore.isReady()) {
          console.log('Local store not ready, initializing...')
          await clientLocalStore.init()
        }

        // Handle chat entirely on client side - pass only current message
        console.log('Processing chat with local vectors...')
        try {
          const result = await handleClientChat(message)
          response = {
            ok: true,
            data: result
          }
        } catch (error) {
          console.error('Local chat failed:', error)
          setNotification({
            type: 'error',
            message: 'Local chat failed. Please try again or switch to remote storage.'
          })
          throw error
        }
      } else {
        // Use remote API - pass full history
        console.log('Processing chat with Pinecone...')
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedHistory
          })
        })
        response.data = await response.json()
      }

      if (!response.ok) {
        throw new Error(response.data.error || 'Chat request failed')
      }

      console.log(`${storageType} chat completed:`, {
        contextFound: response.data.context?.length || 0
      })

      setChatHistory([...updatedHistory, { 
        role: 'assistant', 
        content: response.data.response,
        context: response.data.context
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setNotification({
        type: 'error',
        message: error.message || 'Failed to get chat response'
      })
      // Remove the failed message from history
      setChatHistory(updatedHistory.slice(0, -1))
    } finally {
      setIsChatLoading(false)
    }
  }

  // Update processPage function
  const processPage = async (page, doc, useLocal) => {
    try {
      const textContent = await page.getTextContent()
      const text = textContent.items.map(item => item.str).join(' ')

      console.log('Processing page:', {
        storage: useLocal ? 'local' : 'pinecone',
        page: page.pageNumber,
        docName: doc.name
      })

      if (useLocal) {
        // Local storage path
        const response = await fetch('/api/local-embedding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        })

        if (!response.ok) {
          throw new Error('Failed to create local embedding')
        }

        const { embedding } = await response.json()
        
        // Store in IndexedDB
        const vectorId = `${doc.id}-${page.pageNumber}-${Date.now()}`
        await localVectorStore.storeVector(
          vectorId,
          embedding,
          {
            documentId: doc.id,
            pageNumber: page.pageNumber,
            pdfName: doc.name,
            text
          }
        )

        console.log('Stored in local IndexedDB:', {
          page: page.pageNumber,
          docName: doc.name,
          vectorId
        })

        return // Exit early for local storage path
      }

      // Pinecone storage path
      const response = await fetch('/api/similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          metadata: {
            documentId: doc.id,
            pageNumber: page.pageNumber,
            pdfName: doc.name
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to store in Pinecone')
      }

      // Update progress
      setProcessingProgress(prev => ({
        ...prev,
        current: page.pageNumber
      }))

    } catch (error) {
      console.error('Error processing page:', error)
      setNotification({
        type: 'error',
        message: `Failed to process page ${page.pageNumber}`
      })
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

  // Add handler for setting change
  const handleVectorizationSettingChange = (useLocal) => {
    setUseLocalVectorization(useLocal)
    if (typeof window !== 'undefined') {
      localStorage.setItem('useLocalVectorization', JSON.stringify(useLocal))
      console.log('Storage preference updated:', useLocal ? 'local' : 'remote')
    }
  }

  // Update the initialization effect
  useEffect(() => {
    const initStore = async () => {
      if (!isStoragePreferenceLoaded) return;

      try {
        if (useLocalVectorization) {
          console.log('Initializing local store...')
          await clientLocalStore.init()
          setIsLocalStoreReady(true)
          console.log('Local store initialization complete')
        }
      } catch (error) {
        console.error('Failed to initialize local store:', error)
        setNotification({
          type: 'error',
          message: 'Failed to initialize storage system'
        })
      }
    }

    initStore()
  }, [useLocalVectorization, isStoragePreferenceLoaded])

  // Update the storage preference effect
  useEffect(() => {
    if (!useLocalVectorization) {
      console.log('Using remote storage')
      return
    }

    if (!isLocalStoreReady) {
      console.log('Local store not ready, initializing...')
      clientLocalStore.init().catch(error => {
        console.error('Failed to initialize local store:', error)
        setNotification({
          type: 'error',
          message: 'Failed to initialize local storage'
        })
      })
    }
  }, [useLocalVectorization, isLocalStoreReady])

  return (
    <main className="flex min-h-screen bg-gray-50">
      <Notification 
        notification={notification} 
        onClose={() => setNotification(null)} 
      />

      {/* Main Content Area with PDF Viewer */}
      <div className="flex-1 p-6">
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

        <DocumentControls 
          targetLanguage={targetLanguage}
          handleLanguageChange={handleLanguageChange}
          currentPage={currentPage}
          numPages={numPages}
          prevPage={prevPage}
          nextPage={nextPage}
          scale={scale}
          setScale={setScale}
          handleScreenshotAnalysis={handleScreenshotAnalysis}
          isAnalyzingImage={isAnalyzingImage}
          onVectorizationSettingChange={handleVectorizationSettingChange}
          setNotification={setNotification}
        />

        {/* PDF Viewer Container with Processing Indicator */}
        <div className="relative flex gap-6">
          {/* PDF Viewer */}
          <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden relative">
            <div className="relative mx-auto" style={{ width: 'fit-content' }}>
              {/* PDF Loading Indicator */}
              {currentDocument && isPdfLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-600 font-medium">Loading PDF...</p>
                  </div>
                </div>
              )}
              
              <canvas 
                ref={canvasRef} 
                className={`max-w-full transition-opacity duration-300 ${
                  isPdfLoading ? 'opacity-0' : 'opacity-100'
                }`} 
              />
              
              {/* Text Layer */}
              <div
                ref={textLayerRef}
                className={`absolute top-0 left-0 right-0 bottom-0 textLayer transition-opacity duration-300 ${
                  isPdfLoading ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ pointerEvents: 'all' }}
                onMouseUp={handleTextSelection}
                onMouseMove={handleTextHover}
                onMouseLeave={() => setShowFootnote(false)}
              />
              
              {showMenu && (
                <SelectionMenu 
                  menuRef={menuRef}
                  menuPosition={menuPosition}
                  handleTranslate={handleTranslate}
                  isTranslating={isTranslating}
                  handleAnalyze={handleAnalyze}
                  isAnalyzing={isAnalyzing}
                  handleFootnoteButton={handleFootnoteButton}
                  handleSimilaritySearch={handleSimilaritySearch}
                  isSearchingSimilar={isSearchingSimilar}
                  handleSummarize={handleSummarize}
                  isSummarizing={isSummarizing}
                />
              )}
            </div>
          </div>

          {/* Processing Indicator - Now between PDF and Sidebar */}
          {isProcessingDocument && (
            <div className="absolute right-[400px] top-4 z-50 bg-white/90 backdrop-blur-sm border border-gray-200 p-4 rounded-xl shadow-lg w-80">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-gray-700">Processing, Embedding document...</span>
                </div>
                
                <div className="space-y-2">
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300" 
                      style={{ 
                        width: `${(processingProgress.current / processingProgress.total) * 100}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Page {processingProgress.current} of {processingProgress.total}</span>
                    <span>{Math.round((processingProgress.current / processingProgress.total) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedText={selectedText}
            translatedText={translatedText}
            isTranslating={isTranslating}
            analysis={analysis}
            summary={summary}
            imageAnalysis={imageAnalysis}
            isAnalyzingImage={isAnalyzingImage}
            translationHistory={translationHistory}
            footnotesHistory={footnotesHistory}
            scrollToReference={scrollToReference}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleManualSearch={handleManualSearch}
            isSearchingSimilar={isSearchingSimilar}
            similarPassages={similarPassages}
            setCurrentPage={setCurrentPage}
            chatHistory={chatHistory}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleChat={handleChat}
            isChatLoading={isChatLoading}
          />
        </div>
      </div>

      {/* Floating Elements */}
      {currentDocument && <UserGuide />}
      
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

      {/* Modals */}
      <ChatModal 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        pdfName={currentDocument?.name || ''}
        chatHistory={chatHistory}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleChat={() => handleChat()} // Call without arguments to use chatInput state
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
    </main>
  )
}
