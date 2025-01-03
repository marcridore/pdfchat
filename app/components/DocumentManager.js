'use client'
import { useState, useEffect } from 'react'
import { localVectorStore } from '../lib/localVectorStore'

export default function DocumentManager({ isOpen, onClose, onDocumentDeleted }) {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingDoc, setDeletingDoc] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadDocuments()
    }
  }, [isOpen])

  const loadDocuments = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const docs = await localVectorStore.listDocuments()
      
      // Group documents by name and count their vectors
      const groupedDocs = await Promise.all(docs.map(async docName => {
        const vectors = await localVectorStore.getVectorsByDocument(docName)
        return {
          name: docName,
          vectorCount: vectors.length,
          lastModified: vectors[0]?.metadata?.timestamp || Date.now()
        }
      }))

      setDocuments(groupedDocs)
    } catch (err) {
      console.error('Error loading documents:', err)
      setError('Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (docName) => {
    try {
      setDeletingDoc(docName)
      await localVectorStore.deleteDocument(docName)
      await loadDocuments() // Refresh the list
      if (onDocumentDeleted) {
        onDocumentDeleted(docName)
      }
    } catch (err) {
      console.error('Error deleting document:', err)
      setError(`Failed to delete ${docName}`)
    } finally {
      setDeletingDoc(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Manage Documents</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No documents found in local storage</p>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div
                key={doc.name}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800">{doc.name}</h3>
                  <p className="text-sm text-gray-500">
                    {doc.vectorCount} vectors • Last modified: {new Date(doc.lastModified).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.name)}
                  disabled={deletingDoc === doc.name}
                  className={`ml-4 px-4 py-2 rounded-lg text-white ${
                    deletingDoc === doc.name
                      ? 'bg-gray-400'
                      : 'bg-red-500 hover:bg-red-600'
                  } transition-colors`}
                >
                  {deletingDoc === doc.name ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </span>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 