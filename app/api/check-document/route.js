import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

// Check for required environment variables
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
  throw new Error('Required Pinecone environment variables are not defined')
}

const INDEX_NAME = process.env.PINECONE_INDEX

// Initialize Pinecone with error handling
let pc
try {
  pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  })
  console.log('Pinecone client initialized with:', {
    indexName: INDEX_NAME
  })
} catch (error) {
  console.error('Failed to initialize Pinecone client:', error)
  throw error
}

export async function POST(req) {
  try {
    const { pdfName } = await req.json()

    if (!pdfName) {
      return NextResponse.json({ error: 'PDF name is required' }, { status: 400 })
    }

    console.log('Checking document in Pinecone:', {
      indexName: INDEX_NAME,
      pdfName
    })

    const index = pc.index(INDEX_NAME)
    
    console.log('Querying Pinecone for document:', pdfName)
    const queryResponse = await index.query({
      vector: Array(768).fill(0),
      topK: 1,
      filter: {
        pdfName: { $eq: pdfName }
      },
      includeMetadata: true
    })

    console.log('Pinecone check response:', {
      pdfName,
      matches: queryResponse.matches?.length || 0,
      exists: queryResponse.matches?.length > 0,
      firstMatch: queryResponse.matches?.[0]?.metadata
    })

    const exists = queryResponse.matches?.length > 0
    return NextResponse.json({ 
      exists,
      debug: {
        matchCount: queryResponse.matches?.length || 0,
        firstMatch: queryResponse.matches?.[0]?.metadata
      }
    })

  } catch (error) {
    console.error('Error checking document in Pinecone:', {
      message: error.message,
      stack: error.stack,
      details: error
    })
    return NextResponse.json({ 
      error: 'Failed to check document',
      details: error.message,
      stack: error.stack
    }, { status: 500 })
  }
} 