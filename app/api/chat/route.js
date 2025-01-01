import { findSimilar } from '@/app/lib/embeddings'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { question } = await req.json()

    // First find relevant context using similarity search
    const similar = await findSimilar(question, 3)

    // Log the results for debugging
    console.log('Chat context search:', {
      question,
      results: similar.map(s => ({
        score: s.score,
        text: s.metadata.text.substring(0, 50) + '...',
        page: s.metadata.pageNumber,
        pdfName: s.metadata.pdfName
      }))
    })

    // Use all relevant context, not filtered by current document
    const context = similar.map(match => ({
      text: match.metadata.text,
      page: match.metadata.pageNumber,
      score: match.score,
      pdfName: match.metadata.pdfName
    }))

    if (context.length === 0) {
      return NextResponse.json({
        answer: "I don't have any relevant information about that in the provided documents. I can only answer questions based on the content of the documents you've uploaded.",
        context: []
      })
    }

    // Create prompt for LLM
    const prompt = `
      You are a helpful AI assistant answering questions about PDF documents.
      Answer the following question using ONLY the provided context.
      Each question should be treated independently - do not refer to previous questions or assume continuity.
      If the information isn't in the context, say you don't have that information.

      Important:
      - Treat each question as a fresh query
      - Don't assume relationships between different documents
      - Be specific about which file and page you're referencing
      - If a question seems unrelated to previous context, that's fine - just answer based on what's relevant

      Context:
      ${context.map(ctx => `[File: ${ctx.pdfName}, Page ${ctx.page}]: ${ctx.text}`).join('\n\n')}

      Question: ${question}

      Please provide a clear and informative answer based solely on the context provided.
      Include both file names and page numbers in your response when referencing information.
      If the question seems unrelated to previous topics, acknowledge the topic change in your response.
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
        messages: [{ 
          role: 'user', 
          content: prompt 
        }],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!completion.ok) {
      throw new Error('Failed to get LLM response')
    }

    const result = await completion.json()
    const answer = result.choices[0].message.content

    return NextResponse.json({ 
      answer,
      context 
    })

  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
} 