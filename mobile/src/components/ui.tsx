import { ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../lib/theme'

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const content = { padding: padded ? 20 : 0, paddingBottom: insets.bottom + 20, flexGrow: 1 }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, ...content }}>{children}</View>
      )}
    </KeyboardAvoidingView>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}) {
  const t = useTheme()
  const palette = {
    primary: { bg: t.primary, fg: t.onPrimary, border: t.primary },
    secondary: { bg: t.card, fg: t.text, border: t.border },
    danger: { bg: t.danger, fg: '#fff', border: t.danger },
    ghost: { bg: 'transparent', fg: t.primary, border: 'transparent' },
  }[variant]
  const off = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>}
    </Pressable>
  )
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme()
  const { label, style, ...rest } = props
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        style={[styles.input, { backgroundColor: t.card, borderColor: t.border, color: t.text }, style]}
        {...rest}
      />
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme()
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>
}

export function ErrorText({ children }: { children?: string | null }) {
  const t = useTheme()
  if (!children) return null
  return <Text style={{ color: t.danger, marginBottom: 12 }}>{children}</Text>
}

export function Heading({ children }: { children: ReactNode }) {
  const t = useTheme()
  return <Text style={{ color: t.text, fontSize: 24, fontWeight: '700', marginBottom: 6 }}>{children}</Text>
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const t = useTheme()
  return <Text style={[{ color: t.muted, fontSize: 14 }, style]}>{children}</Text>
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
})
