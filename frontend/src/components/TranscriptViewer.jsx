import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, FileJson, MessageCircle, Edit2, Check, X, Trash2, Pencil, AlertTriangle, Search, FileAudio } from 'lucide-react'
import api, { getTranscriptUtterances, updateSpeakerMapping, renameTranscript, deleteTranscript } from '../services/api'
import ChatInterface from './ChatInterface'

// Helper to estimate word count from transcript
const getWordCount = (transcript) => {
  if (transcript.word_count) return transcript.word_count
  return null
}

// Helper to format word count
const formatWordCount = (count) => {
  if (!count) return null
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k words`
  return `${count} words`
}

function TranscriptViewer({ transcripts, onTranscriptDeleted, onTranscriptRenamed }) {
  const [selectedTranscript, setSelectedTranscript] = useState(null)
  const [transcriptData, setTranscriptData] = useState({ utterances: [], speakers: {} })
  const [loading, setLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [editingSpeaker, setEditingSpeaker] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [renamingTranscript, setRenamingTranscript] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredTranscript, setHoveredTranscript] = useState(null)

  // Filter transcripts based on search
  const filteredTranscripts = transcripts.filter(t =>
    t.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleViewTranscript = async (transcript) => {
    setLoading(true)
    setSelectedTranscript(transcript)
    setTranscriptData({ utterances: [], speakers: {} })

    try {
      const data = await getTranscriptUtterances(transcript.database_id)
      setTranscriptData(data)
    } catch (error) {
      console.error('Error loading transcript:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (transcript, format) => {
    try {
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

  const startEditing = (originalLabel, currentName) => {
    setEditingSpeaker(originalLabel)
    setEditValue(currentName || originalLabel)
  }

  const saveSpeakerName = async () => {
    if (!editValue.trim()) return

    try {
      await updateSpeakerMapping(selectedTranscript.database_id, editingSpeaker, editValue)
      setTranscriptData(prev => ({
        ...prev,
        speakers: {
          ...prev.speakers,
          [editingSpeaker]: editValue
        }
      }))
      setEditingSpeaker(null)
    } catch (error) {
      console.error('Failed to update speaker name:', error)
    }
  }

  const getSpeakerName = (label) => {
    return transcriptData.speakers[label] || label
  }

  const startRenaming = (transcript) => {
    setRenamingTranscript(transcript.database_id)
    setRenameValue(transcript.filename)
  }

  const saveRename = async (transcriptId) => {
    if (!renameValue.trim()) return

    try {
      await renameTranscript(transcriptId, renameValue)
      setRenamingTranscript(null)
      if (onTranscriptRenamed) {
        onTranscriptRenamed(transcriptId, renameValue)
      }
    } catch (error) {
      console.error('Failed to rename transcript:', error)
      alert('Failed to rename transcript')
    }
  }

  const handleDeleteClick = (transcript) => {
    setDeleteConfirm(transcript)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    try {
      await deleteTranscript(deleteConfirm.database_id)
      if (selectedTranscript?.database_id === deleteConfirm.database_id) {
        setSelectedTranscript(null)
      }
      if (onTranscriptDeleted) {
        onTranscriptDeleted(deleteConfirm.database_id)
      }
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete transcript:', error)
      setDeleteConfirm(null)
    }
  }

  if (transcripts.length === 0) {
    return (
      <div className="card text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No transcripts yet</h3>
        <p className="text-gray-500 dark:text-gray-400">Upload an audio file to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      {transcripts.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search transcripts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      )}

      {/* Transcript List */}
      <div className="space-y-3">
        {filteredTranscripts.map((transcript) => (
          <div
            key={transcript.id}
            className="card hover:shadow-lg transition-all duration-200 cursor-pointer relative group animate-slide-up"
            onMouseEnter={() => setHoveredTranscript(transcript.id)}
            onMouseLeave={() => setHoveredTranscript(null)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {renamingTranscript === transcript.database_id ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRename(transcript.database_id)
                        if (e.key === 'Escape') setRenamingTranscript(null)
                      }}
                    />
                    <button
                      onClick={() => saveRename(transcript.database_id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRenamingTranscript(null)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {transcript.filename}
                  </h3>
                )}
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4">
                  <div className="flex items-center space-x-1.5">
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
                  {transcript.word_count && (
                    <div className="flex items-center space-x-1.5">
                      <FileAudio className="w-4 h-4" />
                      <span>{formatWordCount(transcript.word_count)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-1">
                <div className="relative group/btn">
                  <button
                    onClick={() => handleViewTranscript(transcript)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    View transcript
                  </span>
                </div>
                <div className="relative group/btn">
                  <button
                    onClick={() => startRenaming(transcript)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Rename
                  </span>
                </div>
                <div className="relative group/btn">
                  <button
                    onClick={() => handleDownload(transcript, 'txt')}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Download TXT
                  </span>
                </div>
                <div className="relative group/btn">
                  <button
                    onClick={() => handleDownload(transcript, 'json')}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FileJson className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Download JSON
                  </span>
                </div>
                <div className="relative group/btn">
                  <button
                    onClick={() => handleDeleteClick(transcript)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    Delete
                  </span>
                </div>
              </div>
            </div>

            {/* Preview on hover */}
            {hoveredTranscript === transcript.id && transcript.preview && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {transcript.preview}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Transcript Modal/Viewer */}
      {selectedTranscript && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-7xl w-full max-h-[90vh] flex flex-col">
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowChat(!showChat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showChat
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {showChat ? 'Hide Chat' : 'AI Chat'}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTranscript(null)
                      setShowChat(false)
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content - Split View */}
            <div className="flex-1 overflow-hidden flex">
              {/* Transcript Content */}
              <div className={`${showChat ? 'w-2/5' : 'w-full'} p-6 overflow-y-auto border-r border-gray-200 bg-gray-50`}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {transcriptData.utterances && transcriptData.utterances.length > 0 ? (
                      transcriptData.utterances.map((utterance, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {editingSpeaker === utterance.speaker ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="text-sm font-bold text-primary-700 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveSpeakerName()
                                      if (e.key === 'Escape') setEditingSpeaker(null)
                                    }}
                                  />
                                  <button
                                    onClick={saveSpeakerName}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingSpeaker(null)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <span className="text-sm font-bold text-primary-700">
                                    {getSpeakerName(utterance.speaker)}
                                  </span>
                                  <button
                                    onClick={() => startEditing(utterance.speaker, getSpeakerName(utterance.speaker))}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition-opacity"
                                    title="Rename speaker"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <span className="text-xs text-gray-400 font-mono">
                                {new Date(utterance.start).toISOString().substr(14, 5)}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-700 leading-relaxed">
                            {utterance.text}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <p>No structured transcript data available.</p>
                        <p className="text-sm mt-2">This might be an older transcript or processing failed.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chat Interface */}
              {showChat && (
                <div className="w-3/5 flex flex-col bg-white">
                  {selectedTranscript.database_id ? (
                    <ChatInterface
                      transcriptId={selectedTranscript.database_id}
                      transcriptPreview={
                        transcriptData.utterances
                          .map(u => `${getSpeakerName(u.speaker)}: ${u.text}`)
                          .join('\n')
                      }
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8 text-center">
                      <MessageCircle className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Chat Not Available
                      </h3>
                    </div>
                  )}
                </div>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Delete Transcript
            </h3>
            <p className="text-gray-500 text-center mb-2">
              Are you sure you want to delete
            </p>
            <p className="text-gray-900 font-medium text-center mb-4 truncate">
              "{deleteConfirm.filename}"?
            </p>
            <p className="text-sm text-red-600 text-center mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TranscriptViewer
