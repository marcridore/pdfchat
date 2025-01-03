import { NextResponse } from 'next/server'

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY

export async function POST(req) {
  try {
    const { prompt } = await req.json()
    
    console.log('Getting chat completion for prompt:', prompt.substring(0, 100) + '...')

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get completion from Together API')
    }

    const result = await response.json()
    
    return NextResponse.json({
      response: result.choices[0].message.content
    })

  } catch (error) {
    console.error('Chat completion error:', error)
    return NextResponse.json(
      { error: 'Failed to get chat completion' },
      { status: 500 }
    )
  }
} 