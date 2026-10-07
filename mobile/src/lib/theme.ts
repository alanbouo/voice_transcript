import { useColorScheme } from 'react-native'

const primary = {
  50: '#f0f9ff',
  100: '#e0f2fe',
  400: '#38bdf8',
  500: '#0ea5e9',
  600: '#0284c7',
  700: '#0369a1',
}

export const light = {
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: primary[600],
  primarySoft: primary[50],
  onPrimary: '#ffffff',
  danger: '#dc2626',
  success: '#16a34a',
  bubbleUser: primary[600],
  bubbleAi: '#e2e8f0',
}

export type Theme = typeof light

export const dark: Theme = {
  bg: '#0b1220',
  card: '#111a2e',
  text: '#f1f5f9',
  muted: '#94a3b8',
  border: '#1e293b',
  primary: primary[500],
  primarySoft: '#0c2a40',
  onPrimary: '#ffffff',
  danger: '#f87171',
  success: '#4ade80',
  bubbleUser: primary[600],
  bubbleAi: '#1e293b',
}

export const useTheme = (): Theme => (useColorScheme() === 'dark' ? dark : light)
