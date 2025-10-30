import { useState } from 'react'
import { FileText, Download, Calendar, FileJson } from 'lucide-react'
import api from '../services/api'

function TranscriptViewer({ transcripts }) {
  const [selectedTranscript, setSelectedTranscript] = useState(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleViewTranscript = async (transcript) => {
    setLoading(true)
    setSelectedTranscript(transcript)
    
    try {
      // Use the API client to fetch from backend
      const response = await api.get(`/transcripts/${transcript.id}`, {
        params: { format: 'txt' }
      })
      setTranscriptText(response.data)
    } catch (error) {
      console.error('Error loading transcript:', error)
      setTranscriptText('Error loading transcript')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (transcript, format) => {
    try {
      // Use the API client to download from backend
      const response = await api.get(`/transcripts/${transcript.id}`, {
        params: { format },
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${transcript.id}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  if (transcripts.length === 0) {
    return (
      <div className="card text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No transcripts yet</h3>
        <p className="text-gray-500">Upload an audio file to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Transcript List */}
      <div className="space-y-3">
        {transcripts.map((transcript) => (
          <div
            key={transcript.id}
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {transcript.filename}
                </h3>
                <div className="flex items-center text-sm text-gray-500 space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {new Date(transcript.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewTranscript(transcript)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  title="View transcript"
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDownload(transcript, 'txt')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download TXT"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDownload(transcript, 'json')}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Download JSON"
                >
                  <FileJson className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transcript Modal/Viewer */}
      {selectedTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTranscript.filename}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(selectedTranscript.timestamp).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTranscript(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                  {transcriptText}
                </pre>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => handleDownload(selectedTranscript, 'txt')}
                className="btn-secondary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download TXT</span>
              </button>
              <button
                onClick={() => handleDownload(selectedTranscript, 'json')}
                className="btn-secondary flex items-center space-x-2"
              >
                <FileJson className="w-4 h-4" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranscriptViewer
