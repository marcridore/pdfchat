import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { content, documentName } = await req.json()

    // Create prompt for Q&A generation
    const prompt = `
      You are a helpful AI tutor. Based on the following document content, 
      generate 3-5 question and answer pairs that would help a reader 
      understand the key points. For each question:
      1. Create a clear question
      2. Provide the correct answer
      3. Generate 2-3 helpful hints that guide the student without giving away the answer

      Document: ${documentName}
      Content: ${content}

      Respond in this JSON format:
      [
        {
          "question": "Clear question about the content?",
          "answer": "Complete answer to the question",
          "hints": [
            "First hint that gives a subtle clue",
            "Second hint that gives more direction",
            "Final hint that strongly suggests the answer"
          ]
        }
      ]

      Focus on key concepts and ensure hints progressively help without directly giving the answer.
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
        temperature: 0.3, // Lower temperature for more consistent formatting
        max_tokens: 1000
      })
    })

    if (!completion.ok) {
      throw new Error('Failed to get LLM response')
    }

    const result = await completion.json()
    const llmResponse = result.choices[0].message.content.trim()
    
    // Log the raw response for debugging
    console.log('Raw LLM response:', llmResponse)

    let qaItems
    try {
      // Try to parse the response as JSON
      qaItems = JSON.parse(llmResponse)
      
      // Validate the structure
      if (!Array.isArray(qaItems) || !qaItems.every(item => 
        item.question && 
        typeof item.question === 'string' && 
        item.answer && 
        typeof item.answer === 'string'
      )) {
        throw new Error('Invalid Q&A format')
      }
    } catch (error) {
      console.error('JSON parsing error:', error)
      console.log('Invalid content:', llmResponse)
      
      // Fallback: Try to extract Q&A pairs from text
      const fallbackQA = extractQAPairs(llmResponse)
      if (fallbackQA.length > 0) {
        qaItems = fallbackQA
      } else {
        throw new Error('Could not parse Q&A content')
      }
    }

    return NextResponse.json({ qaItems })

  } catch (error) {
    console.error('Error generating Q&A:', error)
    return NextResponse.json(
      { error: 'Failed to generate Q&A' },
      { status: 500 }
    )
  }
}

// Helper function to extract Q&A pairs from text if JSON parsing fails
function extractQAPairs(text) {
  const pairs = []
  const lines = text.split('\n')
  let currentQ = ''
  let currentA = ''

  for (const line of lines) {
    if (line.startsWith('Q:') || line.startsWith('"question":')) {
      if (currentQ && currentA) {
        pairs.push({ question: currentQ, answer: currentA })
      }
      currentQ = line.replace(/^Q:|"question":|[":]|^\s+/g, '').trim()
      currentA = ''
    } else if (line.startsWith('A:') || line.startsWith('"answer":')) {
      currentA = line.replace(/^A:|"answer":|[":]|^\s+/g, '').trim()
    } else if (currentA) {
      currentA += ' ' + line.trim()
    }
  }

  if (currentQ && currentA) {
    pairs.push({ question: currentQ, answer: currentA })
  }

  return pairs
} 
