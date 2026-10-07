import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { useTheme } from '../../lib/theme'

export default function AppTabs() {
  const t = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        tabBarActiveTintColor: t.primary,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Transcrire', tabBarIcon: ({ color, size }) => <Ionicons name="mic" color={color} size={size} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Historique', tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} /> }} />
    </Tabs>
  )
}
