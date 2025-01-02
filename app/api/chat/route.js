import { NextResponse } from 'next/server'
import { findSimilar } from '@/app/lib/embeddings'

export async function POST(req) {
  try {
    const { question, documentName } = await req.json()
    
    // Get similar passages using findSimilar
    const searchResults = await findSimilar(question, 3)
    
    // Sort results by similarity score and add confidence levels
    const sortedResults = searchResults
      .map(result => ({
        text: result.metadata.text,
        score: result.score,
        page: result.metadata.pageNumber,
        fileName: result.metadata.pdfName,
        confidence: result.score > 0.8 ? 'very high' :
                   result.score > 0.6 ? 'high' :
                   result.score > 0.4 ? 'moderate' :
                   'low'
      }))
      .sort((a, b) => b.score - a.score)

    const prompt = `
      You are a helpful AI assistant analyzing document content. Please provide a clear, direct answer 
      based on the following context passages, which are ordered by relevance score.

      Question: "${question}"

      Context passages (with confidence scores):
      ${sortedResults.map(r => `
        [Confidence: ${r.confidence} (${(r.score * 100).toFixed(1)}%), Source: ${r.fileName}, Page ${r.page}]
        "${r.text}"
      `).join('\n\n')}

      Instructions:
      1. If there's a very high confidence match (>80%), use that information directly and confidently
      2. For high confidence matches (60-80%), provide the information while noting it's from a reliable source
      3. For moderate matches (40-60%), include the information but express appropriate uncertainty
      4. For low confidence matches (<40%), either:
         - State that the information is not reliable enough to make claims
         - Or explain that better sources are needed
      5. Always cite your sources with page numbers
      6. If the context doesn't contain relevant information, clearly state that

      Please provide a direct, clear answer that accurately reflects the confidence level of the sources.
    `.trim()

    const completion = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
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
    const response = result.choices[0].message.content

    return NextResponse.json({ 
      response,
      context: sortedResults
    })

  } catch (error) {
    console.error('Error in chat:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
} 