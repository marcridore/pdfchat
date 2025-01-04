'use client'

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr)
    if (date.toString() === 'Invalid Date') {
      // Try to parse arXiv format directly
      const match = dateStr.match(/\d{1,2}\s+\w+\s+\d{4}/)
      if (match) {
        return new Date(match[0]).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
      return 'Date not available'
    }
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return 'Date not available'
  }
}

export default function ResearchModal({ paper, onClose, papers, currentIndex = 0, onNavigate }) {
  if (!paper) return null

  const hasNext = papers && currentIndex < papers.length - 1
  const hasPrev = papers && currentIndex > 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl mx-4 rounded-2xl shadow-2xl 
        overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 
          flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-white">Research Paper</h3>
            {papers && (
              <span className="text-sm text-white/80">
                {currentIndex + 1} of {papers.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Navigation buttons */}
            {papers && papers.length > 1 && (
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={() => onNavigate(currentIndex - 1)}
                  disabled={!hasPrev}
                  className={`p-2 rounded-lg transition-colors ${
                    hasPrev 
                      ? 'hover:bg-white/10 text-white' 
                      : 'text-white/40 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 19l-7-7 7-7" 
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onNavigate(currentIndex + 1)}
                  disabled={!hasNext}
                  className={`p-2 rounded-lg transition-colors ${
                    hasNext 
                      ? 'hover:bg-white/10 text-white' 
                      : 'text-white/40 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 5l7 7-7 7" 
                    />
                  </svg>
                </button>
              </div>
            )}
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {paper.title}
          </h2>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Authors</h4>
            <p className="text-gray-800 dark:text-gray-200">{paper.authors}</p>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Published</h4>
            <p className="text-gray-800 dark:text-gray-200">
              {formatDate(paper.published)}
            </p>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Summary</h4>
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {paper.summary}
            </p>
          </div>

          <div className="mt-8">
            <a 
              href={paper.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 
                hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <span>View on arXiv</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 