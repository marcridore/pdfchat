import { clientLocalStore } from './clientLocalStore'

async function getEmbedding(text) {
  // Normalize text before getting embedding
  const normalizedText = text
    .toLowerCase()
    // Remove special characters and extra spaces
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  console.log('Getting embedding for normalized text:', {
    original: text,
    normalized: normalizedText
  })

  const response = await fetch('/api/embedding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: normalizedText })
  })

  if (!response.ok) {
    throw new Error('Failed to create embedding')
  }

  const { embedding } = await response.json()
  return embedding
}

async function getLLMResponse(prompt) {
  const response = await fetch('/api/chat/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get chat response')
  }

  const result = await response.json()
  return result.response
}

export async function handleClientChat(message) {
  try {
    console.log('Starting client-side chat process...')
    
    // Clean up the query - just remove question prefixes and normalize
    const cleanQuery = message.toLowerCase()
      .replace(/^(who|what|where|when|why|how) (is|are|was|were) /, '')
      .trim()
    
    console.log('Processed query:', {
      original: message,
      cleaned: cleanQuery
    })

    // Ensure store is initialized
    await clientLocalStore.ensureInitialized()
    console.log('Local store initialization confirmed')

    // Get embedding from server
    console.log('Getting embedding for query:', cleanQuery)
    const queryVector = await getEmbedding(cleanQuery)
    console.log('Received embedding from server')
    
    // Use embedding for local search with even more permissive threshold for names
    console.log('Searching local vectors with embedding...')
    const results = await clientLocalStore.searchSimilar(cleanQuery, queryVector, 5, 0.05)
    console.log('Local search complete:', {
      resultsFound: results?.length || 0,
      topScore: results[0]?.similarity || 0
    })
    
    if (!results || results.length === 0) {
      console.log('No relevant context found in local storage')
      return {
        response: "I couldn't find any relevant information in the local storage for your question.",
        context: []
      }
    }

    // Filter by more permissive similarity threshold for names
    const relevantResults = results.filter(r => {
      // Keep results with decent similarity
      if (r.similarity > 0.05) {
        return true
      }
      return false
    })
    
    if (relevantResults.length === 0) {
      console.log('No results above similarity threshold')
      return {
        response: "While I found some content, none of it seems directly relevant to your question.",
        context: []
      }
    }

    const relevantContext = relevantResults.map(result => ({
      text: result.metadata.text,
      page: result.metadata.pageNumber,
      score: result.similarity,
      fileName: result.metadata.pdfName
    }))

    console.log('Processing local context:', {
      contextCount: relevantContext.length,
      topScore: relevantContext[0]?.score,
      texts: relevantContext.map(c => ({
        text: c.text.substring(0, 50) + '...',
        score: c.score
      }))
    })

    // Create prompt with context
    const prompt = `
      You are a helpful AI assistant analyzing document content. Please provide a clear, direct answer 
      based on the following context passages, which are ordered by relevance score.

      Question: "${message}"

      Context passages:
      ${relevantContext.map(r => `
        [Source: ${r.fileName}, Page ${r.page}, Score: ${(r.score * 100).toFixed(1)}%]
        "${r.text}"
      `).join('\n\n')}

      Instructions:
      1. If you find a direct statement about the subject in a high-scoring passage (>90%), state that information clearly
      2. Even if the information is brief, it is still valid information - don't say there is no information
      3. Always cite your sources with page numbers
      4. Be direct and factual
      5. Don't contradict yourself or the source material

      Example:
      - Bad: "The context does not contain information about X" when there is a 100% match stating a fact about X
      - Good: "According to [source], X is Y" when there is a matching statement
    `.trim()

    // Get LLM response
    console.log('Getting LLM response...')
    const response = await getLLMResponse(prompt)
    console.log('Received LLM response')

    return {
      response,
      context: relevantContext
    }
  } catch (error) {
    console.error('Client chat error:', error)
    throw error
  }
} 