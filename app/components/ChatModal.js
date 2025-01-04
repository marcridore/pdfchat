'use client'
import { useState, useRef, useEffect } from 'react'
import { researchService } from '../lib/researchService'
import ResearchModal from './ResearchModal'

export default function ChatModal({ isOpen, onClose, chatHistory = [], chatInput = '', setChatInput, handleChat, isChatLoading, onUpdateChatHistory }) {
  const [expandedContext, setExpandedContext] = useState(null)
  const [selectedPaper, setSelectedPaper] = useState(null)
  const [currentPaperIndex, setCurrentPaperIndex] = useState(0)
  const [currentPapers, setCurrentPapers] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (chatInput.trim()) {
      handleChat()
    }
  }

  // Update the research results formatting
  const formatResearchResult = (paper) => (
    `🔍 Research Paper:\n` +
    `Title: ${paper.title}\n` +
    `Authors: ${paper.authors}\n` +
    `Summary: ${paper.summary.slice(0, 200)}... ` +
    `[Click to read more]`
  )

  // In the message rendering section, update the research results to be clickable
  const renderMessage = (msg) => {
    if (msg.role === 'assistant' && msg.content.includes('🔍 Research Paper:')) {
      const papers = msg.content
        .split('🔍 Research Paper:')
        .slice(1) // Remove the first empty element
        .map(p => {
          try {
            const lines = p.trim().split('\n')
            const paperData = {}
            
            // Safely extract data using regex
            lines.forEach(line => {
              if (line.startsWith('Title: ')) {
                paperData.title = line.replace('Title: ', '')
              } else if (line.startsWith('Authors: ')) {
                paperData.authors = line.replace('Authors: ', '')
              } else if (line.startsWith('Summary: ')) {
                paperData.summary = line.replace('Summary: ', '')
              } else if (line.startsWith('Link: ')) {
                paperData.link = line.replace('Link: ', '')
              }
            })

            // Verify all required fields are present
            if (!paperData.title || !paperData.summary) {
              console.warn('Invalid paper data:', paperData)
              return null
            }

            return paperData
          } catch (error) {
            console.error('Error parsing paper data:', error)
            return null
          }
        })
        .filter(Boolean) // Remove any null entries

      if (papers.length === 0) {
        return <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      }

      return (
        <div>
          <p className="mb-4">Here are some relevant research papers from arXiv:</p>
          {papers.map((paper, idx) => (
            <div 
              key={idx}
              onClick={() => handlePaperClick(paper, papers, idx)}
              className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-pointer 
                hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">{paper.title}</h4>
              {paper.authors && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{paper.authors}</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {paper.summary.slice(0, 200)}...
                <span className="text-blue-500 hover:text-blue-600 ml-1">
                  Read more
                </span>
              </p>
            </div>
          ))}
        </div>
      )
    }
    return <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
  }

  const handlePaperClick = (paper, papers, index) => {
    setSelectedPaper(paper)
    setCurrentPapers(papers)
    setCurrentPaperIndex(index)
  }

  return (
    <div className={`fixed inset-0 ${isOpen ? 'flex' : 'hidden'} items-center justify-center z-50`}>
      {/* Backdrop with modern blur effect */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      
      {/* Main Chat Container */}
      <div className="relative bg-white dark:bg-gray-900 w-full max-w-4xl mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header with gradient */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-white/10 rounded-xl">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Document Chat</h2>
              <p className="text-sm text-blue-100 opacity-90">Ask anything about your PDF</p>
            </div>
          </div>
          <button onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-xl transition-colors duration-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 dark:bg-gray-800">
          {chatHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">No messages yet</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Start by asking a question about your document</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white dark:bg-gray-700 shadow-sm'
                  } rounded-2xl px-6 py-4`}>
                    {/* Message header */}
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center 
                        ${msg.role === 'user' 
                          ? 'bg-white/20' 
                          : 'bg-blue-100 dark:bg-blue-900'}`}>
                        {msg.role === 'user' ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                            />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm ${
                        msg.role === 'user' 
                          ? 'text-blue-100' 
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {msg.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                    </div>

                    {/* Message content */}
                    <div className={msg.role === 'user' ? 'text-white' : 'text-gray-800 dark:text-gray-200'}>
                      {renderMessage(msg)}

                      {/* Sources section for AI responses */}
                      {msg.role === 'assistant' && msg.context && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                            {msg.context[0]?.authors ? 'Research Papers' : 'Sources'}
                          </p>
                          <div className="space-y-3">
                            {msg.context.map((ctx, ctxIdx) => (
                              <div key={ctxIdx} 
                                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm">
                                {/* Research Paper Format */}
                                {ctx.authors ? (
                                  <>
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                      {ctx.title}
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
                                      {ctx.authors}
                                    </p>
                                    <p className="text-gray-700 dark:text-gray-300 mb-3 text-sm">
                                      {truncateText(ctx.summary || '', 200)}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <a 
                                        href={ctx.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs flex items-center gap-1"
                                      >
                                        View on arXiv
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                                          />
                                        </svg>
                                      </a>
                                    </div>
                                  </>
                                ) : (
                                  // Original Source Format
                                  <>
                                    <p className="text-gray-700 dark:text-gray-300 mb-2">
                                      {truncateText(ctx.text || '')}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-500 dark:text-gray-400">
                                        Page {ctx.page || 'N/A'}
                                      </span>
                                      <div className="flex items-center space-x-3">
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium
                                          ${getScoreClass(ctx.score)}`}>
                                          {formatSimilarityScore(ctx.score)}% match
                                        </span>
                                        <button 
                                          onClick={() => setExpandedContext(msg.context)}
                                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 
                                            dark:hover:text-blue-300 text-xs font-medium"
                                        >
                                          View details
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {msg.role === 'user' && (
                        <button
                          onClick={async () => {
                            try {
                              setIsSearching(true)
                              const results = await researchService.searchArxiv(msg.content)
                              if (results && results.length > 0) {
                                const formattedResponse = results
                                  .filter(r => r.title && r.summary)
                                  .map(r => (
                                    `🔍 Research Paper:\n` +
                                    `Title: ${r.title}\n` +
                                    `Authors: ${r.authors}\n` +
                                    `Summary: ${r.summary}\n` +
                                    `Link: ${r.link}`
                                  ))
                                  .join('\n\n')

                                const researchMessage = {
                                  role: 'assistant',
                                  content: `Here are some relevant research papers from arXiv:\n\n${formattedResponse}`
                                }

                                if (handleChat && typeof handleChat === 'function') {
                                  const updatedHistory = [...chatHistory, researchMessage]
                                  onUpdateChatHistory(updatedHistory)
                                }
                              } else {
                                console.log('No relevant research results found')
                              }
                            } catch (error) {
                              console.error('Research failed:', error)
                            } finally {
                              setIsSearching(false)
                            }
                          }}
                          disabled={isSearching}
                          className="mt-3 flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 
                            text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 
                            dark:hover:bg-purple-900/50 transition-colors group disabled:opacity-50 
                            disabled:cursor-not-allowed"
                        >
                          {isSearching ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent 
                                rounded-full animate-spin"/>
                              <span className="font-medium">Searching...</span>
                            </>
                          ) : (
                            <>
                              <svg 
                                className="w-4 h-4 group-hover:scale-110 transition-transform" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                                />
                              </svg>
                              <span className="font-medium">Find Research Papers</span>
                              <svg 
                                className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl 
                  focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-700
                  border-0 text-gray-800 dark:text-gray-200 placeholder-gray-500
                  dark:placeholder-gray-400 transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && !isChatLoading && handleChat()}
              />
              {isChatLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent 
                    rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={isChatLoading || !chatInput.trim()}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                text-white rounded-xl font-medium flex items-center space-x-2
                transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Context Modal */}
      {expandedContext && (
        <ContextModal context={expandedContext} onClose={() => setExpandedContext(null)} />
      )}

      {/* Research Paper Modal */}
      {selectedPaper && (
        <ResearchModal 
          paper={selectedPaper}
          papers={currentPapers}
          currentIndex={currentPaperIndex}
          onNavigate={(newIndex) => {
            setCurrentPaperIndex(newIndex)
            setSelectedPaper(currentPapers[newIndex])
          }}
          onClose={() => {
            setSelectedPaper(null)
            setCurrentPapers(null)
            setCurrentPaperIndex(0)
          }}
        />
      )}
    </div>
  )
}

// Helper functions remain the same
function truncateText(text, maxLength = 150) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.slice(0, maxLength) + '...'
}

function getScoreClass(score) {
  if (typeof score !== 'number') return 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300';
  if (score > 0.7) return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
  if (score > 0.4) return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
  return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
}

function formatSimilarityScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return '0.0'
  return (score * 100).toFixed(1)
}

// Enhanced Context Modal
function ContextModal({ context, onClose }) {
  if (!context || !Array.isArray(context)) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-2xl w-full mx-4 
        max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Source Details</h3>
          <button onClick={onClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {context.map((ctx, idx) => (
            <div key={idx} className="p-5 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                {truncateText(ctx.text || '')}
              </p>
              <div className="mt-3 flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Page {ctx.page || 'N/A'}
                </span>
                <span className={`px-3 py-1 rounded-lg ${getScoreClass(ctx.score)}`}>
                  Match: {formatSimilarityScore(ctx.score)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 