export default function TabNavigation({ activeTab, setActiveTab }) {
  const tabs = ['Current', 'History', 'Footnotes', 'Search', 'Chat']
  
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab.toLowerCase())}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.toLowerCase()
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
} 