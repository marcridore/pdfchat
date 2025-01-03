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

async function searchLocalVectors(query, options = {}) {
  try {
    console.log('Starting hybrid search for:', query)
    
    // 1. Exact/Keyword Match with higher weight
    const exactMatches = await clientLocalStore.searchByKeyword(query)
    console.log('Keyword matches:', {
      count: exactMatches.length,
      matches: exactMatches.map(m => ({
        text: m.text.substring(0, 50),
        score: m.score
      }))
    })

    // 2. Semantic Search
    const semanticResults = await clientLocalStore.searchSimilar(query, 5, 0.1)
    console.log('Semantic matches:', {
      count: semanticResults.length,
      matches: semanticResults.map(m => ({
        text: m.text.substring(0, 50),
        similarity: m.similarity
      }))
    })

    // 3. Combine and Re-rank Results with proper normalization
    const combined = new Map()

    // Add exact matches first with proper normalization
    exactMatches.forEach(match => {
      combined.set(match.text, {
        ...match,
        finalScore: Math.min(1.0, match.score), // Normalize to max 1.0 before boost
        matchType: 'keyword'
      })
    })

    // Add semantic matches (already normalized to 0-1 range)
    semanticResults.forEach(match => {
      if (combined.has(match.text)) {
        // Take the higher score if exists in both
        const existing = combined.get(match.text)
        existing.finalScore = Math.min(1.0, Math.max(existing.finalScore, match.similarity))
      } else {
        combined.set(match.text, {
          ...match,
          finalScore: Math.min(1.0, match.similarity),
          matchType: 'semantic'
        })
      }
    })

    // Apply boosts after normalization
    const results = Array.from(combined.values())
      .map(result => ({
        ...result,
        finalScore: Math.min(1.0, result.finalScore * (result.matchType === 'keyword' ? 1.2 : 1.0))
      }))
      .sort((a, b) => b.finalScore - a.finalScore)

    console.log('Combined results:', results.map(r => ({
      text: r.text.substring(0, 50),
      score: r.finalScore,
      type: r.matchType
    })))

    return results
  } catch (error) {
    console.error('Error in hybrid search:', error)
    return []
  }
}

export async function handleClientChat(message) {
  try {
    console.log('Starting client-side chat process...')
    
    // Clean up the query
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
    
    // Search for similar content
    console.log('Searching local vectors with embedding...')
    const results = await searchLocalVectors(cleanQuery)
    console.log('Local search complete:', {
      resultsFound: results?.length || 0,
      topScore: results[0]?.finalScore || 0
    })
    
    if (!results || results.length === 0) {
      console.log('No relevant context found in local storage')
      return {
        response: "I couldn't find any relevant information in the local storage for your question.",
        context: []
      }
    }

    // Filter by similarity threshold
    const relevantResults = results.filter(r => r.finalScore > 0.01)
    
    if (relevantResults.length === 0) {
      console.log('No results above similarity threshold')
      return {
        response: "While I found some content, none of it seems directly relevant to your question.",
        context: []
      }
    }

    // Map results to context format - note the change in accessing text property
    const relevantContext = relevantResults.map(result => ({
      text: result.text, // Changed from result.metadata.text
      page: result.pageNumber, // Changed from result.metadata.pageNumber
      score: result.finalScore,
      fileName: result.pdfName, // Changed from result.metadata.pdfName
      matchType: result.matchType
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
        [Source: ${r.fileName}, Page ${r.page}, Score: ${(r.finalScore * 100).toFixed(1)}%, Match Type: ${r.matchType}]
        "${r.text}"
      `).join('\n\n')}

      Instructions:
      1. ALWAYS start with information from the highest scoring passage first (>70%)
      2. If the highest scoring passage is a keyword match, prioritize that information
      3. Include semantic matches only as supporting information
      4. Be direct and factual
      5. Don't contradict yourself or the source material
      6. When answering:
         - Start with the most relevant information (highest score)
         - Clearly indicate the source and score for key information
         - Maintain proper context from the original passages
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