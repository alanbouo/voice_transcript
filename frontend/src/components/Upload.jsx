import { useState, useRef, useEffect } from 'react'
import { Upload as UploadIcon, FileAudio, X, CheckCircle, AlertCircle, Plus } from 'lucide-react'
import { transcribeAudio } from '../services/api'

function Upload({ onTranscriptComplete, defaultQuality = 'medium' }) {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState(defaultQuality)
  
  // Update quality when defaultQuality prop changes
  useEffect(() => {
    setQuality(defaultQuality)
  }, [defaultQuality])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState(null) // 'success' | 'error'
  const [message, setMessage] = useState('')
  const [progressLabel, setProgressLabel] = useState('')
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (selectedFile) => {
    const validTypes = ['audio/m4a', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-m4a']
    const maxSize = 100 * 1024 * 1024 // 100MB

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(m4a|mp3|wav)$/i)) {
      setStatus('error')
      setMessage('Invalid file type. Please upload an audio file (.m4a, .mp3, .wav)')
      return
    }

    if (selectedFile.size > maxSize) {
      setStatus('error')
      setMessage('File is too large. Maximum size is 100MB.')
      return
    }

    setFile(selectedFile)
    setStatus(null)
    setMessage('')
  }

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setProgress(0)
    setStatus(null)
    setMessage('')
    setProgressLabel('Uploading file...')

    try {
      const result = await transcribeAudio(file, quality, (prog) => {
        setProgress(prog)
        // Update label based on progress
        if (prog < 25) {
          setProgressLabel('Uploading file...')
        } else if (prog < 50) {
          setProgressLabel('Processing audio...')
        } else if (prog < 75) {
          setProgressLabel('Transcribing with AI...')
        } else if (prog < 95) {
          setProgressLabel('Finalizing transcription...')
        } else {
          setProgressLabel('Almost done...')
        }
      })
      setStatus('success')
      setMessage('Transcription completed successfully!')
      
      if (onTranscriptComplete) {
        onTranscriptComplete({
          id: result.id,
          filename: file.name,
          timestamp: new Date().toISOString(),
          textFile: result.text_file,
          jsonFile: result.json_file,
          database_id: result.database_id // Include database ID for chat feature
        })
      }

      // Don't auto-reset - let user manually start new transcription
    } catch (error) {
      setStatus('error')
      setMessage(error.response?.data?.error || 'Failed to transcribe audio. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setStatus(null)
    setMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
      {/* Title */}
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Audio File</h2>

      {/* File Input Area */}
      <div
        className={`relative rounded-lg transition-all ${
          dragActive ? 'ring-2 ring-blue-500' : ''
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleChange}
              accept=".m4a,.mp3,.wav,audio/*"
              className="hidden"
            />
            <span className="flex-1 text-gray-400 dark:text-gray-500">
              Click to select or drag audio file here
            </span>
            <button
              type="button"
              className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Browse
            </button>
          </div>
        ) : (
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3">
            <FileAudio className="w-5 h-5 text-blue-600 mr-3" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {!uploading && (
              <button
                onClick={removeFile}
                className="ml-2 text-gray-400 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Supported formats hint */}
      {!file && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Supported: M4A, MP3, WAV (Max 100MB)
        </p>
      )}

      {/* Quality Selector - Compact */}
      {file && !uploading && status !== 'success' && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Quality:</span>
          <div className="flex gap-2">
            {['low', 'medium', 'high'].map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-all ${
                  quality === q
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>{progressLabel}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          className={`mt-4 flex items-center gap-2 p-3 rounded-lg text-sm ${
            status === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Main Action Button */}
      {!uploading && status !== 'success' && (
        <button
          onClick={file ? handleUpload : () => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full mt-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {file ? 'Get Transcript & Summary' : 'Select Audio File'}
        </button>
      )}

      {/* New Transcription Button */}
      {status === 'success' && (
        <button
          onClick={() => {
            setFile(null)
            setProgress(0)
            setStatus(null)
            setMessage('')
            setProgressLabel('')
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}
          className="w-full mt-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Transcription
        </button>
      )}
    </div>
  )
}

export default Upload
