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
    const { text } = await request.json()

    const response = await together.chat.completions.create({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable academic assistant. When given a text passage:
1. Provide a clear explanation of the main ideas
2. Mention 2-3 other authors or works that discuss similar themes
3. Highlight any key concepts or terminology
Please format your response in clear sections.`
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

    const analysis = response.choices[0].message.content.trim()
    return Response.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    return Response.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    )
  }
} 