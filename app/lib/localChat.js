import { clientLocalStore } from './clientLocalStore'

const getLLMResponse = async (prompt) => {
  const completion = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_TOGETHER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    })
  })

  if (!completion.ok) {
    throw new Error('Failed to get chat response')
  }

  const result = await completion.json()
  return result.choices[0].message.content
}

function calculateCosineSimilarity(vecA, vecB) {
  // Dot product
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  
  // Magnitudes
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  
  // Cosine similarity
  return dotProduct / (magA * magB)
}

export async function findSimilarPassages(queryVector, threshold = 0.3) {
  const results = await localVectorStore.searchSimilar(queryVector)
  
  // Filter and sort by actual similarity
  return results
    .filter(result => result.similarity > threshold)
    .sort((a, b) => b.similarity - a.similarity)
}

export async function handleLocalChat(message) {
  try {
    // Ensure client store is initialized
    if (!clientLocalStore.isReady()) {
      console.log('Initializing client store before chat...')
      await clientLocalStore.init()
    }

    // Search for relevant context in local vector store
    console.log('Searching local vectors for:', message)
    const results = await clientLocalStore.searchSimilar(message, 3)
    
    if (!results || results.length === 0) {
      console.log('No local results found')
      return {
        response: "I couldn't find any relevant information in the local storage for your question.",
        context: []
      }
    }

    const relevantContext = results.map(result => ({
      text: result.metadata.text,
      page: result.metadata.pageNumber,
      score: result.similarity,
      fileName: result.metadata.pdfName
    }))

    console.log('Found local context:', relevantContext.length, 'results')

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
      1. If there's relevant context, use it to answer the question
      2. If no relevant context is found, clearly state that
      3. Always cite your sources with page numbers
      4. Be concise but informative
    `.trim()

    // Get LLM response
    const response = await getLLMResponse(prompt)

    return {
      response,
      context: relevantContext
    }
  } catch (error) {
    console.error('Local chat error:', error)
    throw new Error('Failed to process local chat: ' + error.message)
  }
} 