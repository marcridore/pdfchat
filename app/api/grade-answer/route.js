import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { question, userAnswer, correctAnswer } = await req.json()

    const prompt = `
      As a teacher, grade the following student answer. Compare it to the correct answer and provide:
      1. A score between 0 and 1 (where 1 is perfect)
      2. Brief, constructive feedback

      Question: ${question}
      Correct Answer: ${correctAnswer}
      Student Answer: ${userAnswer}

      Respond in this JSON format:
      {
        "score": number between 0 and 1,
        "feedback": "constructive feedback here"
      }
    `.trim()

    const completion = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!completion.ok) throw new Error('Failed to grade answer')

    const result = await completion.json()
    const grading = JSON.parse(result.choices[0].message.content)

    return NextResponse.json(grading)

  } catch (error) {
    console.error('Error grading answer:', error)
    return NextResponse.json(
      { error: 'Failed to grade answer' },
      { status: 500 }
    )
  }
} 