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

    try {
        console.log('Creating new embedding for:', {
            pdfName: metadata.pdfName,
            pageNumber: metadata.pageNumber,
            textLength: text.length
        });

        const embedding = await createEmbedding(text);
        const id = `${metadata.documentId}-${metadata.pageNumber}-${Date.now()}`;

        await index.upsert([{
            id,
            values: embedding,
            metadata: {
                ...metadata,
                text,
                timestamp: Date.now()
            }
        }]);

        console.log('Successfully stored embedding:', {
            id,
            pdfName: metadata.pdfName,
            pageNumber: metadata.pageNumber
        });

        return true;
    } catch (error) {
        console.error('Error storing embedding:', {
            error: error.message,
            metadata,
            stack: error.stack
        });
        throw error;
    }
}


// --- Function for Finding Similar Text ---
export async function findSimilar(text, limit = 5) {
    if (!index) {
      throw new Error('Pinecone index not initialized')
    }
    
    // Create embedding for search query
    const queryEmbedding = await createEmbedding(text)
    
    // Get ALL available results when dataset is small
    const results = await index.query({
      vector: queryEmbedding,
      topK: 10, // Get all records when we have a small dataset
      includeMetadata: true
    })

    if (!results.matches || results.matches.length === 0) {
      return []
    }

    // Post-process results with much stricter filtering for small datasets
    const processedResults = results.matches
      .map(match => {
        const matchText = match.metadata.text.toLowerCase()
        const searchText = text.toLowerCase()
        
        // Calculate text matching score
        let textMatchScore = 0
        let exactPhraseMatch = false
        
        // First check for exact phrase match
        if (matchText.includes(searchText)) {
          textMatchScore = 1.0
          exactPhraseMatch = true
        } else {
          // Check for individual terms
          const searchTerms = searchText.split(' ')
            .filter(term => term.length > 2)
            .sort((a, b) => b.length - a.length)
          
          const matchedTerms = searchTerms.map(term => {
            const termIndex = matchText.indexOf(term)
            if (termIndex === -1) return null
            
            // Check if it's a whole word match
            const beforeChar = termIndex > 0 ? matchText[termIndex - 1] : ' '
            const afterChar = termIndex + term.length < matchText.length ? 
              matchText[termIndex + term.length] : ' '
            
            if (/\W/.test(beforeChar) && /\W/.test(afterChar)) {
              return { term, index: termIndex }
            }
            return null
          }).filter(Boolean)
          
          if (matchedTerms.length > 0) {
            // Calculate proximity score
            const positions = matchedTerms.map(m => m.index)
            const maxDistance = Math.max(...positions) - Math.min(...positions)
            const proximityScore = maxDistance < 50 ? 1.0 : 
                                 maxDistance < 100 ? 0.8 : 0.5
            
            textMatchScore = (matchedTerms.length / searchTerms.length) * proximityScore
          }
        }

        // For small datasets, heavily prioritize exact matches
        const combinedScore = exactPhraseMatch ? 
          1.0 : // Perfect score for exact matches
          (match.score * 0.1) + (textMatchScore * 0.9) // Almost completely ignore semantic similarity

        return {
          ...match,
          score: combinedScore,
          textMatchScore,
          exactPhraseMatch
        }
      })
      .filter(match => {
        // For small datasets, only return exact matches or very strong term matches
        if (match.exactPhraseMatch) return true
        
        // If no exact matches, require at least one search term to be present as a whole word
        const searchTerms = text.toLowerCase().split(' ').filter(term => term.length > 2)
        return searchTerms.some(term => {
          const termIndex = match.metadata.text.toLowerCase().indexOf(term)
          if (termIndex === -1) return false
          
          const beforeChar = termIndex > 0 ? match.metadata.text[termIndex - 1] : ' '
          const afterChar = termIndex + term.length < match.metadata.text.length ? 
            match.metadata.text[termIndex + term.length] : ' '
          
          return /\W/.test(beforeChar) && /\W/.test(afterChar)
        })
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return processedResults
}
  

// --- Simplified Store Page Embeddings Function ---
// Add a delay utility function
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add a function to wait for document to be indexed
async function waitForDocumentIndexing(pdfName, maxAttempts = 5) {
    for (let i = 0; i < maxAttempts; i++) {
        console.log(`Checking document indexing (attempt ${i + 1}/${maxAttempts}):`, {
            pdfName,
            timestamp: Date.now()
        });

        const results = await index.query({
            vector: Array(768).fill(0),
            topK: 1,
            filter: {
                pdfName: { $eq: pdfName }
            },
            includeMetadata: true
        });

        if (results.matches && results.matches.length > 0) {
            console.log('Document found in index:', {
                pdfName,
                attempt: i + 1,
                matches: results.matches.length
            });
            return true;
        }

        // Wait before next attempt (increasing delay)
        await wait(1000 * (i + 1));
    }
    return false;
}

// Update storePageEmbeddings to use a lock mechanism
const processingDocuments = new Set();

export async function storePageEmbeddings(text, pageNumber, metadata) {
    try {
        const { pdfName } = metadata;

        // Store the embedding without rechecking document existence
        // (we already checked at the document level)
        const stored = await storeEmbedding(text, {
            pageNumber,
            documentId: metadata.documentId,
            pdfName: metadata.pdfName
        });

        return stored;
    } catch (error) {
        console.error('Error storing embeddings:', error);
        throw error;
    }
}

// Add new function to store entire document
export async function storeDocumentEmbeddings(pages, metadata) {
    if (!index) {
        throw new Error('Pinecone index not initialized')
    }

    try {
        // Check if document already exists by name
        const documentExists = await checkDocumentByName(metadata.pdfName)
        if (documentExists) {
            console.log('Document already exists in Pinecone:', {
                pdfName: metadata.pdfName
            })
            return false
        }

        console.log('Processing new document:', {
            documentId: metadata.documentId,
            pdfName: metadata.pdfName,
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
            pdfName: metadata.pdfName,
            totalEmbeddings: embeddings.length,
            totalPages: pages.length
        })

        return true
    } catch (error) {
        console.error('Error storing document embeddings:', error)
        throw error
    }
}

// Add a function to check if document exists in Pinecone
export async function checkDocumentExists(documentId, pageNumber) {
    if (!index) {
        throw new Error('Pinecone index not initialized')
    }

    try {
        // Query Pinecone with a zero vector but use metadata filter
        const results = await index.query({
            vector: Array(768).fill(0), // Dummy vector
            topK: 1,
            filter: {
                documentId: { $eq: documentId },
                pageNumber: { $eq: pageNumber }
            },
            includeMetadata: true
        })

        return results.matches && results.matches.length > 0
    } catch (error) {
        console.error('Error checking document existence:', error)
        return false
    }
}

// Add function to check if document exists by name
export async function checkDocumentByName(pdfName) {
    if (!index) {
        throw new Error('Pinecone index not initialized')
    }

    try {
        console.log('Checking document by name in Pinecone:', {
            pdfName,
            timestamp: Date.now()
        })

        // Query Pinecone with a zero vector but use metadata filter for pdfName
        const results = await index.query({
            vector: Array(768).fill(0),
            topK: 10, // Increase to check for multiple matches
            filter: {
                pdfName: { $eq: pdfName }
            },
            includeMetadata: true
        })

        const hasMatches = results.matches && results.matches.length > 0
        console.log('Pinecone document check results:', {
            pdfName,
            hasMatches,
            matchCount: results.matches?.length || 0,
            matches: results.matches?.map(match => ({
                id: match.id,
                metadata: match.metadata
            }))
        })

        return hasMatches
    } catch (error) {
        console.error('Error checking document in Pinecone:', {
            pdfName,
            error: error.message,
            stack: error.stack
        })
        return false
    }
}