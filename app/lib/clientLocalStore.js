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

  async searchSimilar(query, queryVector, limit = 3, threshold = 0.01) {
    await this.ensureInitialized()
    console.log('ClientLocalStore: Searching with query:', query)
    return localVectorStore.searchSimilar(query, queryVector, limit, threshold)
  }

  async checkDocumentExists(pdfName) {
    await this.ensureInitialized()
    return localVectorStore.checkDocumentExists(pdfName)
  }

  async storePage({ text, pageNumber, documentId, pdfName }) {
    await this.ensureInitialized()
    
    // Check if document already exists
    const exists = await this.checkDocumentExists(pdfName)
    if (exists) {
      console.log('Document already exists in local store:', pdfName)
      return null
    }
    
    console.log('Creating new embedding for:', { 
      pdfName, 
      pageNumber, 
      textLength: text.length 
    })

    // Get embedding from local API endpoint
    const response = await fetch('/api/local-embedding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    })

    if (!response.ok) {
      throw new Error('Failed to create local embedding')
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

    console.log('Successfully stored vector locally:', {
      id: vectorId,
      pageNumber,
      documentName: pdfName
    })

    return { id: vectorId }
  }
}

export const clientLocalStore = new ClientLocalStore()

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  clientLocalStore.init().catch(error => {
    console.error('Failed to initialize client store:', error)
  })
} 