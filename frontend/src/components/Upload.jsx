import { useState, useRef } from 'react'
import { Upload as UploadIcon, FileAudio, X, CheckCircle, AlertCircle } from 'lucide-react'
import { transcribeAudio } from '../services/api'

function Upload({ onTranscriptComplete }) {
  const [file, setFile] = useState(null)
  const [quality, setQuality] = useState('high')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState(null) // 'success' | 'error'
  const [message, setMessage] = useState('')
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

    try {
      const result = await transcribeAudio(file, quality, setProgress)
      setStatus('success')
      setMessage('Transcription completed successfully!')
      
      if (onTranscriptComplete) {
        onTranscriptComplete({
          id: result.id,
          filename: file.name,
          timestamp: new Date().toISOString(),
          textFile: result.text_file,
          jsonFile: result.json_file
        })
      }

      // Reset form
      setTimeout(() => {
        setFile(null)
        setProgress(0)
        setStatus(null)
        setMessage('')
      }, 3000)
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
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Audio File</h2>

      {/* Drag & Drop Area */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <>
            <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drag and drop your audio file here
            </p>
            <p className="text-sm text-gray-500 mb-4">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
            >
              Browse Files
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Supported formats: M4A, MP3, WAV (Max 100MB)
            </p>
          </>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <FileAudio className="w-8 h-8 text-primary-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={removeFile}
                className="text-gray-400 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleChange}
          accept=".m4a,.mp3,.wav,audio/*"
          className="hidden"
        />
      </div>

      {/* Quality Selector */}
      {file && !uploading && (
        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Transcription Quality
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['low', 'medium', 'high'].map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${
                  quality === q
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {quality === 'high' && '128k bitrate - Best quality'}
            {quality === 'medium' && '96k bitrate - Balanced'}
            {quality === 'low' && '64k bitrate - Smaller file size'}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="mt-6">
          <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
            <span>Uploading & Transcribing...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary-600 h-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Message */}
      {status && (
        <div
          className={`mt-6 flex items-center space-x-2 p-4 rounded-lg ${
            status === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {status === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm">{message}</p>
        </div>
      )}

      {/* Upload Button */}
      {file && !uploading && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full btn-primary mt-6"
        >
          Start Transcription
        </button>
      )}
    </div>
  )
}

export default Upload
