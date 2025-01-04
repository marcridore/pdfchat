import { NextResponse } from 'next/server'
import { findSimilar } from '@/app/lib/embeddings'
import { researchService } from '@/app/lib/researchService'

export async function POST(req) {
  try {
    const { messages } = await req.json()
    const userMessage = messages[messages.length - 1]

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
    }

    // Get research results if needed - using searchArxiv instead of augmentResponse
    let researchContext = null
    try {
      const results = await researchService.searchArxiv(userMessage.content)
      if (results && results.length > 0) {
        researchContext = {
          type: 'research',
          content: results.map(r => ({
            title: r.title,
            summary: r.summary,
            authors: r.authors,
            link: r.link,
            published: r.published
          }))
        }
      }
    } catch (error) {
      console.error('Research augmentation failed:', error)
    }

    // Create prompt with both contexts
    const prompt = `
      You are a helpful AI assistant analyzing document content. Please provide a clear, direct answer 
      based on the following context passages and research results.

      Question: "${userMessage.content}"

      Document Context:
      ${relevantContext.map(r => `
        [Source: ${r.fileName}, Page ${r.page}, Score: ${(r.score * 100).toFixed(1)}%]
        "${r.text}"
      `).join('\n\n')}

      ${researchContext ? `
      Research Context:
      ${researchContext.content.map(r => `
        [Title: ${r.title}]
        ${r.summary}
        Source: ${r.link}
      `).join('\n\n')}
      ` : ''}

      Instructions:
      1. If there's relevant context, use it to answer the question
      2. If research results are available, incorporate them to provide additional context
      3. Always cite your sources with page numbers and research references
      4. Be concise but informative
    `.trim()

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
      context: relevantContext,
      research: researchContext
    })

  } catch (error) {
    console.error('Server chat error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process chat' 
    }, { status: 500 })
  }
} 