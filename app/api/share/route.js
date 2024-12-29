import { nanoid } from 'nanoid'

// In-memory store (replace with database in production)
const sharedPassages = new Map()

export async function POST(request) {
  try {
    const { text, pageNumber, position, pdfName, context } = await request.json()
    const shareId = nanoid(10)
    
    // Store passage data
    sharedPassages.set(shareId, {
      text,
      pageNumber,
      position,
      pdfName,
      context,
      comments: [],
      createdAt: new Date().toISOString()
    })

    // Get base URL from environment or request headers
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`

    return Response.json({ 
      shareId,
      shareUrl: `${baseUrl}/shared/${shareId}`
    })
  } catch (error) {
    console.error('Share error:', error)
    return Response.json({ error: 'Failed to create share link' }, { status: 500 })
  }
}

export async function GET(request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  
  const passage = sharedPassages.get(id)
  if (!passage) {
    return Response.json({ error: 'Passage not found' }, { status: 404 })
  }

  return Response.json(passage)
}

export async function PUT(request) {
  const { shareId, comment, author } = await request.json()
  
  const passage = sharedPassages.get(shareId)
  if (!passage) {
    return Response.json({ error: 'Passage not found' }, { status: 404 })
  }

  passage.comments.push({
    text: comment,
    author,
    timestamp: new Date().toISOString()
  })

  return Response.json(passage)
} 