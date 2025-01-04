'use client'
import { useState, useEffect } from 'react'
import ChatModal from './ChatModal'
import { motion } from 'framer-motion'
import { researchService } from '../lib/researchService'

// Sample agent data - in production this would come from an API/database
const agents = [
  {
    id: 1,
    name: 'Research Assistant',
    description: 'Helps with academic research, paper analysis, and literature review',
    icon: '🔬',
    tasks: ['Literature review', 'Paper summarization', 'Research methodology', 'Citation analysis'],
    category: 'Academic'
  },
  {
    id: 2,
    name: 'Data Analyst',
    description: 'Analyzes data, creates visualizations, and provides statistical insights',
    icon: '📊',
    tasks: ['Data visualization', 'Statistical analysis', 'Trend identification', 'Report generation'],
    category: 'Analytics'
  },
  {
    id: 3,
    name: 'Writing Assistant',
    description: 'Helps with academic writing, editing, and formatting',
    icon: '✍️',
    tasks: ['Grammar checking', 'Style improvement', 'Citation formatting', 'Structure organization'],
    category: 'Writing'
  },
  {
    id: 4,
    name: 'Study Guide Creator',
    description: 'Creates study materials and learning resources',
    icon: '📚',
    tasks: ['Flashcard creation', 'Summary generation', 'Quiz preparation', 'Study plan creation'],
    category: 'Education'
  }
]

// All possible tasks for autocomplete
const allTasks = agents.reduce((acc, agent) => [...acc, ...agent.tasks], [])

// Define agent-specific handlers
const agentHandlers = {
  'Research Assistant': async (message, chatHistory) => {
    try {
      // Use the dedicated research agent API route
      const response = await fetch('/api/agents/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })

      if (!response.ok) throw new Error('Failed to get AI response')
      
      const data = await response.json()
      return {
        response: data.response,
        context: data.context
      }
    } catch (error) {
      console.error('Research Assistant error:', error)
      throw error
    }
  },

  'Data Analyst': async (message, chatHistory) => {
    // Implement data analysis specific logic
    // This would connect to a different API route for data analysis tasks
  },

  'Writing Assistant': async (message, chatHistory) => {
    // Implement writing assistance specific logic
    // This would use a different prompt and potentially different models
  }
}

export default function AgentPlace() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredAgents, setFilteredAgents] = useState(agents)
  const [suggestions, setSuggestions] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [chatInput, setChatInput] = useState('')

  // Filter agents based on search query
  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = agents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.tasks.some(task => task.toLowerCase().includes(query))
    )
    setFilteredAgents(filtered)
  }, [searchQuery])

  // Generate autocomplete suggestions
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    const query = searchQuery.toLowerCase()
    const matches = allTasks.filter(task => 
      task.toLowerCase().includes(query)
    )
    setSuggestions(matches.slice(0, 5))
  }, [searchQuery])

  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent)
    setIsChatOpen(true)
    // Initialize chat with a greeting
    setChatHistory([{
      role: 'assistant',
      content: `Hello! I'm the ${agent.name}. How can I help you today?`
    }])
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !selectedAgent) return

    const newMessage = { role: 'user', content: chatInput }
    setChatHistory([...chatHistory, newMessage])
    setChatInput('')
    
    try {
      // Get the appropriate handler for the selected agent
      const handler = agentHandlers[selectedAgent.name]
      if (!handler) {
        throw new Error(`No handler found for agent: ${selectedAgent.name}`)
      }

      // Process the message using the agent-specific handler
      const result = await handler(chatInput, chatHistory)

      // Update chat history with the response
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: result.response,
        context: result.context
      }])

    } catch (error) {
      console.error('Chat error:', error)
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'I encountered an error processing your request. Please try again.'
      }])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Agent Marketplace
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300">
          Discover AI agents to help with your research and academic tasks
        </p>
      </div>

      {/* Search Section */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for tasks or agents..."
            className="w-full px-6 py-4 text-lg rounded-xl border-2 border-gray-200 
              dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 
              dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 
              focus:border-transparent transition-all duration-200"
          />
          
          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 
              rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setSearchQuery(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 
                    dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100
                    first:rounded-t-xl last:rounded-b-xl transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agents Grid */}
      <div className="max-w-7xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAgents.map((agent) => (
          <motion.div
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md 
              transition-shadow duration-200 border border-gray-200 dark:border-gray-700 
              overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl">{agent.icon}</span>
                <span className="px-3 py-1 rounded-full text-sm font-medium 
                  bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {agent.category}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {agent.name}
              </h3>
              
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {agent.description}
              </p>
              
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Capabilities:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {agent.tasks.map((task, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded-md text-xs font-medium 
                        bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    >
                      {task}
                    </span>
                  ))}
                </div>
              </div>
              
              <button
                onClick={() => handleAgentSelect(agent)}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 
                  text-white rounded-lg font-medium transition-colors duration-200"
              >
                Chat with Agent
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Modal */}
      {selectedAgent && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          chatHistory={chatHistory}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleChat={handleChat}
          isChatLoading={false}
        />
      )}
    </div>
  )
} 