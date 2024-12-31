import { Together } from 'together-ai'

// Initialize Together client with error handling
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
    const { text } = await request.json()

    const response = await together.chat.completions.create({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        {
          role: "system",
          content: "You are a text summarizer. Provide a concise summary of the text. Focus on the key points and main ideas."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from TogetherAI')
    }

    const summary = response.choices[0].message.content.trim()

    return Response.json({ summary })
  } catch (error) {
    console.error('Summarization error:', error)
    return Response.json(
      { error: error.message || 'Summarization failed' },
      { status: 500 }
    )
  }
} 