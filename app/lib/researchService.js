export class ResearchService {
  async searchArxiv(query) {
    try {
      // Determine if we're on client or server side
      const baseUrl = typeof window === 'undefined' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        : ''
      
      const response = await fetch(`${baseUrl}/api/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error('Research fetch failed')
      }

      const data = await response.json()
      return data.results
    } catch (error) {
      console.error('Research service error:', error)
      throw error
    }
  }
}

export const researchService = new ResearchService() 