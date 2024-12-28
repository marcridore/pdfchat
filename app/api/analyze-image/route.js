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
    const { imageData } = await request.json()

    if (!imageData) {
      throw new Error('No image data provided')
    }

    const response = await together.chat.completions.create({
      model: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a knowledgeable literature professor. Please analyze this text and provide:

1. Content Understanding:
   - Detailed explanation of the main ideas and themes
   - Analysis of the key arguments or narrative elements
   - Interpretation of complex concepts or metaphors
   - Summary of important points or plot developments
   - Explanation of any difficult or archaic language

2. Academic Context:
   - Historical and cultural background
   - Literary or theoretical framework
   - Connection to broader intellectual movements
   - Influence on later works or thought

3. Visual Elements (if relevant):
   - Page layout and structure
   - Text organization and formatting
   - Any diagrams, figures, or visual aids
   - Document type and era

4. Further Reading:
   - Related works and authors
   - Recommended secondary sources
   - Similar themes in other texts

Please focus primarily on explaining the content in a clear, accessible way while providing deeper insights into its meaning and significance.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    if (!response.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from TogetherAI')
    }

    const analysis = response.choices[0].message.content.trim()
    return Response.json({ analysis })
  } catch (error) {
    console.error('Image analysis error:', error)
    return Response.json(
      { error: error.message || 'Image analysis failed' },
      { status: 500 }
    )
  }
} 