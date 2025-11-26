import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Send, Trash2, Loader2 } from 'lucide-react'
import { sendChatMessage, getChatHistory, clearChatHistory, api } from '../services/api'

const thinkingMessages = [
  "Listening between the lines...",
  "Decoding the conversation...",
  "Tuning into the transcript...",
  "Replaying the highlights...",
  "Analyzing the audio insights...",
]

const getRandomThinkingMessage = () => {
  return thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)]
}

function ChatInterface({ transcriptId, transcriptPreview }) {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [defaultPromptSent, setDefaultPromptSent] = useState(false)
  const [thinkingMessage, setThinkingMessage] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    loadChatHistory()
    setDefaultPromptSent(false) // Reset when transcript changes
  }, [transcriptId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadChatHistory = async () => {
    try {
      const history = await getChatHistory(transcriptId)
      setMessages(history)
      
      // If history is empty and we haven't sent default prompt yet, send it
      if (history.length === 0 && !defaultPromptSent) {
        await sendDefaultPrompt()
      }
    } catch (err) {
      console.error('Failed to load chat history:', err)
    }
  }

  const sendDefaultPrompt = async () => {
    try {
      // Fetch user settings
      const settingsResponse = await api.get('/settings')
      const defaultPrompt = settingsResponse.data.default_user_prompt
      
      if (defaultPrompt && defaultPrompt.trim()) {
        setDefaultPromptSent(true)
        setThinkingMessage(getRandomThinkingMessage())
        setLoading(true)
        
        // Add user message
        const tempUserMessage = {
          role: 'user',
          content: defaultPrompt,
          created_at: new Date().toISOString()
        }
        setMessages([tempUserMessage])
        
        // Send to API
        const response = await sendChatMessage(transcriptId, defaultPrompt)
        setMessages([tempUserMessage, response])
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed to send default prompt:', err)
      setLoading(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || loading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setError('')
    setThinkingMessage(getRandomThinkingMessage())
    setLoading(true)

    // Add user message optimistically
    const tempUserMessage = {
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempUserMessage])

    try {
      const response = await sendChatMessage(transcriptId, userMessage)
      // Replace temp message and add AI response
      setMessages(prev => [
        ...prev.slice(0, -1),
        tempUserMessage,
        response
      ])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send message. Make sure OPENAI_API_KEY is configured.')
      // Remove the optimistic message on error
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm('Clear all chat history for this transcript?')) return

    try {
      await clearChatHistory(transcriptId)
      setMessages([])
      setDefaultPromptSent(false)
      // Send default prompt again after clearing
      await sendDefaultPrompt()
    } catch (err) {
      setError('Failed to clear chat history')
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Chat</h3>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1"
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Ask me anything about this transcript!</p>
            {transcriptPreview && (
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md mx-auto">
                "{transcriptPreview.substring(0, 100)}..."
              </p>
            )}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(msg.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary-600" />
              <span className="text-sm text-gray-600 dark:text-gray-300">{thinkingMessage}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask a question about this transcript..."
            className="flex-1 input-field"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !inputMessage.trim()}
            className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatInterface
