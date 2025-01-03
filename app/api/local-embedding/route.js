import { NextResponse } from 'next/server'

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY
const TOGETHER_API_URL = 'https://api.together.xyz/v1'

export async function POST(req) {
  try {
    const { text } = await req.json()

    const response = await fetch(`${TOGETHER_API_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'togethercomputer/m2-bert-80M-32k-retrieval',
        input: [text.replace('\n', ' ')] // Replace newlines with spaces
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create embedding')
    }

    const data = await response.json()
    return NextResponse.json({ embedding: data.data[0].embedding })

  } catch (error) {
    console.error('Error creating embedding:', error)
    return NextResponse.json(
      { error: 'Failed to create embedding' },
      { status: 500 }
    )
  }
} 