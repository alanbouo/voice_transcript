import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Screen } from '../../components/ui'
import { UploadPanel } from '../../components/UploadPanel'
import { errorMessage, getSettings, Quality, transcribeAudio } from '../../lib/api'

export default function Transcribe() {
  const [quality, setQuality] = useState<Quality>('medium')

  useEffect(() => {
    getSettings()
      .then((s) => setQuality(s.default_quality))
      .catch(() => {})
  }, [])

  return (
    <Screen>
      <UploadPanel
        defaultQuality={quality}
        onSubmit={async (audio, q, onProgress) => {
          try {
            const res = await transcribeAudio(audio, q, onProgress)
            router.push({ pathname: '/transcript/[id]', params: { id: String(res.database_id) } })
          } catch (e) {
            throw new Error(errorMessage(e, 'Échec de la transcription'))
          }
        }}
      />
    </Screen>
  )
}
