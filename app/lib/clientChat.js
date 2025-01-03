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

    // 3. Combine and Re-rank Results
    const combined = new Map()

    // Add exact matches first with boosted scores (but normalized to 0-1 range)
    exactMatches.forEach(match => {
      combined.set(match.text, {
        ...match,
        similarity: Math.min(1.0, match.score * 1.2) // Cap at 1.0 and use lower boost
      })
    })

    // Add or update with semantic matches
    semanticResults.forEach(match => {
      if (combined.has(match.text)) {
        // If exists, take the higher score but ensure it's normalized
        const existing = combined.get(match.text)
        existing.similarity = Math.min(1.0, Math.max(existing.similarity, match.similarity))
      } else {
        combined.set(match.text, match)
      }
    })

    // Convert to array and sort by normalized scores
    const results = Array.from(combined.values())
      .map(result => ({
        ...result,
        similarity: Math.min(1.0, result.similarity) // Ensure all scores are <= 1.0
      }))
      .sort((a, b) => b.similarity - a.similarity)

    console.log('Combined search results:', {
      total: results.length,
      topResults: results.slice(0, 3).map(r => ({
        text: r.text.substring(0, 50),
        score: (r.similarity * 100).toFixed(1) + '%'
      }))
    })

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
      topScore: results[0]?.similarity || 0
    })
    
    if (!results || results.length === 0) {
      console.log('No relevant context found in local storage')
      return {
        response: "I couldn't find any relevant information in the local storage for your question.",
        context: []
      }
    }

    // Filter by similarity threshold
    const relevantResults = results.filter(r => r.similarity > 0.01)
    
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
      score: result.similarity,
      fileName: result.pdfName // Changed from result.metadata.pdfName
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
        [Source: ${r.fileName}, Page ${r.page}, Score: ${Math.min(100, (r.score * 100)).toFixed(1)}%]
        "${r.text}"
      `).join('\n\n')}

      Instructions:
      1. If you find a direct statement about the subject in a high-scoring passage (>70%), state that information clearly
      2. Even if the information is brief, it is still valid information - don't say there is no information
      3. Always cite your sources with page numbers
      4. Be direct and factual
      5. Don't contradict yourself or the source material
      6. Prioritize information from passages with higher relevance scores
      7. Consider semantic relationships and variations:
         - Name variations (e.g., "Sam" vs "Samuel", "Mr. Walton" vs "Walton")
         - Informal references (e.g., "the founder", "the businessman")
         - Title variations (e.g., "CEO", "founder", "leader")
         - Common misspellings or typos in names
         - Relationship terms (e.g., "his wife" refers to "Helen Robson")
      8. When answering:
         - Use the person's full name at least once in the response
         - Maintain consistent name usage throughout
         - Include titles or roles when relevant
         - Correct any name misspellings in the query while answering
         - Connect family relationships when mentioned
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