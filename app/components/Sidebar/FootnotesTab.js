export default function FootnotesTab({ footnotesHistory, scrollToReference }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-gray-700">Saved Footnotes</h3>
      {Object.entries(footnotesHistory)
        .sort((a, b) => a[1].markerId - b[1].markerId)
        .map(([text, data]) => (
          <div key={text} className="border-b pb-4">
            <div className="flex justify-between items-start">
              <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <span className="text-blue-500">[{data.markerId}]</span>
                Page {data.pageNumber}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(data.timestamp).toLocaleString()}
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-1">{text}</p>
            <button
              onClick={() => scrollToReference(text, data)}
              className="mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              Jump to Reference
            </button>
          </div>
        ))}
    </div>
  )
} 