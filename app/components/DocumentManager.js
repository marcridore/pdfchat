'use client'
import { useState, useEffect, useCallback } from 'react'
import { localVectorStore } from '../lib/localVectorStore'

export default function DocumentManager({ isOpen, onClose, onDocumentDeleted, useLocalVectorization }) {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingDoc, setDeletingDoc] = useState(null)

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('Loading documents from:', useLocalVectorization ? 'local' : 'pinecone')

      if (useLocalVectorization) {
        // Load from local store
        const docs = await localVectorStore.listDocuments()
        const groupedDocs = await Promise.all(docs.map(async docName => {
          const vectors = await localVectorStore.getVectorsByDocument(docName)
          return {
            name: docName,
            vectorCount: vectors.length,
            lastModified: vectors[0]?.metadata?.timestamp || Date.now(),
            storage: 'local'
          }
        }))
        setDocuments(groupedDocs)
      } else {
        // Load from Pinecone
        try {
          const response = await fetch('/api/list-documents')
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          const data = await response.json()
          console.log('Pinecone documents loaded:', data)
          
          if (data.documents) {
            setDocuments(data.documents.map(doc => ({
              ...doc,
              storage: 'pinecone'
            })))
          } else {
            throw new Error('No documents data received from Pinecone')
          }
        } catch (err) {
          console.error('Error loading Pinecone documents:', err)
          setError('Failed to load documents from Pinecone')
        }
      }
    } catch (err) {
      console.error('Error loading documents:', err)
      setError(`Failed to load documents from ${useLocalVectorization ? 'local storage' : 'Pinecone'}`)
    } finally {
      setIsLoading(false)
    }
  }, [useLocalVectorization])

  useEffect(() => {
    if (isOpen) {
      console.log('DocumentManager opened with storage type:', 
        useLocalVectorization ? 'local' : 'pinecone'
      )
      loadDocuments()
    }
  }, [isOpen, useLocalVectorization, loadDocuments])

  const handleDelete = async (docName) => {
    try {
      setDeletingDoc(docName)
      
      if (useLocalVectorization) {
        // Delete from local store
        await localVectorStore.deleteDocument(docName)
      } else {
        // Delete from Pinecone
        const response = await fetch('/api/delete-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pdfName: docName })
        })

        if (!response.ok) {
          throw new Error('Failed to delete document from Pinecone')
        }
      }

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
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Manage Documents</h2>
            <p className="text-sm text-gray-500 mt-1">
              Storage: {useLocalVectorization ? 'Local IndexedDB' : 'Pinecone'}
            </p>
          </div>
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
          <p className="text-gray-500 text-center py-8">
            No documents found in {useLocalVectorization ? 'local storage' : 'Pinecone'}
          </p>
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