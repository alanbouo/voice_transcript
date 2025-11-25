import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mic } from 'lucide-react'
import { clearTokens } from '../utils/auth'
import Upload from './Upload'
import TranscriptViewer from './TranscriptViewer'

function Dashboard({ setIsAuthenticated }) {
  const [transcripts, setTranscripts] = useState([])
  const navigate = useNavigate()

  const handleLogout = () => {
    clearTokens()
    setIsAuthenticated(false)
    navigate('/login', { replace: true })
  }

  const handleTranscriptComplete = (transcript) => {
    setTranscripts([transcript, ...transcripts])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Voice Transcript</h1>
                <p className="text-sm text-gray-500">Audio transcription dashboard</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div>
            <Upload onTranscriptComplete={handleTranscriptComplete} />
          </div>

          {/* Transcripts Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Transcripts</h2>
            <TranscriptViewer transcripts={transcripts} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard
