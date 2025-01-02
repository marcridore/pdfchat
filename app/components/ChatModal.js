'use client'
import { useState, useRef, useEffect } from 'react'

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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const formatTime = (timestamp) => {
    return new Date(timestamp || Date.now()).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div className={`fixed inset-0 ${isOpen ? 'flex' : 'hidden'} items-center justify-center z-50`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 z-50 h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Chat with PDF</h2>
              <p className="text-sm text-white/80">Ask questions about your document</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-16 h-16 mb-4 p-3 bg-gray-100 rounded-full">
                <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                  />
                </svg>
              </div>
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm">Start the conversation by asking a question about your document</p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-2xl p-4`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center 
                      ${msg.role === 'user' ? 'bg-white/20' : 'bg-blue-500'}`}>
                      {msg.role === 'user' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm opacity-70">
                      {msg.role === 'user' ? 'You' : 'AI Assistant'} • {formatTime()}
                    </span>
                  </div>

                  <div className={`${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                    <p className="whitespace-pre-wrap mb-3">{msg.content}</p>

                    {msg.role === 'assistant' && msg.context && (
                      <div className="mt-3 text-sm border-t border-gray-200 pt-2">
                        <p className="font-medium text-gray-600 mb-2">Sources:</p>
                        <div className="space-y-2">
                          {msg.context.map((ctx, ctxIdx) => (
                            <div key={ctxIdx} className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-gray-600 mb-2">{truncateText(ctx.text)}</p>
                              <div className="flex justify-between items-center text-xs text-gray-500">
                                <span>Page {ctx.page}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded ${getScoreClass(ctx.score)}`}>
                                    Similarity: {formatSimilarityScore(ctx.score)}%
                                  </span>
                                  <button 
                                    onClick={() => setExpandedContext(msg.context)}
                                    className="text-blue-500 hover:text-blue-600"
                                  >
                                    Show more
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about your document..."
                className="w-full p-3 pr-12 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && !isChatLoading && handleChat()}
              />
              {isChatLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <button
              onClick={handleChat}
              disabled={isChatLoading || !chatInput.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors
                flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>

      {expandedContext && (
        <ContextModal context={expandedContext} onClose={() => setExpandedContext(null)} />
      )}
    </div>
  )
}

function truncateText(text, maxLength = 150) {
  return text.length <= maxLength ? text : text.slice(0, maxLength) + '...'
}

function getScoreClass(score) {
  if (score > 0.7) return 'bg-green-100 text-green-800'
  if (score > 0.4) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function formatSimilarityScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return '0.0'
  return (score * 100).toFixed(1)
}

function ContextModal({ context, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Full Context</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {context.map((ctx, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-800">{ctx.text}</p>
              <div className="mt-2 flex justify-between items-center text-sm text-gray-500">
                <span>Page {ctx.page}</span>
                <span className={`px-2 py-1 rounded ${getScoreClass(ctx.score)}`}>
                  Similarity: {formatSimilarityScore(ctx.score)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 