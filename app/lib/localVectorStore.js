// Constants
export const VECTOR_STORE = 'vectors'
export const DB_NAME = 'vectorStore'
export const DB_VERSION = 1
export const METADATA_STORE = 'metadata'

class LocalVectorStore {
  constructor() {
    this.db = null
    this.initPromise = null
    console.log('LocalVectorStore: Created instance')
  }

  async initDB() {
    if (typeof window === 'undefined') {
      console.log('LocalVectorStore: Skipping initialization on server-side')
      return null
    }

    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log('LocalVectorStore: Opening IndexedDB...')
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = (event) => {
        console.error('LocalVectorStore: Database error:', event.target.error)
        reject(event.target.error)
      }

      request.onupgradeneeded = (event) => {
        console.log('LocalVectorStore: Database upgrade needed')
        const db = event.target.result

        if (!db.objectStoreNames.contains(VECTOR_STORE)) {
          console.log('LocalVectorStore: Creating vector store...')
          const vectorStore = db.createObjectStore(VECTOR_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          
          // Add necessary indexes
          vectorStore.createIndex('documentId', 'metadata.documentId', { unique: false })
          vectorStore.createIndex('pageNumber', 'metadata.pageNumber', { unique: false })
          console.log('LocalVectorStore: Vector store created with indexes')
        }

        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          console.log('LocalVectorStore: Creating metadata store...')
          const metadataStore = db.createObjectStore(METADATA_STORE, { 
            keyPath: 'documentId' 
          })
          metadataStore.createIndex('name', 'name', { unique: true })
          console.log('LocalVectorStore: Metadata store created')
        }
      }

      request.onsuccess = (event) => {
        this.db = event.target.result
        console.log('LocalVectorStore: Database opened successfully')
        resolve(this.db)
      }
    })

    return this.initPromise
  }

  async init() {
    await this.initDB()
    console.log('LocalVectorStore: Initialized')
    return this
  }

  async storeVector(id, vector, metadata) {
    await this.initPromise
    console.log('LocalVectorStore: Attempting to store vector:', { id, metadata })

    if (!this.db) {
      console.error('LocalVectorStore: Database not initialized')
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([VECTOR_STORE], 'readwrite')
        console.log('LocalVectorStore: Created transaction')
        
        const store = transaction.objectStore(VECTOR_STORE)
        console.log('LocalVectorStore: Got object store')

        const data = {
          id,
          vector,
          metadata,
          timestamp: Date.now()
        }
        console.log('LocalVectorStore: Preparing to store data:', data)

        const request = store.put(data)

        request.onsuccess = () => {
          console.log('LocalVectorStore: Vector stored successfully:', id)
          resolve()
        }

        request.onerror = (event) => {
          console.error('LocalVectorStore: Failed to store vector:', event.target.error)
          reject(event.target.error)
        }
      } catch (error) {
        console.error('LocalVectorStore: Error in storeVector:', error)
        reject(error)
      }
    })
  }

  async findSimilar(queryVector, limit = 5, filter = {}) {
    await this.initPromise
    console.log('LocalVectorStore: Finding similar vectors:', { limit, filter })

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const vectors = request.result
        console.log('LocalVectorStore: Retrieved vectors:', vectors.length)

        // Filter vectors based on metadata
        let filtered = vectors
        if (filter.documentId) {
          filtered = filtered.filter(v => v.metadata.documentId !== filter.documentId)
        }

        // Calculate cosine similarity
        const results = filtered.map(item => {
          const similarity = this.cosineSimilarity(queryVector, item.vector)
          return {
            ...item.metadata,
            score: similarity
          }
        })

        // Sort by similarity and take top k
        const topK = results
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)

        console.log('LocalVectorStore: Found similar vectors:', topK.length)
        resolve(topK)
      }

      request.onerror = () => {
        console.error('LocalVectorStore: Failed to find similar vectors:', request.error)
        reject(request.error)
      }
    })
  }

  cosineSimilarity(vecA, vecB) {
    try {
      const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
      const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
      const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
      const similarity = dotProduct / (normA * normB)
      
      return similarity
    } catch (error) {
      console.error('Error calculating similarity:', error)
      return 0
    }
  }

  async listDocuments() {
    await this.initPromise
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        const vectors = request.result
        const documents = [...new Set(vectors.map(v => v.metadata.pdfName))]
        console.log('LocalVectorStore: Listed documents:', documents)
        resolve(documents)
      }

      request.onerror = () => {
        console.error('LocalVectorStore: Failed to list documents:', request.error)
        reject(request.error)
      }
    })
  }

  async checkDatabaseContents() {
    await this.initPromise
    console.log('Checking database contents...')

    try {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const vectors = request.result
          console.log('Database contents:', {
            totalVectors: vectors.length,
            samples: vectors.slice(0, 3).map(v => ({
              id: v.id,
              text: v.metadata.text.substring(0, 50) + '...',
              documentId: v.metadata.documentId
            }))
          })
          resolve(vectors)
        }

        request.onerror = (event) => {
          console.error('Error checking database:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error checking database:', error)
      throw error
    }
  }

  async clearDatabase() {
    await this.initPromise
    console.log('LocalVectorStore: Clearing database...')

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([VECTOR_STORE], 'readwrite')
        const store = transaction.objectStore(VECTOR_STORE)
        const request = store.clear()

        request.onsuccess = () => {
          console.log('LocalVectorStore: Database cleared successfully')
          resolve()
        }

        request.onerror = (event) => {
          console.error('LocalVectorStore: Failed to clear database:', event.target.error)
          reject(event.target.error)
        }
      } catch (error) {
        console.error('LocalVectorStore: Error clearing database:', error)
        reject(error)
      }
    })
  }

  async searchSimilar(query, queryVector, limit = 3, threshold = 0.2) {
    await this.initPromise
    console.log('Searching local vectors for:', { 
      query, 
      limit,
      threshold,
      vectorLength: queryVector.length 
    })

    try {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const vectors = request.result
          
          // Calculate similarities and check for exact matches
          const results = vectors.map(item => {
            const similarity = this.cosineSimilarity(queryVector, item.vector)
            const exactMatch = item.metadata.text.toLowerCase().includes(query.toLowerCase())
            return {
              ...item,
              similarity: exactMatch ? 1.0 : similarity, // Boost exact matches
              exactMatch
            }
          })
          .filter(item => item.exactMatch || item.similarity > threshold)
          .sort((a, b) => {
            // Sort by exact match first, then by similarity
            if (a.exactMatch && !b.exactMatch) return -1
            if (!a.exactMatch && b.exactMatch) return 1
            return b.similarity - a.similarity
          })
          .slice(0, limit)

          console.log('Local search results:', {
            query,
            totalVectors: vectors.length,
            matches: results.length,
            exactMatches: results.filter(r => r.exactMatch).length,
            topResults: results.map(r => ({
              text: r.metadata.text.substring(0, 50) + '...',
              score: r.similarity,
              exactMatch: r.exactMatch
            }))
          })

          resolve(results)
        }

        request.onerror = (event) => {
          console.error('Error searching vectors:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error in searchSimilar:', error)
      throw error
    }
  }
}

// Create and export a singleton instance
const localVectorStore = new LocalVectorStore()
export { localVectorStore } 