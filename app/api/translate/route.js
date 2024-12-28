import { Together } from 'together-ai'


// Initialize Together client with error handling
const initializeTogether = () => {
  const apiKey = process.env.TOGETHER_API_KEY 
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY  is not defined in environment variables')
  }
  return new Together(apiKey)
}

export async function POST(request) {
  try {
    const together = initializeTogether()
    const { text, targetLanguage } = await request.json()
    


    const response = await together.chat.completions.create({
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        {
          role: "system",
          content: `You are a translator. Translate the text to ${targetLanguage}. Only respond with the translation, nothing else.`
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

    const translatedText = response.choices[0].message.content.trim()

    return Response.json({ translatedText })
  } catch (error) {
    console.error('Translation error:', error)
    return Response.json(
      { error: error.message || 'Translation failed' },
      { status: 500 }
    )
  }
} 