'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function SharedPassage() {
  const { id } = useParams()
  const [passage, setPassage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPassage()
  }, [id])

  const fetchPassage = async () => {
    try {
      const response = await fetch(`/api/share?id=${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch passage')
      }
      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      // Ensure comments array exists
      setPassage({
        ...data,
        comments: data.comments || []
      })
    } catch (error) {
      console.error('Error fetching passage:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addComment = async () => {
    if (!comment.trim() || !author.trim()) return

    try {
      const response = await fetch('/api/share', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareId: id,
          comment,
          author
        })
      })

      if (!response.ok) {
        throw new Error('Failed to add comment')
      }

      const updatedPassage = await response.json()
      setPassage({
        ...updatedPassage,
        comments: updatedPassage.comments || []
      })
      setComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('Failed to add comment. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500">Error: {error}</div>
      </div>
    )
  }

  if (!passage) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-gray-500">Passage not found</div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Shared Passage</h1>
        <div className="mb-6">
          <div className="text-sm text-gray-500 mb-2">
            From page {passage.pageNumber} of {passage.pdfName}
          </div>
          <div className="bg-gray-50 p-4 rounded border">
            {passage.text}
          </div>
          {passage.context && (
            <div className="mt-4 text-sm text-gray-600">
              <strong>Context:</strong> {passage.context}
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <h2 className="text-xl font-bold mb-4">Comments</h2>
          <div className="space-y-4 mb-6">
            {passage.comments.length > 0 ? (
              passage.comments.map((comment, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">{comment.author}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-gray-600">{comment.text}</p>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                No comments yet. Be the first to comment!
              </div>
            )}
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
              className="w-full border rounded p-2"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full border rounded p-2 h-24"
            />
            <button
              onClick={addComment}
              disabled={!comment.trim() || !author.trim()}
              className={`px-4 py-2 rounded ${
                !comment.trim() || !author.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 