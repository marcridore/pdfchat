export default function SelectionMenu({
  menuRef,
  menuPosition,
  handleTranslate,
  isTranslating,
  handleAnalyze,
  isAnalyzing,
  handleFootnoteButton,
  handleSimilaritySearch,
  isSearchingSimilar,
  handleSummarize,
  isSummarizing
}) {
  return (
    <div
      ref={menuRef}
      className="absolute bg-white shadow-lg rounded-lg p-2 z-50 transform -translate-x-1/2 flex gap-2"
      style={{
        left: menuPosition.x,
        top: menuPosition.y - 40,
      }}
    >
      <button
        onClick={handleTranslate}
        disabled={isTranslating}
        className={`px-3 py-1 text-sm rounded ${
          isTranslating
            ? 'bg-blue-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isTranslating ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Translating...</span>
          </>
        ) : (
          'Translate'
        )}
      </button>

      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className={`px-3 py-1 text-sm rounded ${
          isAnalyzing
            ? 'bg-green-300 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
      >
        {isAnalyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Analyzing...</span>
          </>
        ) : (
          'Analyze'
        )}
      </button>

      <button
        onClick={handleFootnoteButton}
        className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
      >
        Footnote
      </button>

      <button
        onClick={handleSimilaritySearch}
        disabled={isSearchingSimilar}
        className={`px-3 py-1 text-sm rounded ${
          isSearchingSimilar
            ? 'bg-purple-300 cursor-not-allowed'
            : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        {isSearchingSimilar ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Searching...</span>
          </>
        ) : (
          'Find Similar'
        )}
      </button>

      <button
        onClick={handleSummarize}
        disabled={isSummarizing}
        className={`px-3 py-1 text-sm rounded ${
          isSummarizing
            ? 'bg-orange-300 cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-600 text-white'
        }`}
      >
        {isSummarizing ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Summarizing...</span>
          </>
        ) : (
          'Summarize'
        )}
      </button>
    </div>
  )
} 