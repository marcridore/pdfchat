import { localVectorStore } from './localVectorStore'

class ClientLocalStore {
  constructor() {
    this.store = null
    this.isInitialized = false
    this.initPromise = null
  }

  async init() {
    if (typeof window === 'undefined') {
      console.log('ClientLocalStore: Cannot initialize on server')
      return null
    }

    // Return existing promise if initialization is in progress
    if (this.initPromise) {
      return this.initPromise
    }

    // Create new initialization promise
    this.initPromise = new Promise(async (resolve, reject) => {
      try {
        if (this.isInitialized) {
          console.log('ClientLocalStore: Already initialized')
          resolve(this.store)
          return
        }

        console.log('ClientLocalStore: Starting initialization...')
        const store = await localVectorStore.init()
        this.store = store
        this.isInitialized = true
        console.log('ClientLocalStore: Successfully initialized')
        resolve(this.store)
      } catch (error) {
        console.error('ClientLocalStore: Initialization failed:', error)
        this.initPromise = null // Reset promise on failure
        reject(error)
      }
    })

    return this.initPromise
  }

  async ensureInitialized() {
    if (!this.isInitialized || !this.store) {
      console.log('ClientLocalStore: Ensuring initialization...')
      await this.init()
    }
    return this.store
  }

  async searchSimilar(query, queryVector, limit = 3) {
    const store = await this.ensureInitialized()
    console.log('ClientLocalStore: Searching with query:', query)
    return store.searchSimilar(query, queryVector, limit)
  }

  isReady() {
    return this.isInitialized && this.store !== null
  }
}

// Create singleton instance
const clientLocalStore = new ClientLocalStore()

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  clientLocalStore.init().catch(error => {
    console.error('Failed to initialize client store:', error)
  })
}

export { clientLocalStore } 