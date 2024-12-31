import { findSimilar, storeEmbedding, getOrCreateIndex } from '@/app/lib/embeddings'
import { nanoid } from 'nanoid'

export async function POST(request) {
  try {
    const body = await request.json()
    
    // If this is just a check for existing embeddings
    if (body.checkOnly) {
      const { metadata } = body
      
      // Query Pinecone with a dummy vector just to check if entries exist
      const index = await getOrCreateIndex()
      const results = await index.query({
        vector: Array(768).fill(0), // Dummy vector
        topK: 1,
        filter: {
          $and: [
            { documentId: { $eq: metadata.documentId } },
            { pageNumber: { $eq: metadata.pageNumber } }
          ]
        }
      })

      return Response.json({ 
        exists: results.matches.length > 0 
      })
    }

    // Rest of the existing similar search logic...
    const { text, store = false, metadata = null } = body

    if (!text && !body.checkOnly) {
      return Response.json({ error: 'Text is required' }, { status: 400 })
    }

    if (store) {
      await storeEmbedding(text, metadata)
      return Response.json({ success: true })
    }

    // Find similar passages
    const similar = await findSimilar(text)
    return Response.json({ similar })

  } catch (error) {
    console.error('Similar search error:', error)
    return Response.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
} 