'use client'
import { useState } from 'react'

export default function ChatModal({ 
  isOpen, 
  onClose, 
  chatHistory = [], 
  chatInput = '', 
  setChatInput, 
  handleChat, 
  isChatLoading 
}) {
  const [expandedContext, setExpandedContext] = useState(null)

  // Function to truncate text
  const truncateText = (text, maxLength = 150) => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Update the score formatting function
  const formatSimilarityScore = (score) => {
    if (typeof score !== 'number' || isNaN(score)) {
      return '0.0'  // Default to 0% if score is invalid
    }
    // Convert to percentage and round to 1 decimal place
    // Note: score is already between 0 and 1 from our embeddings.js
    return (score * 100).toFixed(1)
  }

  // Context Detail Modal
  const ContextModal = ({ context, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Full Context</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="prose max-w-none">
          {context.map((ctx, idx) => (
            <div key={idx} className="mb-4 p-4 bg-gray-50 rounded">
              <p className="text-gray-800">{ctx.text}</p>
              <div className="mt-2 text-sm text-gray-500 flex justify-between items-center">
                <span>Page {ctx.page}</span>
                <span className={`px-2 py-1 rounded ${
                  ctx.score > 0.7 ? 'bg-green-100' :
                  ctx.score > 0.4 ? 'bg-yellow-100' : 'bg-red-100'
                }`}>
                  Similarity: {formatSimilarityScore(ctx.score)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`fixed inset-0 ${isOpen ? 'flex' : 'hidden'} items-center justify-center z-40`}>
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 z-50">
        {/* Chat Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Chat with PDF</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="p-4 h-96 overflow-y-auto">
          {chatHistory.map((msg, idx) => (
            <div key={idx} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-3 rounded-lg ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
              }`}>
                <p>{msg.content}</p>
                {msg.context && (
                  <div className="mt-2 text-sm text-left">
                    <p className="font-semibold text-gray-600">Based on these passages:</p>
                    {msg.context.map((ctx, ctxIdx) => (
                      <div key={ctxIdx} className="mt-2 bg-white/50 p-2 rounded">
                        <p>{truncateText(ctx.text)}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs">Page {ctx.page}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            ctx.score > 0.7 ? 'bg-green-100' :
                            ctx.score > 0.4 ? 'bg-yellow-100' : 'bg-red-100'
                          }`}>
                            Similarity: {formatSimilarityScore(ctx.score)}%
                          </span>
                          <button 
                            onClick={() => setExpandedContext(msg.context)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Show more
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Chat Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 p-2 border rounded"
              onKeyPress={(e) => e.key === 'Enter' && handleChat()}
            />
            <button
              onClick={handleChat}
              disabled={isChatLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
            >
              {isChatLoading ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Context Detail Modal */}
      {expandedContext && (
        <ContextModal 
          context={expandedContext} 
          onClose={() => setExpandedContext(null)} 
        />
      )}
    </div>
  )
} 