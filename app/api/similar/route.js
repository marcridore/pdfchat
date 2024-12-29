import { findSimilar, storeEmbedding } from '@/app/lib/embeddings'
import { nanoid } from 'nanoid'

export async function POST(request) {
  try {
    const { text, pageNumber, pdfName, store = false } = await request.json()

    if (!text || text.trim().length === 0) {
      return Response.json({ error: 'Text is required' }, { status: 400 })
    }

    if (store) {
      try {
        // Store the embedding
        await storeEmbedding(text, {
          id: nanoid(),
          pageNumber,
          pdfName,
          timestamp: new Date().toISOString()
        })
        return Response.json({ success: true })
      } catch (error) {
        console.error('Store embedding error:', error)
        return Response.json({ 
          error: 'Failed to store embedding',
          details: error.message 
        }, { status: 500 })
      }
    } else {
      try {
        // Find similar passages
        const similar = await findSimilar(text)
        return Response.json({ similar })
      } catch (error) {
        console.error('Find similar error:', error)
        return Response.json({ 
          error: 'Failed to find similar passages',
          details: error.message 
        }, { status: 500 })
      }
    }
  } catch (error) {
    console.error('Similarity search error:', error)
    return Response.json({ 
      error: 'Failed to process request',
      details: error.message 
    }, { status: 500 })
  }
} 