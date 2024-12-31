// Import necessary modules
import { Pinecone } from '@pinecone-database/pinecone'

// Check for required environment variables
if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not defined in environment variables')
}

// Initialize Pinecone with error handling
let pc
try {
  pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  })
  console.log('Pinecone client initialized successfully')
} catch (error) {
  console.error('Failed to initialize Pinecone client:', error)
  throw error
}

// Constants
const INDEX_NAME = 'pdf-embeddings'
const DIMENSION = 768 // dimension for m2-bert-80M-32k-retrieval model
const ESTIMATED_MAX_CHARS_PER_PAGE = 4000
const MIN_CHUNK_SIZE = 1   // Process even single-character chunks

// Export getOrCreateIndex function
export async function getOrCreateIndex() {
    try {
      // Try to get the index
      return pc.index(INDEX_NAME)
    } catch (error) {
      console.log('Creating new Pinecone index...')
      // Create the index if it doesn't exist
      await pc.createIndex({
        name: INDEX_NAME,
        dimension: DIMENSION,
        metric: 'cosine'
      })
      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 5000))
      return pc.index(INDEX_NAME)
    }
}

// Initialize index
let index
getOrCreateIndex().then(idx => {
  index = idx
}).catch(error => {
  console.error('Failed to initialize Pinecone index:', error)
})

// Together AI API Key and URL
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY
const TOGETHER_API_URL = 'https://api.together.xyz/v1'

