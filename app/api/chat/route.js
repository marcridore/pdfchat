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

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // Always do similarity search first for the current question
    const currentResults = await findSimilar(question)
    
    // Process current search results
    const newContext = currentResults
      .filter(match => match.exactPhraseMatch || match.score > 0.7)
      .slice(0, 2)
      .map(match => ({
        text: match.metadata.text,
        page: match.metadata.pageNumber,
        document: match.metadata.pdfName,
        similarity: (match.score * 100).toFixed(1),
        isNewSearch: true
      }))

    // Get recent context from conversation history
    const historicalContext = previousContext
      .slice(-3)
      .map(ctx => ({
        ...ctx,
        isNewSearch: false
      }))

    // If no context available at all, return early
    if (newContext.length === 0 && historicalContext.length === 0) {
      return NextResponse.json({
        answer: "I don't have any relevant information about that in the provided documents. I can only answer questions based on the content of the documents you've uploaded.",
        context: [],
        newSearchResults: false,
        usedHistoricalContext: false
      })
    }

    // Create a more restrictive prompt
    const prompt = `
      You are a helpful AI assistant answering questions about PDF documents. You must ONLY use information from the provided context. Do not use any external knowledge.
      
      Previous conversation:
      ${messages.map((msg, i) => {
        if (msg.role === 'assistant' && msg.context) {
          const docs = [...new Set(msg.context.map(c => c.document))].join(', ')
          return `Assistant (referring to ${docs}): ${msg.content}`
        }
        return `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
      }).join('\n')}
      
      Available context from documents:
      ${newContext.length > 0 ? 
        `New search results for "${question}":\n${newContext.map(ctx => 
          `[From ${ctx.document} Page ${ctx.page}]:\n${ctx.text}`
        ).join('\n\n')}`
        : 'No direct matches found in documents for current question.'
      }
      
      ${historicalContext.length > 0 ?
        `Previous context:\n${historicalContext.map(ctx => 
          `[From ${ctx.document} Page ${ctx.page}]:\n${ctx.text}`
        ).join('\n\n')}`
        : 'No relevant context from previous conversation.'
      }
      
      Human: ${question}
      
      Assistant: You must follow these rules strictly:
      1. ONLY use information explicitly stated in the context above
      2. If information isn't in the context, say "I don't have that information in the provided documents"
      3. Never use external knowledge even if you know the answer
      4. Always cite the specific document and page number for any information you provide
      5. If the question seems unrelated to available context, say so clearly
      
      Please provide your response based on these rules:
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
      return NextResponse.json(
        { error: 'Language model temporarily unavailable. Please try again.' },
        { status: 503 }
      )
    }

    const result = await completion.json()

    if (!result.choices?.[0]?.message?.content) {
      console.error('Invalid LLM response:', result)
      return NextResponse.json(
        { error: 'Invalid response from language model' },
        { status: 500 }
      )
    }

    const answer = result.choices[0].message.content

    return NextResponse.json({ 
      answer,
      context: [...newContext, ...historicalContext],
      newSearchResults: newContext.length > 0,
      usedHistoricalContext: historicalContext.length > 0
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Failed to process chat request',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    )
  }
} 