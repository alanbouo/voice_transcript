import * as SecureStore from 'expo-secure-store'

const ACCESS = 'access_token'
const REFRESH = 'refresh_token'

// Tokens are cached in memory so the axios interceptor can read them synchronously.
let access: string | null = null
let refresh: string | null = null

export const loadTokens = async () => {
  ;[access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(REFRESH),
  ])
  return { access, refresh }
}

export const getAccessToken = () => access
export const getRefreshToken = () => refresh

export const saveAccessToken = async (token: string) => {
  access = token
  await SecureStore.setItemAsync(ACCESS, token)
}

export const saveTokens = async (accessToken: string, refreshToken: string) => {
  await saveAccessToken(accessToken)
  refresh = refreshToken
  await SecureStore.setItemAsync(REFRESH, refreshToken)
}

export const clearTokens = async () => {
  access = null
  refresh = null
  await Promise.all([SecureStore.deleteItemAsync(ACCESS), SecureStore.deleteItemAsync(REFRESH)])
}
