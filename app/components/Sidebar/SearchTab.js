export default function SearchTab({
  searchQuery,
  setSearchQuery,
  handleManualSearch,
  isSearchingSimilar,
  similarPassages,
  setCurrentPage
}) {
  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-2">Search Similar Passages</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter text to search..."
            className="flex-1 border rounded p-2"
          />
          <button
            onClick={handleManualSearch}
            disabled={isSearchingSimilar || !searchQuery.trim()}
            className={`px-4 py-2 rounded flex items-center gap-2 ${
              isSearchingSimilar || !searchQuery.trim()
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isSearchingSimilar ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Searching...</span>
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>
      
      {similarPassages.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-700">Similar Passages Found:</h3>
          {similarPassages.map((match, index) => (
            <div key={index} className="bg-gray-50 p-3 rounded border">
              <div className="text-xs text-gray-500 mb-1">
                Page {match.metadata.pageNumber} - {match.metadata.pdfName}
              </div>
              <p className="text-sm text-gray-600">{match.metadata.text}</p>
              <div className="text-xs text-gray-400 mt-1">
                Similarity: {(match.score * 100).toFixed(1)}%
              </div>
              <button
                onClick={() => setCurrentPage(match.metadata.pageNumber)}
                className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                Go to Page
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500 text-center">
          {searchQuery.trim() ? 'No similar passages found.' : 'Enter text to search for similar passages.'}
        </div>
      )}
    </div>
  )
} 