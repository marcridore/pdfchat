import { NextResponse } from 'next/server'
import { findSimilar } from '@/app/lib/embeddings'

export async function POST(req) {
  try {
    const { 
      question, 
      pdfName,
      messages = [], 
      previousContext = [] 
    } = await req.json()

    // Get similar passages using the imported function
    const similar = await findSimilar(question)

    // Combine previous and new context with deduplication
    const contextMap = new Map()
    
    // Add previous context
    previousContext.forEach(ctx => {
      const key = `${ctx.page}-${ctx.document}`
      contextMap.set(key, ctx)
    })
    
    // Add new context with deduplication
    similar.forEach(s => {
      const key = `${s.metadata.pageNumber}-${s.metadata.pdfName}`
      if (!contextMap.has(key) || s.score > contextMap.get(key).similarity / 100) {
        contextMap.set(key, {
          text: s.metadata.text,
          page: s.metadata.pageNumber,
          document: s.metadata.pdfName,
          similarity: (s.score * 100).toFixed(1)
        })
      }
    })
    
    const allContext = Array.from(contextMap.values())
      .sort((a, b) => b.similarity - a.similarity)

    // Build conversation history
    const conversationHistory = messages.map(msg => 
      `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n')

    // Create prompt with context and history
    const prompt = `
      You are a helpful AI assistant answering questions about PDF documents.
      
      Previous conversation:
      ${conversationHistory}
      
      Context from the document:
      ${allContext.map(ctx => 
        `[From ${ctx.document} Page ${ctx.page}]:\n${ctx.text}`
      ).join('\n\n')}
      
      Human: ${question}
      
      Assistant: Please answer based on the context provided above. 
      If you cite information from the context, refer to the exact document and page number 
      as shown in the [From...] headers above. Do not make assumptions about page numbers 
      that aren't explicitly provided in the context.
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
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!completion.ok) {
      const error = await completion.json()
      console.error('LLM API error:', error)
      throw new Error('Failed to get response from LLM')
    }

    const result = await completion.json()

    if (!result.choices?.[0]?.message?.content) {
      console.error('Invalid LLM response:', result)
      throw new Error('Invalid response format from LLM')
    }

    const answer = result.choices[0].message.content

    return NextResponse.json({ 
      answer,
      context: allContext
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' }, 
      { status: 500 }
    )
  }
} 