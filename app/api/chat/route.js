import { NextResponse } from 'next/server'
import { findSimilar } from '@/app/lib/embeddings'

export async function POST(req) {
  try {
    const { messages } = await req.json()
    const userMessage = messages[messages.length - 1]

    console.log('Server chat API received request:', {
      messageCount: messages.length,
      lastMessage: userMessage.content.substring(0, 50) + '...'
    })

    // Get relevant context from Pinecone
    let relevantContext = []
    try {
      console.log('Searching Pinecone for context...')
      const results = await findSimilar(userMessage.content, 3)
      relevantContext = results.map(result => ({
        text: result.metadata.text,
        page: result.metadata.pageNumber,
        score: result.score,
        fileName: result.metadata.pdfName
      }))
    } catch (error) {
      console.error('Error searching Pinecone:', error)
      return NextResponse.json({ 
        error: 'Failed to search Pinecone' 
      }, { status: 500 })
    }

    // Create prompt with context
    const prompt = `
      You are a helpful AI assistant analyzing document content. Please provide a clear, direct answer 
      based on the following context passages, which are ordered by relevance score.

      Question: "${userMessage.content}"

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

    try {
      // Get LLM response
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
      
      return NextResponse.json({ 
        response: result.choices[0].message.content,
        context: relevantContext
      })

    } catch (error) {
      console.error('Error getting LLM response:', error)
      return NextResponse.json({ 
        error: 'Failed to get AI response' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Server chat error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process chat' 
    }, { status: 500 })
  }
} 