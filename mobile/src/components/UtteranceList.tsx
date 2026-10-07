import { FlatList, Pressable, Text, View } from 'react-native'
import { Utterance } from '../lib/api'
import { useTheme } from '../lib/theme'
import { Muted } from './ui'

const PALETTE = ['#0284c7', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0d9488']

interface Props {
  utterances: Utterance[]
  showTimestamps: boolean
  /** Tap on a speaker name (used to rename). */
  onSpeakerPress?: (u: Utterance) => void
}

export function UtteranceList({ utterances, showTimestamps, onSpeakerPress }: Props) {
  const t = useTheme()
  const colors = new Map<string, string>()
  utterances.forEach((u) => {
    if (!colors.has(u.speaker)) colors.set(u.speaker, PALETTE[colors.size % PALETTE.length])
  })

  return (
    <FlatList
      data={utterances}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={{ padding: 16, gap: 14 }}
      ListEmptyComponent={<Muted style={{ textAlign: 'center' }}>Aucun contenu.</Muted>}
      renderItem={({ item }) => (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Pressable disabled={!onSpeakerPress} onPress={() => onSpeakerPress?.(item)}>
              <Text style={{ color: colors.get(item.speaker), fontWeight: '700' }}>{item.speaker_name ?? item.speaker}</Text>
            </Pressable>
            {showTimestamps && <Muted style={{ fontSize: 12 }}>{item.timestamp}</Muted>}
          </View>
          <Text selectable style={{ color: t.text, fontSize: 16, lineHeight: 23 }}>
            {item.text}
          </Text>
        </View>
      )}
    />
  )
}
