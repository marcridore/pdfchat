import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

// Helper function to parse arXiv date format
function parseArxivDate(dateStr) {
  // Handle "[Submitted on DD MMM YYYY]" format
  const match = dateStr.match(/\d{1,2}\s+\w+\s+\d{4}/)
  if (match) {
    return new Date(match[0]).toISOString()
  }
  return dateStr
}

export async function POST(req) {
  try {
    const { query } = await req.json()
    
    // Create arXiv API query URL
    const searchUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=3`
    
    const response = await fetch(searchUrl)
    const xmlText = await response.text()
    
    // Parse XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ''
    })
    const result = parser.parse(xmlText)
    
    // Extract entries
    const entries = result.feed.entry || []
    const results = Array.isArray(entries) ? entries : [entries]
    
    // Format results
    const formattedResults = results.map(entry => ({
      title: entry.title?.replace(/\n/g, ' ').trim(),
      summary: entry.summary?.replace(/\n/g, ' ').trim(),
      link: entry.id,
      published: parseArxivDate(entry.published),
      authors: Array.isArray(entry.author) 
        ? entry.author.map(a => a.name).join(', ')
        : entry.author?.name || 'Unknown'
    }))

    return NextResponse.json({ results: formattedResults })
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
} 