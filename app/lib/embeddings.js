import { Pinecone } from '@pinecone-database/pinecone'

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
})

const INDEX_NAME = 'pdf-embeddings'
const DIMENSION = 768 // dimension for m2-bert-80M-32k-retrieval model

// Function to create index if it doesn't exist
async function getOrCreateIndex() {
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

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY
const TOGETHER_API_URL = 'https://api.together.xyz/v1'

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

// Add text chunking utilities
function splitIntoSentences(text) {
  // More comprehensive sentence splitting
  const sentenceRegex = /[^.!?]+[.!?]+/g
  const sentences = text.match(sentenceRegex) || [text]
  
  // Clean up sentences but with less strict filtering
  return sentences.map(sentence => 
    sentence.trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
  ).filter(sentence => 
    sentence.length > 0 // Just check if there's any content
  )
}

function splitIntoChunks(text, maxChunkLength = 300) {
  if (!text || text.trim().length === 0) {
    return []
  }

  // First try to split into sentences
  let sentences = splitIntoSentences(text)
  
  // If no sentences found, use the original text
  if (sentences.length === 0) {
    sentences = [text.trim()]
  }

  const chunks = []
  let currentChunk = ''
  let currentChunkSentences = []

  for (const sentence of sentences) {
    // If single sentence is longer than maxChunkLength, split it into words
    if (sentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          sentences: currentChunkSentences
        })
        currentChunk = ''
        currentChunkSentences = []
      }
      
      // Split long sentence into smaller chunks
      const words = sentence.split(' ')
      let tempChunk = ''
      
      for (const word of words) {
        if ((tempChunk + ' ' + word).length <= maxChunkLength) {
          tempChunk += (tempChunk ? ' ' : '') + word
        } else {
          if (tempChunk) {
            chunks.push({
              text: tempChunk.trim(),
              sentences: [tempChunk.trim()]
            })
          }
          tempChunk = word
        }
      }
      
      if (tempChunk) {
        currentChunk = tempChunk
        currentChunkSentences = [tempChunk]
      }
    } else if ((currentChunk + ' ' + sentence).length <= maxChunkLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence
      currentChunkSentences.push(sentence)
    } else {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          sentences: currentChunkSentences
        })
      }
      currentChunk = sentence
      currentChunkSentences = [sentence]
    }
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      sentences: currentChunkSentences
    })
  }

  // Final validation
  return chunks.filter(chunk => chunk.text.length > 0)
}

export async function storeEmbedding(text, metadata) {
  if (!index) {
    throw new Error('Pinecone index not initialized')
  }

  // Split text into chunks
  const chunks = splitIntoChunks(text)
  
  // Validate we have chunks to store
  if (chunks.length === 0) {
    return // Exit early instead of throwing error
  }

  const embeddings = []

  // Create embeddings for each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const embedding = await createEmbedding(chunk.text)
    
    const id = `${metadata.id}-${i}`

    embeddings.push({
      id,
      values: embedding,
      metadata: {
        ...metadata,
        text: chunk.text,
        chunkIndex: i,
        totalChunks: chunks.length,
        sentences: chunk.sentences
      }
    })
  }

  // Store all chunks
  await index.upsert(embeddings)
}

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