// Function to create text embeddings using Together AI API
export async function createEmbedding(text) {
  try {
    const response = await fetch(`${TOGETHER_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'togethercomputer/m2-bert-80M-32k-retrieval',
        input: [text.replace('\n', ' ')] // Replace newlines with spaces as recommended
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error('Failed to create embedding')
    }

    const data = await response.json()

    return data.data[0].embedding
  } catch (error) {
    throw error
  }
}


// --- Text Chunking Utilities ---
// Function to split text into sentences using regex
function splitIntoSentences(text) {
    // Improved sentence splitting with better handling of edge cases
    const cleanText = text
      // Only split on clear sentence boundaries with periods followed by spaces and capitals
      .replace(/\.\s+(?=[A-Z])/g, '.|')
      // Keep line breaks as potential sentence boundaries
      .replace(/\n{2,}/g, '|')
      // Don't split on titles (Mr., Dr., etc) or common abbreviations
      .replace(/(?:Mr\.|Dr\.|Mme\.|M\.|Premier ministre)/g, match => match.replace('.', '•'))
      .replace(/\s+/g, ' ')          // Normalize whitespace
      // Restore periods in titles/abbreviations
      .replace(/•/g, '.')
    
    console.log('\n=== Text Processing ===')
    console.log('Input text:', text)
    console.log('Cleaned text:', cleanText)
    
    const sentences = cleanText.split('|')
    
    console.log('Initial sentences:', sentences)
    
    // Combine very short sentences with the next one
    const combinedSentences = []
    let currentSentence = ''
    sentences.forEach((sentence, i) => {
        const trimmed = sentence.trim();
        if (trimmed.length < 50 && i < sentences.length - 1) { // Increase merging threshold
            currentSentence += ' ' + trimmed;
        } else {
            if (currentSentence) {
                combinedSentences.push(currentSentence + ' ' + trimmed);
                currentSentence = '';
            } else {
                combinedSentences.push(trimmed);
            }
        }
    });
    
    const filteredSentences = combinedSentences.filter(s => s.length >= 30)
    
    console.log('Final sentences:', filteredSentences)
    console.log('=== End Text Processing ===\n')
    
    return filteredSentences
}

// Function to split text into chunks, approximately the length of one PDF page
function splitIntoChunks(text, maxChunkLength = ESTIMATED_MAX_CHARS_PER_PAGE) {
    if (!text || text.trim().length === 0) {
        return []
    }
  
    // Pre-process the entire text first
    const cleanedText = text
        .replace(/\s+/g, ' ')           
        .replace(/\n+/g, ' ')           
        .replace(/\.\s+/g, '. ')        
        .replace(/\s+\./g, '.')         
        .trim()
    
    // Split on clear sentence boundaries
    const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z][a-z])/g
    let sentences = cleanedText
        .split(sentenceRegex)
        .map(s => s.trim())
        .filter(s => s.length > 0)

    // Group sentences into chunks
    const chunks = []
    let currentChunk = {
        text: '',
        sentences: [],
        length: 0
    }

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 > maxChunkLength && currentChunk.length >= MIN_CHUNK_SIZE) {
            chunks.push({
                text: currentChunk.text,
                sentences: currentChunk.sentences
            })
            currentChunk = { text: '', sentences: [], length: 0 }
        }
        
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
            currentChunk.text += ' '
            currentChunk.length += 1
        }
        currentChunk.text += sentence
        currentChunk.sentences.push(sentence)
        currentChunk.length += sentence.length
    }
    
    // Add final chunk if not empty
    if (currentChunk.length > 0) {
        chunks.push({
            text: currentChunk.text,
            sentences: currentChunk.sentences
        })
    }
    
    return chunks
}

// --- Function for Storing Embeddings ---
export async function storeEmbedding(text, metadata) {
    if (!index) {
        throw new Error('Pinecone index not initialized')
    }

    // Improved check for existing embeddings
    try {
        const existingResults = await index.query({
            vector: Array(768).fill(0),
            topK: 1,
            filter: {
                $and: [
                    { documentId: { $eq: metadata.documentId } },
                    { pageNumber: { $eq: metadata.pageNumber } }
                ]
            },
            includeMetadata: true
        })

        if (existingResults.matches && existingResults.matches.length > 0) {
            console.log('Skipping: Embeddings exist for document:', {
                documentId: metadata.documentId,
                pageNumber: metadata.pageNumber,
                existingId: existingResults.matches[0].id
            })
            return false // Return false to indicate no new embeddings were created
        }

        console.log('No existing embeddings found, proceeding with creation for:', {
            documentId: metadata.documentId,
            pageNumber: metadata.pageNumber
        })
    } catch (error) {
        console.error('Error checking existing embeddings:', error)
        throw error
    }

    // Split text into chunks
    const chunks = splitIntoChunks(text)
    
    // Validate we have chunks to store
    if (chunks.length === 0) {
        return
    }
    
    const embeddings = []

    // Create embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const embedding = await createEmbedding(chunk.text)

        // Create a unique ID that includes all relevant metadata
        const id = `${metadata.documentId}-${metadata.pageNumber}-${i}-${Date.now()}`
    
        embeddings.push({
            id,
            values: embedding,
            metadata: {
                ...metadata,
                text: chunk.text,
                chunkIndex: i,
                totalChunks: chunks.length,
                sentences: chunk.sentences,
                timestamp: Date.now() // Add timestamp for versioning
            }
        })
    }

    // Store all chunks
    await index.upsert(embeddings)
    console.log('Successfully stored embeddings:', {
        count: embeddings.length,
        documentId: metadata.documentId,
        pageNumber: metadata.pageNumber
    })
}


// --- Function for Finding Similar Text ---
export async function findSimilar(text, limit = 5) {
    if (!index) {
      throw new Error('Pinecone index not initialized')
    }
    
    // Improved key terms extraction
    const keyTerms = text.toLowerCase()
      .replace(/^(who|what|where|when|why|how)\s+(is|are|was|were|do|does|did)\s+/i, '')
      .replace(/\?+$/, '')
      .trim()
    
    // Create embeddings for both original query and key terms
    const [queryEmbedding, keyTermsEmbedding] = await Promise.all([
      createEmbedding(text),
      createEmbedding(keyTerms)
    ])
    
    // Try hybrid search with both embeddings
    const [queryResults, keyTermResults] = await Promise.all([
      index.query({
        vector: queryEmbedding,
        topK: limit * 3, // Increased to get more potential matches
        includeMetadata: true
      }),
      index.query({
        vector: keyTermsEmbedding,
        topK: limit * 3,
        includeMetadata: true
      })
    ])
  
    // Combine and deduplicate results
    const allMatches = [...queryResults.matches, ...keyTermResults.matches]
    const uniqueMatches = Array.from(new Map(
      allMatches.map(match => [match.metadata.text, match])
    ).values())
  
    // Post-process results to prioritize exact matches
    const processedResults = uniqueMatches.map(match => {
      const matchText = match.metadata.text.toLowerCase()
      const searchTerms = keyTerms.split(' ').filter(term => term.length > 2)
      
      // Calculate term match score
      let termMatchCount = 0
      searchTerms.forEach(term => {
        if (matchText.includes(term.toLowerCase())) {
          termMatchCount++
        }
      })
      const termMatchScore = termMatchCount / searchTerms.length
  
      // Score calculation:
      // - Exact phrase match: 1.0
      // - All terms match but not as phrase: 0.9
      // - Partial term matches: proportional to matched terms
      // - Semantic similarity: original score if no term matches
      let score = match.score // Start with semantic similarity
      
      if (matchText.includes(keyTerms.toLowerCase())) {
        score = 1.0 // Exact phrase match
      } else if (termMatchScore === 1) {
        score = 0.9 // All terms match but not as phrase
      } else if (termMatchScore > 0) {
        score = Math.max(0.5 + (termMatchScore * 0.3), match.score)
      }
  
      return {
        ...match,
        score,
        debugInfo: {
          termMatchScore,
          originalScore: match.score,
          matchedTerms: searchTerms.filter(term => matchText.includes(term.toLowerCase()))
        }
      }
    })
  
    // Sort and filter results
    const sortedResults = processedResults
      .sort((a, b) => b.score - a.score)
      .filter(match => {
        // Must have either:
        // 1. At least one matching term and score >= 0.5
        // 2. High semantic similarity (>= 0.7) even without term matches
        return (
          (match.debugInfo.termMatchScore > 0 && match.score >= 0.5) ||
          match.originalScore >= 0.7
        )
      })
      .slice(0, limit)
  
    return sortedResults
}
  

// --- Simplified Store Page Embeddings Function ---
export async function storePageEmbeddings(text, pageNumber, metadata) {
    try {
        console.log('\n=== Processing Complete Page ===')
        console.log('Checking embeddings for:', {
            documentId: metadata.documentId,
            pageNumber: pageNumber,
            textLength: text.length
        })
        
        const stored = await storeEmbedding(text, {
            pageNumber,
            documentId: metadata.documentId,
            pdfName: metadata.pdfName
        })

        if (stored === false) {
            console.log('Page already processed:', {
                documentId: metadata.documentId,
                pageNumber: pageNumber
            })
            return false
        }

        return true
    } catch (error) {
        console.error('Error storing embeddings:', error)
        throw error
    }
}

// Add new function to store entire document
export async function storeDocumentEmbeddings(pages, metadata) {
    if (!index) {
        throw new Error('Pinecone index not initialized')
    }

    // Check if document already exists
    try {
        const existingResults = await index.query({
            vector: Array(768).fill(0),
            topK: 1,
            filter: {
                documentId: { $eq: metadata.documentId }
            },
            includeMetadata: true
        })

        if (existingResults.matches && existingResults.matches.length > 0) {
            console.log('Document already exists:', {
                documentId: metadata.documentId,
                existingId: existingResults.matches[0].id
            })
            return false
        }

        console.log('Processing new document:', {
            documentId: metadata.documentId,
            totalPages: pages.length
        })

        // Process all pages
        const embeddings = []
        let globalChunkIndex = 0

        for (const page of pages) {
            const chunks = splitIntoChunks(page.text)
            
            if (chunks.length === 0) continue

            // Create embeddings for each chunk in the page
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i]
                const embedding = await createEmbedding(chunk.text)

                const id = `${metadata.documentId}-${page.pageNumber}-${i}-${Date.now()}`
                
                embeddings.push({
                    id,
                    values: embedding,
                    metadata: {
                        ...metadata,
                        text: chunk.text,
                        pageNumber: page.pageNumber,
                        chunkIndex: globalChunkIndex,
                        totalChunks: chunks.length,
                        sentences: chunk.sentences,
                        timestamp: Date.now()
                    }
                })

                globalChunkIndex++
            }
        }

        // Store all chunks at once
        await index.upsert(embeddings)
        console.log('Successfully stored document embeddings:', {
            documentId: metadata.documentId,
            totalEmbeddings: embeddings.length,
            totalPages: pages.length
        })

        return true
    } catch (error) {
        console.error('Error storing document embeddings:', error)
        throw error
    }
}