import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mic, Settings, Moon, Sun, User } from 'lucide-react'
import { clearTokens } from '../utils/auth'
import { listTranscripts, getCurrentUser, api } from '../services/api'
import Upload from './Upload'
import TranscriptViewer from './TranscriptViewer'

import SettingsModal from './SettingsModal'

function Dashboard({ setIsAuthenticated }) {
  const [transcripts, setTranscripts] = useState([])
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      if (saved !== null) return saved === 'true'
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const [userEmail, setUserEmail] = useState('')
  const [userSettings, setUserSettings] = useState(null)

  // Load user settings and apply theme
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.get('/settings')
        setUserSettings(response.data)
        
        // Apply theme from settings
        const theme = response.data.theme
        if (theme === 'dark') {
          setDarkMode(true)
        } else if (theme === 'light') {
          setDarkMode(false)
        } else {
          // System preference
          setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [])

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  // Load user info
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getCurrentUser()
        setUserEmail(user.email)
      } catch (error) {
        console.error('Failed to load user:', error)
      }
    }
    loadUser()
  }, [])

  // Load transcripts on mount
  useEffect(() => {
    loadTranscripts()
  }, [])

  const loadTranscripts = async () => {
    try {
      setLoading(true)
      const data = await listTranscripts()
      // Transform API response to match component format
      const formattedTranscripts = data.map(t => ({
        id: t.transcript_id,
        database_id: t.id,
        filename: t.filename,
        timestamp: t.created_at,
        word_count: t.word_count,
        preview: t.preview,
        textFile: `/transcripts/${t.transcript_id}?format=txt`,
        jsonFile: `/transcripts/${t.transcript_id}?format=json`
      }))
      setTranscripts(formattedTranscripts)
    } catch (error) {
      console.error('Failed to load transcripts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    clearTokens()
    setIsAuthenticated(false)
    navigate('/login', { replace: true })
  }

  const handleTranscriptComplete = (transcript) => {
    setTranscripts([transcript, ...transcripts])
  }

  const handleTranscriptDeleted = (transcriptId) => {
    setTranscripts(transcripts.filter(t => t.database_id !== transcriptId))
  }

  const handleTranscriptRenamed = (transcriptId, newFilename) => {
    setTranscripts(transcripts.map(t => 
      t.database_id === transcriptId 
        ? { ...t, filename: newFilename }
        : t
    ))
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Voice Transcript</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Audio transcription dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* User email display */}
              {userEmail && (
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg mr-2">
                  <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-300 max-w-[150px] truncate">
                    {userEmail}
                  </span>
                </div>
              )}

              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Settings */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="animate-fade-in">
            <Upload 
              onTranscriptComplete={handleTranscriptComplete}
              defaultQuality={userSettings?.default_quality || 'medium'}
            />
          </div>

          {/* Transcripts Section */}
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Recent Transcripts</h2>
            {loading ? (
              <div className="card flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <TranscriptViewer 
                transcripts={transcripts}
                onTranscriptDeleted={handleTranscriptDeleted}
                onTranscriptRenamed={handleTranscriptRenamed}
              />
            )}
          </div>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChange={(newSettings) => {
          setUserSettings(newSettings)
          // Apply theme change immediately
          if (newSettings.theme === 'dark') {
            setDarkMode(true)
          } else if (newSettings.theme === 'light') {
            setDarkMode(false)
          } else {
            setDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
          }
        }}
      />
    </div>
  )
}

export default Dashboard
