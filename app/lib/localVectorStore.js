// Constants
export const VECTOR_STORE = 'vectors'
export const DB_NAME = 'vectorStore'
export const DB_VERSION = 1
export const METADATA_STORE = 'metadata'

// Add BM25 parameters
const BM25_PARAMS = {
  k1: 1.2,  // Term frequency saturation parameter
  b: 0.75,  // Length normalization parameter
  avgDocLength: 0  // Will be calculated dynamically
}

// Add name-specific parameters
const NAME_MATCH_PARAMS = {
  similarityThreshold: 0.85,  // Higher threshold for names
  exactMatchBoost: 2.5,      // Higher boost for exact matches
  partialMatchPenalty: 0.7   // Penalize partial matches more
}

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
    console.log('Storing vector:', {
      id,
      vectorLength: vector.length,
      metadata: {
        ...metadata,
        text: metadata.text.substring(0, 50) + '...'
      }
    })

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([VECTOR_STORE], 'readwrite')
        const store = transaction.objectStore(VECTOR_STORE)

        const data = {
          id,
          vector: Array.from(vector), // Ensure vector is stored as array
          metadata,
          timestamp: Date.now()
        }

        const request = store.put(data)

        request.onsuccess = () => {
          console.log('Vector stored successfully:', {
            id,
            text: metadata.text.substring(0, 50)
          })
          resolve()
        }

        request.onerror = (event) => {
          console.error('Failed to store vector:', event.target.error)
          reject(event.target.error)
        }
      } catch (error) {
        console.error('Error in storeVector:', error)
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
      const arrayA = Array.isArray(vecA) ? vecA : Object.values(vecA)
      const arrayB = Array.isArray(vecB) ? vecB : Object.values(vecB)

      if (arrayA.length !== arrayB.length) {
        console.error('Vector length mismatch:', {
          vecALength: arrayA.length,
          vecBLength: arrayB.length
        })
        return 0
      }

      const dotProduct = arrayA.reduce((sum, a, i) => sum + a * arrayB[i], 0)
      const normA = Math.sqrt(arrayA.reduce((sum, a) => sum + a * a, 0))
      const normB = Math.sqrt(arrayB.reduce((sum, b) => sum + b * b, 0))
      
      if (normA === 0 || normB === 0) {
        return 0
      }

      const similarity = dotProduct / (normA * normB)
      
      // Debug similarity calculation
      console.log('Similarity calculation:', {
        dotProduct,
        normA,
        normB,
        similarity
      })

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

  async searchSimilar(query, limit = 5, threshold = 0.1) {
    try {
      // First, get embedding for the query text
      const embeddingResponse = await fetch('/api/embedding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: query })
      })

      if (!embeddingResponse.ok) {
        throw new Error('Failed to create query embedding')
      }

      const { embedding: queryVector } = await embeddingResponse.json()

      // Now proceed with vector comparison
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      console.log('Starting search for:', {
        query,
        vectorLength: queryVector.length,
        threshold
      })

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const vectors = request.result
          
          console.log('Database contents:', {
            totalVectors: vectors.length,
            sampleDoc: vectors[0] ? {
              text: vectors[0].metadata.text,
              vectorLength: vectors[0].vector.length
            } : null
          })

          const results = vectors
            .map(item => {
              const storedVector = Array.isArray(item.vector) ? item.vector : Object.values(item.vector)
              const similarity = this.cosineSimilarity(queryVector, storedVector)
              
              // Debug each comparison
              console.log('Comparing vectors:', {
                docText: item.metadata.text.substring(0, 50),
                similarity,
                threshold
              })

              return {
                ...item.metadata,
                similarity,
                text: item.metadata.text
              }
            })
            .filter(item => item.similarity > threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)

          console.log('Search results:', {
            query,
            totalResults: results.length,
            topResults: results.map(r => ({
              text: r.text.substring(0, 50),
              similarity: r.similarity
            }))
          })

          resolve(results)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error in searchSimilar:', {
        error,
        query
      })
      throw error
    }
  }

  async checkDocumentExists(pdfName) {
    await this.initPromise
    console.log('Checking if document exists:', pdfName)

    try {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const vectors = request.result
          const exists = vectors.some(v => v.metadata.pdfName === pdfName)
          console.log('Document existence check:', {
            pdfName,
            exists,
            totalVectors: vectors.length
          })
          resolve(exists)
        }

        request.onerror = (event) => {
          console.error('Error checking document:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error in checkDocumentExists:', error)
      throw error
    }
  }

  async searchByKeyword(query, limit = 5) {
    await this.initPromise
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
        const store = transaction.objectStore(VECTOR_STORE)
        const request = store.getAll()

        request.onsuccess = () => {
          const vectors = request.result
          const queryTerms = query.toLowerCase().split(/\s+/)
          
          // Calculate average document length for BM25
          const totalLength = vectors.reduce((sum, doc) => 
            sum + doc.metadata.text.split(/\s+/).length, 0)
          BM25_PARAMS.avgDocLength = totalLength / vectors.length

          const results = vectors
            .map(item => {
              const text = item.metadata.text.toLowerCase()
              const docTerms = text.split(/\s+/)
              let bm25Score = 0
              let maxWordScore = 0

              // Calculate document frequency for each term
              const termFreqs = new Map()
              docTerms.forEach(term => {
                termFreqs.set(term, (termFreqs.get(term) || 0) + 1)
              })

              queryTerms.forEach(queryTerm => {
                // BM25 scoring
                docTerms.forEach(docTerm => {
                  const similarity = calculateStringSimilarity(queryTerm, docTerm)
                  if (similarity > 0.7) {
                    const tf = termFreqs.get(docTerm) || 0
                    const docLength = docTerms.length
                    
                    // BM25 formula
                    const numerator = tf * (BM25_PARAMS.k1 + 1)
                    const denominator = tf + BM25_PARAMS.k1 * (1 - BM25_PARAMS.b + BM25_PARAMS.b * docLength / BM25_PARAMS.avgDocLength)
                    const score = similarity * (numerator / denominator)
                    
                    bm25Score += score
                    maxWordScore = Math.max(maxWordScore, score)
                  }
                })
              })

              return {
                ...item.metadata,
                id: item.id,
                text: item.metadata.text,
                score: bm25Score,
                exactMatchScore: maxWordScore
              }
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)

          resolve(results)
        }

        request.onerror = () => reject(request.error)
      } catch (error) {
        console.error('Error in keyword search:', error)
        reject(error)
      }
    })
  }

  async checkPageExists(pdfName, pageNumber) {
    await this.initPromise
    
    try {
      const transaction = this.db.transaction([VECTOR_STORE], 'readonly')
      const store = transaction.objectStore(VECTOR_STORE)
      const request = store.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const vectors = request.result
          const exists = vectors.some(v => 
            v.metadata.pdfName === pdfName && 
            v.metadata.pageNumber === pageNumber
          )
          console.log('Page existence check:', {
            pdfName,
            pageNumber,
            exists
          })
          resolve(exists)
        }

        request.onerror = (event) => {
          console.error('Error checking page:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error in checkPageExists:', error)
      throw error
    }
  }
}

