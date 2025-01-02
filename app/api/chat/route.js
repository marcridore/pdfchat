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
        confidence: result.score > 0.7 ? 'high' :
                   result.score > 0.5 ? 'moderate' :
                   result.score > 0.3 ? 'low' : 'very low'
      }))
      .sort((a, b) => b.score - a.score)

    const prompt = `
      As a helpful AI assistant, analyze the following context and question.
      The context passages are ordered by relevance score, with higher scores indicating
      stronger relevance to the question. Each passage includes its source file and page number.

      Question: "${question}"

      Context from documents:
      ${sortedResults.map(r => `
        [Source: ${r.fileName}, Page ${r.page}, Relevance: ${r.confidence} (${(r.score * 100).toFixed(1)}%)]
        ${r.text}
      `).join('\n\n')}

      Please provide a response that:
      1. Prioritizes information from passages with higher relevance scores
      2. States confidence levels based on relevance scores
      3. Cites specific sources (file names and page numbers) when providing information
      4. Clearly distinguishes between high-confidence and low-confidence information
      5. Suggests what additional information might be needed

      Response format:
      - Lead with the most relevant information, citing sources
      - Indicate confidence levels and sources for different pieces of information
      - Use phrases like "According to [file], page [X]..." when citing sources
      - Be clear about which parts are most reliable based on relevance scores
      - Use professional language and maintain a helpful tone
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
        temperature: 0.7,
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