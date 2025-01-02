export default function CurrentTab({
  selectedText,
  translatedText,
  isTranslating,
  analysis,
  summary,
  imageAnalysis,
  isAnalyzingImage
}) {
  return (
    <div className="space-y-6">
      {selectedText && (
        <>
          <div className="border-b pb-4">
            <h3 className="font-medium text-gray-900 mb-2">Selected Text:</h3>
            <p className="p-3 bg-gray-50 rounded-lg text-gray-600">{selectedText}</p>
          </div>

          {translatedText && (
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-900 mb-2">Translation:</h3>
              <p className="p-3 bg-gray-50 rounded-lg text-gray-600">{translatedText}</p>
            </div>
          )}

          {analysis && (
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-900 mb-2">Analysis:</h3>
              <div className="p-3 bg-gray-50 rounded-lg prose prose-sm">
                <p className="text-gray-600 whitespace-pre-line">{analysis}</p>
              </div>
            </div>
          )}

          {summary && (
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-900 mb-2">Summary:</h3>
              <div className="p-3 bg-gray-50 rounded-lg prose prose-sm">
                <p className="text-gray-600 whitespace-pre-line">{summary}</p>
              </div>
            </div>
          )}

          {imageAnalysis && (
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-900 mb-2">Image Analysis:</h3>
              <div className="p-3 bg-gray-50 rounded-lg prose prose-sm">
                <p className="text-gray-600 whitespace-pre-line">{imageAnalysis}</p>
              </div>
            </div>
          )}
        </>
      )}

      {!selectedText && (
        <div className="text-gray-500 text-center py-8">
          Select text from the PDF to see translation and analysis
        </div>
      )}
    </div>
  )
} 