'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * @typedef {Object} QAItem
 * @property {string} question
 * @property {string} answer
 * @property {number} page
 * @property {string[]} hints
 * @property {string} [userAnswer]
 * @property {boolean} [isAnswered]
 * @property {number} [score]
 * @property {string} [feedback]
 */

export default function DocumentQA({ 
  isOpen, 
  onClose,
  pageContent,
  documentName,
  currentPage,
  pdfDoc
}) {
  /** @type {[QAItem[], (items: QAItem[]) => void]} */
  const [qaList, setQaList] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [allContent, setAllContent] = useState({})
  const [currentDocName, setCurrentDocName] = useState(documentName)
  const qaListRef = useRef(null)
  const [userAnswers, setUserAnswers] = useState({})
  const [showAnswers, setShowAnswers] = useState({})
  const [showHints, setShowHints] = useState({})
  const [visibleHints, setVisibleHints] = useState({})
  const [isSubmitting, setIsSubmitting] = useState({})

  // Generate Q&A for a specific page
  const generateQAForPage = async (pageNum, pageText) => {
    if (!pageText) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `Page ${pageNum}:\n${pageText}`,
          documentName,
          includePage: true
        }),
      })

      if (!response.ok) throw new Error('Failed to generate Q&A')

      const { qaItems } = await response.json()
      console.log('Generated Q&A items for page', pageNum, ':', qaItems.length)
      
      setQaList(prev => [
        ...prev.filter(qa => qa.page !== pageNum),
        ...qaItems.map(qa => ({
          ...qa,
          page: pageNum,
          hints: qa.hints || []
        }))
      ])
    } catch (error) {
      console.error('Error generating Q&A:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Process page content - Define this before using it in useEffect
  const processPage = useCallback(async (pageNum) => {
    if (!pdfDoc) return

    setIsProcessing(true)
    try {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')

      setAllContent(prev => ({
        ...prev,
        [pageNum]: pageText.substring(0, 2000)
      }))

      console.log('Processed page:', {
        document: documentName,
        page: pageNum,
        contentLength: pageText.length
      })

      // Automatically generate Q&A for the new page
      await generateQAForPage(pageNum, pageText)

    } catch (error) {
      console.error('Error processing page:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [pdfDoc, documentName])

  // Process next page
  const processNextPage = useCallback(async () => {
    if (!pdfDoc || currentPage >= pdfDoc.numPages) return
    await processPage(currentPage + 1)
  }, [pdfDoc, currentPage, processPage])

  // Scroll to bottom of Q&A list when new items are added
  useEffect(() => {
    if (qaListRef.current) {
      qaListRef.current.scrollTop = qaListRef.current.scrollHeight
    }
  }, [qaList])

  // Initialize first page - Now processPage is defined before this useEffect
  useEffect(() => {
    if (!isOpen || !pdfDoc) return

    const handleDocumentChange = async () => {
      if (documentName !== currentDocName) {
        console.log('New document detected, resetting state')
        setQaList([])
        setAllContent({})
        setCurrentDocName(documentName)
        setUserAnswers({})
        setShowAnswers({})
        setShowHints({})
        setVisibleHints({})
        setIsSubmitting({})
      }

      if (!allContent[1]) {
        console.log('Processing first page')
        await processPage(1)
      }
    }

    handleDocumentChange()
  }, [isOpen, pdfDoc, documentName, currentDocName, processPage, allContent])

  // Generate Q&A for all processed pages
  const generateAllQA = async () => {
    const combinedContent = Object.entries(allContent)
      .sort(([pageA], [pageB]) => Number(pageA) - Number(pageB))
      .map(([page, content]) => `Page ${page}:\n${content}`)
      .join('\n\n')

    if (!combinedContent) {
      console.log('No content available for Q&A generation')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/generate-qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: combinedContent,
          documentName
        }),
      })

      if (!response.ok) throw new Error('Failed to generate Q&A')

      const { qaItems } = await response.json()
      setQaList(qaItems)
    } catch (error) {
      console.error('Error generating Q&A:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * @param {string} question
   * @param {string} userAnswer
   * @param {string} correctAnswer
   */
  const gradeAnswer = async (question, userAnswer, correctAnswer) => {
    try {
      const response = await fetch('/api/grade-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          userAnswer,
          correctAnswer
        }),
      })

      if (!response.ok) throw new Error('Failed to grade answer')

      const { score, feedback } = await response.json()
      return { score, feedback }
    } catch (error) {
      console.error('Error grading answer:', error)
      return { score: null, feedback: 'Could not grade answer' }
    }
  }

  /**
   * @param {number} questionIdx
   */
  const handleAnswerSubmit = async (questionIdx) => {
    const qa = qaList[questionIdx]
    const userAnswer = userAnswers[questionIdx]

    if (!userAnswer) return

    setIsSubmitting(prev => ({ ...prev, [questionIdx]: true }))
    try {
      const { score, feedback } = await gradeAnswer(qa.question, userAnswer, qa.answer)

      setQaList(prev => prev.map((item, idx) => 
        idx === questionIdx 
          ? { ...item, userAnswer, isAnswered: true, score, feedback }
          : item
      ))

      setShowAnswers(prev => ({
        ...prev,
        [questionIdx]: true
      }))
    } finally {
      setIsSubmitting(prev => ({ ...prev, [questionIdx]: false }))
    }
  }

  const showNextHint = (questionIdx) => {
    setVisibleHints(prev => ({
      ...prev,
      [questionIdx]: (prev[questionIdx] || 0) + 1
    }))
  }

  return (
    <div className={`fixed inset-0 ${isOpen ? 'flex' : 'hidden'} items-center justify-center z-40`}>
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 z-50 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Document Q&A</h2>
            <p className="text-sm text-gray-500 mt-1">{documentName}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              <span>Pages processed: {Object.keys(allContent).length}</span>
            </div>
            <button
              onClick={() => {
                setQaList([])
                setAllContent({})
              }}
              className="text-red-500 hover:text-red-600 text-sm"
            >
              Clear All
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={generateAllQA}
                disabled={isLoading || Object.keys(allContent).length === 0}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
              >
                {isLoading ? 'Generating Q&A...' : 'Generate All Q&A'}
              </button>
              {currentPage < (pdfDoc?.numPages || 1) && (
                <button
                  onClick={processNextPage}
                  disabled={isProcessing || !pdfDoc || currentPage >= pdfDoc.numPages}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Process Next Page
                </button>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {isProcessing ? (
                'Processing...'
              ) : (
                `Page ${currentPage} of ${pdfDoc?.numPages || 1}`
              )}
            </div>
          </div>

          {/* Q&A List with auto-scroll */}
          <div 
            ref={qaListRef}
            className="space-y-6 max-h-[60vh] overflow-y-auto"
          >
            {qaList.map((qa, idx) => (
              <div key={idx} className="border rounded-lg p-6 hover:bg-gray-50">
                <div className="space-y-4">
                  {/* Question and Page */}
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-gray-700">Q: {qa.question}</p>
                    <span className="text-xs text-gray-400">Page {qa.page}</span>
                  </div>

                  {/* Hints Section */}
                  {!qa.isAnswered && qa.hints?.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => setShowHints(prev => ({
                            ...prev,
                            [idx]: !prev[idx]
                          }))}
                          className="text-blue-500 text-sm hover:text-blue-600"
                        >
                          {showHints[idx] ? 'Hide Hints' : 'Show Hints'}
                        </button>
                        <span className="text-xs text-gray-400">
                          {visibleHints[idx] || 0}/{qa.hints.length} hints shown
                        </span>
                      </div>
                      
                      {showHints[idx] && (
                        <div className="pl-4 border-l-2 border-blue-200">
                          {qa.hints.slice(0, visibleHints[idx] || 0).map((hint, hintIdx) => (
                            <p key={hintIdx} className="text-sm text-gray-600 mb-1">
                              Hint {hintIdx + 1}: {hint}
                            </p>
                          ))}
                          {(visibleHints[idx] || 0) < qa.hints.length && (
                            <button
                              onClick={() => showNextHint(idx)}
                              className="text-sm text-blue-500 hover:text-blue-600"
                            >
                              Show Next Hint
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Answer Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Your Answer:
                    </label>
                    <textarea
                      value={userAnswers[idx] || ''}
                      onChange={(e) => setUserAnswers(prev => ({
                        ...prev,
                        [idx]: e.target.value
                      }))}
                      disabled={qa.isAnswered}
                      className="w-full p-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Type your answer here..."
                    />
                    {!qa.isAnswered && (
                      <button
                        onClick={() => handleAnswerSubmit(idx)}
                        disabled={isSubmitting[idx]}
                        className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-400 flex items-center gap-2"
                      >
                        {isSubmitting[idx] ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Submitting...
                          </>
                        ) : (
                          'Submit Answer'
                        )}
                      </button>
                    )}
                  </div>

                  {/* Correct Answer (hidden until submitted) */}
                  {showAnswers[idx] && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-700">Correct Answer:</p>
                        {qa.score !== undefined && (
                          <span className={`text-sm font-medium ${
                            qa.score > 0.7 ? 'text-green-500' : 
                            qa.score > 0.4 ? 'text-yellow-500' : 
                            'text-red-500'
                          }`}>
                            Score: {Math.round(qa.score * 100)}%
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600">{qa.answer}</p>
                      {qa.feedback && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                          <p className="text-sm text-gray-600">{qa.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 