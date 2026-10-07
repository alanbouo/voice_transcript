import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import * as DocumentPicker from 'expo-document-picker'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { PickedAudio, Quality } from '../lib/api'
import { useTheme } from '../lib/theme'
import { Button, Card, ErrorText, Muted } from './ui'

const QUALITIES: { value: Quality; label: string }[] = [
  { value: 'low', label: 'Basse' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'high', label: 'Haute' },
]

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  defaultQuality?: Quality
  /** Runs the upload; progress is reported 0-100. Throws on failure. */
  onSubmit: (audio: PickedAudio, quality: Quality, onProgress: (p: number) => void) => Promise<void>
}

export function UploadPanel({ defaultQuality = 'medium', onSubmit }: Props) {
  const t = useTheme()
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder, 250)
  const [chosenQuality, setQuality] = useState<Quality | null>(null)
  const quality = chosenQuality ?? defaultQuality
  const [audio, setAudio] = useState<PickedAudio | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = progress !== null
  const recording = state.isRecording

  const pickFile = async () => {
    setError(null)
    const res = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'],
      copyToCacheDirectory: true,
    })
    if (res.canceled) return
    const f = res.assets[0]
    setAudio({ uri: f.uri, name: f.name, mimeType: f.mimeType ?? 'application/octet-stream' })
  }

  const startRecording = async () => {
    setError(null)
    const perm = await requestRecordingPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Micro refusé', "Autorisez l'accès au micro dans les réglages pour enregistrer.")
      return
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
    setAudio(null)
  }

  const stopRecording = async () => {
    await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false })
    if (recorder.uri) {
      setAudio({ uri: recorder.uri, name: `enregistrement-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.m4a`, mimeType: 'audio/mp4' })
    }
  }

  const submit = async () => {
    if (!audio) return
    setError(null)
    setProgress(0)
    try {
      await onSubmit(audio, quality, setProgress)
      setAudio(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Échec de la transcription')
    } finally {
      setProgress(null)
    }
  }

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ alignItems: 'center', gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
          onPress={recording ? stopRecording : startRecording}
          disabled={busy}
          style={[styles.recBtn, { backgroundColor: recording ? t.danger : t.primary, opacity: busy ? 0.5 : 1 }]}
        >
          <View style={recording ? styles.stopIcon : styles.micDot} />
        </Pressable>
        <Text style={{ color: t.text, fontSize: 28, fontVariant: ['tabular-nums'] }}>
          {recording ? fmt(state.durationMillis) : '00:00'}
        </Text>
        <Muted>{recording ? 'Enregistrement en cours…' : 'Touchez pour enregistrer un mémo vocal'}</Muted>
      </Card>

      <Button title="Choisir un fichier audio/vidéo" variant="secondary" onPress={pickFile} disabled={busy || recording} />

      {audio && (
        <Card>
          <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
            {audio.name}
          </Text>
          <Muted style={{ marginTop: 4 }}>Prêt à être transcrit</Muted>
        </Card>
      )}

      <View>
        <Muted style={{ marginBottom: 8 }}>Qualité</Muted>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {QUALITIES.map((q) => (
            <Pressable
              key={q.value}
              onPress={() => setQuality(q.value)}
              style={[
                styles.chip,
                { borderColor: quality === q.value ? t.primary : t.border, backgroundColor: quality === q.value ? t.primarySoft : t.card },
              ]}
            >
              <Text style={{ color: quality === q.value ? t.primary : t.text, fontWeight: '600' }}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ErrorText>{error}</ErrorText>

      {busy ? (
        <Card>
          <Muted style={{ marginBottom: 8 }}>
            {progress < 25 ? 'Envoi…' : 'Transcription en cours (cela peut prendre quelques minutes)…'} {progress}%
          </Muted>
          <View style={[styles.track, { backgroundColor: t.border }]}>
            <View style={[styles.bar, { backgroundColor: t.primary, width: `${progress}%` }]} />
          </View>
        </Card>
      ) : (
        <Button title="Transcrire" onPress={submit} disabled={!audio || recording} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  recBtn: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  micDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff' },
  stopIcon: { width: 26, height: 26, borderRadius: 4, backgroundColor: '#fff' },
  chip: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
})
