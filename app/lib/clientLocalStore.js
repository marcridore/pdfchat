import { localVectorStore } from './localVectorStore'

export class ClientLocalStore {
  constructor() {
    this.ready = false
    this.initPromise = null
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = localVectorStore.init()
    await this.initPromise
    this.ready = true
    console.log('Client local store initialized')
  }

  isReady() {
    return this.ready
  }

  async ensureInitialized() {
    if (!this.ready) {
      await this.init()
    }
  }

  async searchSimilar(query, limit = 5, threshold = 0.1) {
    await this.ensureInitialized()
    console.log('ClientLocalStore: Searching with query:', query)
    return localVectorStore.searchSimilar(query, limit, threshold)
  }

  async searchByKeyword(query, limit = 5) {
    await this.ensureInitialized()
    return localVectorStore.searchByKeyword(query, limit)
  }

  async checkDocumentExists(pdfName) {
    await this.ensureInitialized()
    return localVectorStore.checkDocumentExists(pdfName)
  }

  async storePage({ text, pageNumber, documentId, pdfName, skipExistCheck = false }) {
    await this.ensureInitialized()
    
    // Only check if page exists when not processing a full document
    if (!skipExistCheck) {
      const exists = await this.checkPageExists(pdfName, pageNumber)
      if (exists) {
        console.log('Page already exists in local store:', {
          pdfName,
          pageNumber
        })
        return null
      }
    }
    
    console.log('Creating new embedding for:', { 
      pdfName, 
      pageNumber, 
      textLength: text.length 
    })

    // Get embedding from local API endpoint
    const response = await fetch('/api/embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error('Failed to create embedding')
    }

    const { embedding } = await response.json()
    
    // Store in local vector store
    const vectorId = `${documentId}-${pageNumber}-${Date.now()}`
    await localVectorStore.storeVector(
      vectorId,
      embedding,
      {
        documentId,
        pageNumber,
        pdfName,
        text
      }
    )

    console.log('Successfully stored vector:', {
      id: vectorId,
      pageNumber,
      documentName: pdfName
    })

    return { id: vectorId }
  }

  async checkPageExists(pdfName, pageNumber) {
    await this.ensureInitialized()
    return localVectorStore.checkPageExists(pdfName, pageNumber)
  }
}

export const clientLocalStore = new ClientLocalStore()

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  clientLocalStore.init().catch(error => {
    console.error('Failed to initialize client store:', error)
  })
} 