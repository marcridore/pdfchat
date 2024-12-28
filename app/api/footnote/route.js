import { Together } from 'together-ai'

const initializeTogether = () => {
  const apiKey = process.env.TOGETHER_API_KEY
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY is not defined in environment variables')
  }
  return new Together(apiKey)
}

export async function POST(request) {
  try {
    const together = initializeTogether()
    const { text, context } = await request.json()

    const response = await together.chat.completions.create({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable assistant providing concise, contextual footnotes. When given a text selection:
1. Provide a brief explanation (1-2 sentences)
2. Include relevant context (historical, literary, or conceptual)
3. Mention related concepts or terms
4. If applicable, note connections to other parts of the text

Keep responses concise and focused. Format in clear sections.`
        },
        {
          role: "user",
          content: `Text: "${text}"
${context ? `Context: ${context}` : ''}`
        }
      ],
      temperature: 0.7,
      max_tokens: 200, // Keep it concise
    })

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from TogetherAI')
    }

    const footnote = response.choices[0].message.content.trim()
    return Response.json({ footnote })
  } catch (error) {
    console.error('Footnote error:', error)
    return Response.json(
      { error: error.message || 'Footnote generation failed' },
      { status: 500 }
    )
  }
} 