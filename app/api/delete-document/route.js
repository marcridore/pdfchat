import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
})

const INDEX_NAME = process.env.PINECONE_INDEX

export async function POST(req) {
  try {
    const { pdfName } = await req.json()
    
    if (!pdfName) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 })
    }

    console.log('Deleting document from Pinecone:', pdfName)
    
    const index = pc.index(INDEX_NAME)
    
    // First, query to get all vector IDs for this document
    const queryResponse = await index.query({
      vector: Array(768).fill(0), // dummy vector
      filter: {
        pdfName: { $eq: pdfName }
      },
      topK: 10000,
      includeMetadata: true
    })

    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      console.log('No vectors found for document:', pdfName)
      return NextResponse.json({ 
        success: true, 
        message: `No vectors found for document ${pdfName}` 
      })
    }

    // Get all vector IDs
    const vectorIds = queryResponse.matches.map(match => match.id)
    console.log(`Found ${vectorIds.length} vectors to delete for document:`, pdfName)

    // Delete vectors in batches of 1000
    const BATCH_SIZE = 1000
    for (let i = 0; i < vectorIds.length; i += BATCH_SIZE) {
      const batch = vectorIds.slice(i, i + BATCH_SIZE)
      await index.deleteMany(batch)
      console.log(`Deleted batch of ${batch.length} vectors`)
    }

    console.log('Successfully deleted document:', pdfName)

    return NextResponse.json({ 
      success: true, 
      message: `Document ${pdfName} deleted successfully (${vectorIds.length} vectors)` 
    })

  } catch (error) {
    console.error('Error deleting document from Pinecone:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete document',
      details: error.stack
    }, { status: 500 })
  }
} 