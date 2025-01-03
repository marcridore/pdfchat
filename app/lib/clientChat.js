import { clientLocalStore } from './clientLocalStore'
import { TFIDF_PARAMS } from './localVectorStore'

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
    
    // 1. TF-IDF based keyword search
    const keywordResults = await clientLocalStore.searchByKeyword(query)
    console.log('TF-IDF matches:', keywordResults.map(m => ({
      text: m.text.substring(0, 50),
      score: m.score,
      exactMatch: m.exactMatchScore
    })))

    // 2. Semantic Search
    const semanticResults = await clientLocalStore.searchSimilar(query, 5, 0.1)
    console.log('Semantic matches:', {
      count: semanticResults.length,
      matches: semanticResults.map(m => ({
        text: m.text.substring(0, 50),
        similarity: m.similarity
      }))
    })

    // 3. Combine and Re-rank with weighted scores
    const combined = new Map()

    // Add TF-IDF matches
    keywordResults.forEach(match => {
      combined.set(match.text, {
        ...match,
        finalScore: match.exactMatchScore > 0.8 ? 
          match.score * TFIDF_PARAMS.keywordWeight : // Full weight for good matches
          match.score * TFIDF_PARAMS.keywordWeight * 0.5, // Half weight for fuzzy matches
        matchType: 'keyword',
        originalScore: match.score,
        exactMatch: match.exactMatchScore
      })
    })

    // Add semantic matches with weighted scores
    semanticResults.forEach(match => {
      if (combined.has(match.text)) {
        // Combine scores if exists in both
        const existing = combined.get(match.text)
        const semanticScore = match.similarity * TFIDF_PARAMS.semanticWeight
        existing.finalScore = Math.min(1.0, existing.finalScore + semanticScore)
      } else {
        combined.set(match.text, {
          ...match,
          finalScore: match.similarity * TFIDF_PARAMS.semanticWeight,
          matchType: 'semantic'
        })
      }
    })

    // Sort by combined scores
    const results = Array.from(combined.values())
      .sort((a, b) => b.finalScore - a.finalScore)

    console.log('Hybrid search results:', results.map(r => ({
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

    // Map results to context format with proper score handling
    const relevantContext = relevantResults.map(result => {
      // Ensure score is a valid number
      const score = typeof result.finalScore === 'number' && !isNaN(result.finalScore) 
        ? result.finalScore 
        : result.score || result.similarity || 0

      return {
        text: result.text,
        page: result.pageNumber,
        score: Math.min(1.0, Math.max(0, score)), // Clamp between 0 and 1
        fileName: result.pdfName,
        matchType: result.matchType
      }
    })

    // Debug scores
    console.log('Context scores:', relevantContext.map(c => ({
      score: c.score,
      text: c.text.substring(0, 50)
    })))

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
        [Source: ${r.fileName}, Page ${r.page}, Score: ${(r.score * 100).toFixed(1)}%, Match Type: ${r.matchType}]
        "${r.text}"
      `).join('\n\n')}

      Instructions:
      1. ALWAYS start with information from the highest scoring passage first (>70%)
      2. For name-related queries:
         - If the query appears to be a misspelled name, mention the correct spelling first
         - Example: "You asked about 'morc rudore' - the correct name is 'Marc Ridore'"
         - Then provide the available information about that person
      3. Include semantic matches only as supporting information
      4. Be direct and factual
      5. Don't mention NaN or undefined scores in the response
      6. When answering:
         - Start with name correction if applicable
         - Then provide the most relevant information
         - Maintain proper context from the original passages
         - Use proper capitalization for names
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