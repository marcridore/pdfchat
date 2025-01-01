import { 
  findSimilar, 
  checkDocumentByName, 
  storeEmbedding, 
  checkDocumentExists,
  getOrCreateIndex
} from '@/app/lib/embeddings'
import { NextResponse } from 'next/server'

export async function POST(req) {
  try {
    const { text, metadata, checkDocumentOnly } = await req.json()
    const index = await getOrCreateIndex()

    // Special route just for checking document existence
    if (checkDocumentOnly) {
      const exists = await checkDocumentByName(metadata.pdfName)
      const results = await index.query({
        vector: Array(768).fill(0),
        topK: 10,
        filter: { pdfName: { $eq: metadata.pdfName } },
        includeMetadata: true
      })

      console.log('Document existence check:', {
        pdfName: metadata.pdfName,
        exists,
        matchCount: results.matches?.length || 0,
        timestamp: Date.now()
      })

      return NextResponse.json({ 
        exists,
        pdfName: metadata.pdfName,
        pageCount: results.matches?.length || 0,
        firstUploadedAt: results.matches?.[0]?.metadata?.timestamp || null
      })
    }

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // For similarity search
    if (!metadata) {
      console.log('Performing similarity search for:', {
        searchText: text.substring(0, 50) + '...',
        textLength: text.length
      })

      const similar = await findSimilar(text, 5) // Get top 5 matches
      
      // Log the results for debugging
      console.log('Similarity search results:', {
        query: text.substring(0, 50) + '...',
        resultCount: similar.length,
        results: similar.map(s => ({
          score: s.score,
          text: s.metadata.text.substring(0, 50) + '...',
          page: s.metadata.pageNumber
        }))
      })

      return NextResponse.json({ similar })
    }

    // If we have metadata, try to store the embedding
    if (metadata) {
      // Check if this specific page already exists
      const pageExists = await checkDocumentExists(metadata.documentId, metadata.pageNumber)
      if (pageExists) {
        return NextResponse.json({ 
          message: 'Page already exists',
          exists: true
        })
      }

      // Store the embedding
      await storeEmbedding(text, metadata)
      return NextResponse.json({ 
        message: 'Embedding stored successfully',
        exists: false
      })
    }

  } catch (error) {
    console.error('Error in similar route:', {
      error: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
} 