export class ResearchService {
  async searchArxiv(query) {
    try {
      console.log('Searching arXiv with query:', query)

      const baseUrl = typeof window === 'undefined' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        : ''
      
      const url = `${baseUrl}/api/research`
      console.log('Making request to:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })

      console.log('Research API response status:', response.status)

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        throw new Error('Invalid response format from server')
      }

      if (!response.ok) {
        try {
          const errorData = await response.json()
          console.error('Research API error:', errorData)
          throw new Error(errorData.error || 'Unknown error')
        } catch (e) {
          throw new Error('Failed to process error response')
        }
      }

      const data = await response.json()
      console.log('Research results found:', data.results?.length || 0)
      
      return data.results || []
    } catch (error) {
      console.error('Research service error:', error)
      throw error
    }
  }
}

export const researchService = new ResearchService() 