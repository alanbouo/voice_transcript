import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ChatMessage, errorMessage } from '../lib/api'
import { useTheme } from '../lib/theme'
import { ErrorText, Muted } from './ui'

interface Props {
  loadHistory?: () => Promise<ChatMessage[]>
  send: (message: string) => Promise<string>
  onClear?: () => Promise<void>
}

export function ChatPanel({ loadHistory, send, onClear }: Props) {
  const t = useTheme()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useRef<FlatList<ChatMessage>>(null)

  useEffect(() => {
    loadHistory?.().then(setMessages).catch(() => {})
  }, [loadHistory])

  const submit = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError(null)
    setSending(true)
    setMessages((m) => [...m, { role: 'user', content: text }])
    try {
      const reply = await send(text)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(errorMessage(e, "Le message n'a pas pu être envoyé"))
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Muted style={{ textAlign: 'center', marginTop: 40 }}>Posez une question sur cette transcription.</Muted>}
        renderItem={({ item }) => {
          const mine = item.role === 'user'
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? t.bubbleUser : t.bubbleAi }]}>
              <Text selectable style={{ color: mine ? '#fff' : t.text, fontSize: 15, lineHeight: 21 }}>
                {item.content}
              </Text>
            </View>
          )
        }}
        ListFooterComponent={sending ? <ActivityIndicator style={{ marginTop: 8 }} color={t.primary} /> : null}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <ErrorText>{error}</ErrorText>
      </View>
      <View style={[styles.bar, { borderTopColor: t.border, backgroundColor: t.card }]}>
        {onClear && messages.length > 0 && (
          <Pressable
            accessibilityLabel="Effacer la conversation"
            onPress={() => onClear().then(() => setMessages([])).catch((e) => setError(errorMessage(e)))}
            style={{ paddingHorizontal: 8 }}
          >
            <Text style={{ color: t.muted, fontSize: 18 }}>🗑</Text>
          </Pressable>
        )}
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Votre question…"
          placeholderTextColor={t.muted}
          multiline
          style={[styles.input, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
        />
        <Pressable
          onPress={submit}
          disabled={!input.trim() || sending}
          style={[styles.send, { backgroundColor: t.primary, opacity: !input.trim() || sending ? 0.5 : 1 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Envoyer</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15 },
  send: { height: 42, borderRadius: 21, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
})
