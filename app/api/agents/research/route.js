import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

export async function POST(req) {
  try {
    const { message } = await req.json()

    // Make request to arXiv directly instead of going through research service
    const searchUrl = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(message)}&max_results=3`
    console.log('Querying arXiv:', searchUrl)

    const response = await fetch(searchUrl)
    if (!response.ok) {
      throw new Error(`ArXiv API failed: ${response.status}`)
    }

    const xmlText = await response.text()
    
    // Parse XML response
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: ''
    })
    const arxivData = parser.parse(xmlText)
    
    // Handle no results case
    if (!arxivData.feed?.entry) {
      console.log('No results found for:', message)
      return NextResponse.json({
        response: "I couldn't find any relevant research papers for your query.",
        context: []
      })
    }

    // Process entries
    const entries = arxivData.feed.entry
    const papers = (Array.isArray(entries) ? entries : [entries]).map(entry => ({
      title: entry.title?.replace(/\n/g, ' ').trim(),
      summary: entry.summary?.replace(/\n/g, ' ').trim(),
      link: entry.id,
      authors: Array.isArray(entry.author) 
        ? entry.author.map(a => a.name).join(', ')
        : entry.author?.name || 'Unknown'
    })).filter(p => p.title && p.summary)

    if (papers.length === 0) {
      return NextResponse.json({
        response: "I found some papers but couldn't process them properly.",
        context: []
      })
    }

    // Create research context for LLM
    const researchContext = papers.map(paper => `
      Title: ${paper.title}
      Authors: ${paper.authors}
      Summary: ${paper.summary}
    `).join('\n\n')

    // Get LLM analysis
    const llmResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        messages: [{
          role: 'user',
          content: `
            As a Research Assistant, analyze these papers in relation to: "${message}"

            Research Papers:
            ${researchContext}

            Instructions:
            1. Synthesize key findings relevant to the query
            2. Highlight any conflicting viewpoints
            3. Suggest potential research directions
            4. Cite specific papers in your response

            Provide a clear, academic-style response.
          `
        }],
        temperature: 0.3,
        max_tokens: 1000
      })
    })

    if (!llmResponse.ok) {
      throw new Error('Failed to get AI analysis')
    }

    const llmData = await llmResponse.json()
    
    return NextResponse.json({
      response: llmData.choices[0].message.content,
      context: papers
    })

  } catch (error) {
    console.error('Research agent error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process research request',
        details: error.message
      },
      { status: 500 }
    )
  }
} 