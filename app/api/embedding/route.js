import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { text } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const response = await fetch('https://api.together.xyz/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'togethercomputer/m2-bert-80M-32k-retrieval',
        input: [text]
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create embedding')
    }

    const data = await response.json()
    return NextResponse.json({ embedding: data.data[0].embedding })

  } catch (error) {
    console.error('Error creating embedding:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
} 