export default function DocumentControls({ 
  targetLanguage, 
  handleLanguageChange, 
  currentPage, 
  numPages, 
  prevPage, 
  nextPage, 
  scale, 
  setScale, 
  handleScreenshotAnalysis, 
  isAnalyzingImage 
}) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap items-center gap-4">
      <select
        value={targetLanguage}
        onChange={handleLanguageChange}
        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="es">Spanish</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="it">Italian</option>
        <option value="pt">Portuguese</option>
      </select>

      <div className="flex items-center gap-3">
        <button
          onClick={prevPage}
          disabled={currentPage <= 1}
          className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          Previous
        </button>
        <span className="text-sm font-medium">
          Page {currentPage} of {numPages}
        </span>
        <button
          onClick={nextPage}
          disabled={currentPage >= numPages}
          className="px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <select
        value={scale}
        onChange={(e) => setScale(Number(e.target.value))}
        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={1}>100%</option>
        <option value={1.5}>150%</option>
        <option value={2}>200%</option>
        <option value={2.5}>250%</option>
      </select>

      <button
        onClick={handleScreenshotAnalysis}
        disabled={isAnalyzingImage}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
          isAnalyzingImage 
          ? 'bg-purple-300 cursor-not-allowed' 
          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
        }`}
      >
        {isAnalyzingImage ? 'Analyzing...' : 'Analyze View'}
      </button>
    </div>
  )
} 