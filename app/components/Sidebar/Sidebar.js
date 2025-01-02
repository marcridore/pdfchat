import TabNavigation from './TabNavigation'
import CurrentTab from './CurrentTab'
import FootnotesTab from './FootnotesTab'
import SearchTab from './SearchTab'
import ResizablePanel from './ResizablePanel'
import TranslationsCarousel from '../TranslationsCarousel'

export default function Sidebar({
  activeTab,
  setActiveTab,
  selectedText,
  translatedText,
  isTranslating,
  analysis,
  summary,
  imageAnalysis,
  isAnalyzingImage,
  translationHistory,
  footnotesHistory,
  scrollToReference,
  searchQuery,
  setSearchQuery,
  handleManualSearch,
  isSearchingSimilar,
  similarPassages,
  setCurrentPage,
  chatHistory,
  chatInput,
  setChatInput,
  handleChat,
  isChatLoading
}) {
  return (
    <ResizablePanel>
      <div className="h-full border-l border-gray-200 bg-white">
        <div className="p-4">
          <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <div className="mt-4">
            {activeTab === 'current' && (
              <CurrentTab
                selectedText={selectedText}
                translatedText={translatedText}
                isTranslating={isTranslating}
                analysis={analysis}
                summary={summary}
                imageAnalysis={imageAnalysis}
                isAnalyzingImage={isAnalyzingImage}
              />
            )}

            {activeTab === 'history' && (
              <TranslationsCarousel translations={translationHistory} />
            )}

            {activeTab === 'footnotes' && (
              <FootnotesTab
                footnotesHistory={footnotesHistory}
                scrollToReference={scrollToReference}
              />
            )}

            {activeTab === 'search' && (
              <SearchTab
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleManualSearch={handleManualSearch}
                isSearchingSimilar={isSearchingSimilar}
                similarPassages={similarPassages}
                setCurrentPage={setCurrentPage}
              />
            )}

            {activeTab === 'chat' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Chat with PDF</h2>
                <div className="h-[500px] overflow-y-auto border rounded-lg p-4">
                  {chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`mb-4 ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-block p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 border rounded-lg px-3 py-2"
                    onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                  />
                  <button
                    onClick={handleChat}
                    disabled={isChatLoading || !chatInput.trim()}
                    className={`px-4 py-2 rounded-lg ${
                      isChatLoading || !chatInput.trim()
                        ? 'bg-blue-300'
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white`}
                  >
                    {isChatLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ResizablePanel>
  )
} 