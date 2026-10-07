# MemoMind mobile (Expo)

React Native client for the MemoMind API (`../api`). Same backend as the web app
(`frontend/`): JWT auth, `/transcribe`, `/transcripts/*`, `/chat/*`, `/settings`.

## Run

```bash
cd mobile
npm install
npx expo start        # scan the QR code with Expo Go
```

The API defaults to `https://api.memomind.space` (`expo.extra.apiUrl` in `app.json`).
To target a local backend, set `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000` (see `.env.example`).

## Checks

```bash
npm run typecheck && npx expo lint && npx expo-doctor
```

## Release

```bash
npx eas-cli@latest build --profile preview --platform android   # installable APK
npx eas-cli@latest build --profile production                   # store builds
npx eas-cli@latest submit
```

Bundle ID / package is `space.memomind.app` (change in `app.json` before the first store build).

## Layout

- `src/app` — expo-router screens: `(auth)` login/signup/forgot, `(app)` tabs (record+upload, history, settings), `transcript/[id]`, `guest`
- `src/lib` — `api.ts` (axios + token refresh), `auth.tsx`, `storage.ts` (SecureStore), `theme.ts`
- `src/components` — shared UI, recorder/upload panel, chat, utterance list
