'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handleAuthentication = (e) => {
    e.preventDefault()
    // Simple password protection - in production use proper auth
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setStatus('')
    } else {
      setStatus('Invalid password')
    }
  }

  const handleResetIndex = async () => {
    if (!window.confirm('Are you sure you want to delete all embeddings? This action cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    setStatus('Deleting embeddings...')

    try {
      const response = await fetch('/api/admin/reset-index', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to reset index')
      }

      const data = await response.json()
      setStatus(`Success: ${data.message}`)
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin Authentication</h1>
          <form onSubmit={handleAuthentication} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Login
            </button>
            {status && (
              <p className="text-red-500 text-center">{status}</p>
            )}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Pinecone Index Management</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <h3 className="text-lg font-medium text-red-800 mb-2">Danger Zone</h3>
              <p className="text-sm text-red-600 mb-4">
                Warning: This action will permanently delete all embeddings from the Pinecone index.
                This cannot be undone.
              </p>
              <button
                onClick={handleResetIndex}
                disabled={isDeleting}
                className={`${
                  isDeleting
                    ? 'bg-gray-400'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white py-2 px-4 rounded flex items-center gap-2`}
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  'Reset Pinecone Index'
                )}
              </button>
            </div>
            
            {status && (
              <div className={`p-4 rounded-md ${
                status.startsWith('Error')
                  ? 'bg-red-50 text-red-800'
                  : 'bg-green-50 text-green-800'
              }`}>
                {status}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}