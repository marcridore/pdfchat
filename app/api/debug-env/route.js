import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasPineconeKey: !!process.env.PINECONE_API_KEY,
    hasPineconeIndex: !!process.env.PINECONE_INDEX,
    hasPineconeEnvironment: !!process.env.PINECONE_ENVIRONMENT,
    indexName: process.env.PINECONE_INDEX,
    environment: process.env.PINECONE_ENVIRONMENT
  }, { status: 200 })
} 