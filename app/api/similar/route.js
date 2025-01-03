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
    const { text, metadata } = await req.json()
    
    // Get embedding from Together API
    const embeddingResponse = await fetch('https://api.together.xyz/v1/embeddings', {
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

    if (!embeddingResponse.ok) {
      throw new Error('Failed to create embedding')
    }

    const { data } = await embeddingResponse.json()
    const vector = data[0].embedding

    // Get Pinecone index
    const index = pc.index(INDEX_NAME)

    if (metadata) {
      // Store the vector with metadata
      const id = `${metadata.pdfName}-${metadata.pageNumber}-${Date.now()}`
      
      console.log('Storing vector in Pinecone:', {
        indexName: INDEX_NAME,
        id,
        metadata
      })

      // Using the new upsert format
      await index.upsert([{
        id,
        values: vector,
        metadata: {
          ...metadata,
          text
        }
      }])

      console.log('Successfully stored embedding:', {
        id,
        pdfName: metadata.pdfName,
        pageNumber: metadata.pageNumber
      })

      return NextResponse.json({ id })
    } else {
      // Perform similarity search
      const queryResponse = await index.query({
        vector,
        topK: 5,
        includeMetadata: true
      })

      return NextResponse.json({ 
        matches: queryResponse.matches.map(match => ({
          ...match.metadata,
          score: match.score
        }))
      })
    }

  } catch (error) {
    console.error('Error in similar route:', error)
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    )
  }
} 