// Helper function to calculate string similarity with improved fuzzy matching
function calculateStringSimilarity(str1, str2) {
  // Convert to lowercase for case-insensitive comparison
  const s1 = str1.toLowerCase()
  const s2 = str2.toLowerCase()
  
  // Quick exact match check
  if (s1 === s2) return 1.0

  // Handle very short strings differently
  if (s1.length < 3 || s2.length < 3) {
    return s1 === s2 ? 1.0 : 0.0
  }

  // Calculate Levenshtein distance
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null))
  
  for (let i = 0; i <= s1.length; i++) track[0][i] = i
  for (let j = 0; j <= s2.length; j++) track[j][0] = j

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      // Lower cost for common typos (e.g., adjacent keys, vowel substitutions)
      const cost = getTypoCost(s1[i - 1], s2[j - 1])
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + cost // substitution
      )
    }
  }

  const distance = track[s2.length][s1.length]
  const maxLength = Math.max(s1.length, s2.length)
  
  // Improved similarity score calculation
  const similarity = 1 - (distance / maxLength)
  
  // Boost score for partial matches at word boundaries
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(1.0, similarity + 0.2)
  }

  return similarity
}

// Helper to determine cost of character substitution
function getTypoCost(char1, char2) {
  // Same character = no cost
  if (char1 === char2) return 0
  
  // Common character substitutions
  const commonSubstitutions = {
    'a': 'aeioqu',
    'e': 'aeiou',
    'i': 'ieyo',
    'o': 'oau',
    'u': 'uov',
    'm': 'mn',
    'n': 'nm',
    'c': 'ck',
    'k': 'ck',
    'p': 'pb',
    'b': 'bp',
    'd': 'dr',
    'r': 'rd'
  }

  // Lower cost for common substitutions
  if (commonSubstitutions[char1]?.includes(char2) || 
      commonSubstitutions[char2]?.includes(char1)) {
    return 0.5
  }

  return 1
}

// Helper function to detect likely names
function isLikelyName(term) {
  return /^[A-Z][a-z]+$/.test(term) || // Capitalized word
         term.split(/\s+/).length > 1   // Multiple words
}

// Create and export a singleton instance
const localVectorStore = new LocalVectorStore()
export { localVectorStore } 