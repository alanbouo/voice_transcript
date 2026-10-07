import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTheme } from '../lib/theme'
import { Button } from './ui'

interface Props {
  visible: boolean
  title: string
  initialValue: string
  onCancel: () => void
  onSubmit: (value: string) => void
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function PromptModal(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {props.visible && <PromptBody {...props} />}
    </Modal>
  )
}

function PromptBody({ title, initialValue, onCancel, onSubmit }: Props) {
  const t = useTheme()
  const [value, setValue] = useState(initialValue)

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.sheet, { backgroundColor: t.card }]} onPress={() => {}}>
          <Text style={{ color: t.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>{title}</Text>
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button title="Annuler" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
            <Button title="Valider" onPress={() => value.trim() && onSubmit(value.trim())} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, padding: 18 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
})
