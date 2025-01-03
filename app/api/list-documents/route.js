import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
})

const INDEX_NAME = process.env.PINECONE_INDEX

export async function GET() {
  try {
    console.log('Listing documents from Pinecone...')
    const index = pc.index(INDEX_NAME)
    
    // Query with a dummy vector to get metadata
    const response = await index.query({
      vector: Array(768).fill(0),
      topK: 10000,
      includeMetadata: true
    })

    console.log('Pinecone query response:', {
      matchCount: response.matches?.length || 0
    })

    // Group by document name and count vectors
    const documentMap = new Map()
    
    if (response.matches && response.matches.length > 0) {
      response.matches.forEach(match => {
        if (match.metadata?.pdfName) {
          const docName = match.metadata.pdfName
          if (!documentMap.has(docName)) {
            documentMap.set(docName, {
              name: docName,
              vectorCount: 1,
              lastModified: match.metadata.timestamp || Date.now()
            })
          } else {
            const doc = documentMap.get(docName)
            doc.vectorCount++
            doc.lastModified = Math.max(doc.lastModified, match.metadata.timestamp || Date.now())
          }
        }
      })
    }

    const documents = Array.from(documentMap.values())
    console.log('Processed documents:', {
      count: documents.length,
      documents: documents.map(d => ({ name: d.name, vectors: d.vectorCount }))
    })

    return NextResponse.json({ documents })

  } catch (error) {
    console.error('Error listing documents from Pinecone:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to list documents',
      details: error.stack
    }, { status: 500 })
  }
} 