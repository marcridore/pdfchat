import { findSimilar } from '@/app/lib/embeddings'

export async function POST(request) {
  try {
    const { question } = await request.json()

    // Get similar passages for context
    const similarPassages = await findSimilar(question, 3) // Get top 3 most similar passages

    // Construct prompt with context
    const context = similarPassages
      .map(match => match.metadata.text)
      .join('\n\n')

    const prompt = `You are a helpful assistant answering questions about a PDF document. 
Use the following relevant passages from the document to answer the question.
If you cannot answer the question based on the provided passages, say so.

Relevant passages:
${context}

Question: ${question}

Answer:`

    // Call Together AI for chat completion
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions about PDF documents based on provided context.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get chat response')
    }

    const data = await response.json()
    return Response.json({
      answer: data.choices[0].message.content,
      context: similarPassages
    })
  } catch (error) {
    console.error('Chat error:', error)
    return Response.json({ error: 'Failed to process chat request' }, { status: 500 })
  }
} 