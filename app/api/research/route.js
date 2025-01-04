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
    
    console.log('Processing arXiv search query:', query)
    
    // Create arXiv API query URL with proper encoding
    const searchUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=3`
    console.log('ArXiv API URL:', searchUrl)
    
    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      console.error('ArXiv API error:', response.status, response.statusText)
      throw new Error('Failed to fetch from arXiv')
    }
    
    const xmlText = await response.text()
    
    // Parse XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ''
    })
    const result = parser.parse(xmlText)
    
    // Handle case where no entries are found
    if (!result.feed?.entry) {
      console.log('No results found for query:', query)
      return NextResponse.json({ results: [] })
    }
    
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
    })).filter(r => r.title && r.summary) // Filter out any incomplete entries

    console.log('Formatted results:', formattedResults.length)

    return NextResponse.json({ 
      results: formattedResults,
      debug: { query, timestamp: new Date().toISOString() }
    })
  } catch (error) {
    console.error('Research API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to process research request',
      debug: { query, timestamp: new Date().toISOString() }
    }, { 
      status: 500 
    })
  }
} 