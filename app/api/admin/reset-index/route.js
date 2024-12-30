import { Pinecone } from '@pinecone-database/pinecone'

export async function POST(request) {
  try {
    // Initialize Pinecone client with same configuration as embeddings.js
    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    })

    console.log('Admin: Initializing index deletion...')
    const index = pc.index('pdf-embeddings')
    
    // Delete all vectors in the index
    console.log('Admin: Deleting all vectors...')
    await index.deleteAll()
    console.log('Admin: Successfully deleted all vectors')

    return Response.json({ 
      success: true,
      message: 'Successfully deleted all embeddings from the index'
    })

  } catch (error) {
    console.error('Failed to reset index:', error)
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to reset index'
    }, { status: 500 })
  }
} 