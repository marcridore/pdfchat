'use client'
import { useState, useRef, useEffect } from 'react'

export default function ChatModal({ isOpen, onClose, pdfName }) {
  const [chatHistory, setChatHistory] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chatHistory])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    
    setIsLoading(true)
    const userMessage = input.trim()
    setInput('')
    
    // Add user message to chat history
    const newHistory = [...chatHistory, { role: 'user', content: userMessage }]
    setChatHistory(newHistory)
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          pdfName,
          messages: newHistory,
          previousContext: chatHistory
            .filter(msg => msg.context)
            .flatMap(msg => msg.context)
        }),
      })

      if (!response.ok) throw new Error('Failed to get chat response')

      const { answer, context } = await response.json()
      
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: answer,
        context
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">Chat with PDF</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="prose">
                  {message.content}
                  {message.context && (
                    <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                      <p className="font-semibold mb-1">Source{message.context.length > 1 ? 's' : ''}:</p>
                      {message.context.map((ctx, i) => (
                        <div key={i} className="mt-1">
                          <span className="font-medium">
                            {ctx.document && `${ctx.document} - `}Page {ctx.page}
                          </span>
                          {ctx.similarity && (
                            <span className="text-gray-400 ml-1"> 
                              (Relevance: {ctx.similarity}%)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 