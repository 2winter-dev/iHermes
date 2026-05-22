# iHermes Chat

A mobile-first Hermes client built with Expo. Connect to your own Hermes agent directly from Android / iOS / Web(PWA), with no mandatory backend service.

## Repository
- Temporary repo URL: https://github.com/2winter/iHermes

## Why iHermes
- Pure app direct connection: user provides their own Hermes base URL + API key.
- Multi-instance management: save, switch, and test multiple Hermes endpoints.
- Chat-first UX: lightweight floating tab bar, fast chat entry, streaming responses.
- Tool-call visibility: step-by-step tool execution timeline during a reply.
- Mobile-first design: warm comic-inspired UI that still works on web/PWA.

## Preview

### Overview
![overview](previewImages/overview.jpg)

### Warm Theme
![orange-theme](previewImages/orange-theme.jpg)
![orange-theme-chat](previewImages/orange-theme-chat.jpg)
![orange-theme-chat2](previewImages/orange-theme-chat2.jpg)

### Soft Theme
![blue-theme](previewImages/blue-theme.jpg)
![blue-theme-chat](previewImages/blue-theme-chat.jpg)
![blue-theme-chat2](previewImages/blue-theme-chat2.jpg)

## Features
- Instance management
  - Add / edit / delete connection
  - Auto-select and quick reconnect
  - Connection state indicator and manual refresh
- Conversation
  - SSE streaming output
  - Thinking skeleton and phase indicator
  - Expandable tool-call steps (order + status)
  - Retry last reply / copy last reply
  - Message timestamp + long-press copy
- Settings
  - Theme toggle (warm/soft)
  - Animation toggle
  - Version info display (Hermes + app)
  - Help / FAQ / author contact
- Persistence
  - Connections, preferences, and chat history stored locally
  - Native uses SecureStore, web uses localStorage fallback

## Architecture
- Frontend: Expo + React Native + React Native Web
- API mode: direct browser/app -> Hermes gateway
- No mandatory server API for this project

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo SDK 56 environment

### Install
```bash
npm install
```

### Run
```bash
npm run start
npm run android
npm run ios
npm run web
```

### Web Build
```bash
npm run web:build
```

### Web Deploy (Vercel)
```bash
npm run web:deploy
```

## Android APK (for release distribution)
- Recommended: upload APK to GitHub Releases / object storage, then reference download URL in app settings.
- Avoid bundling large APK files into Vercel deployment source (>100MB limit on Hobby).

## Hermes Connection Notes (Important)
For Web/PWA, browser security rules apply:
- HTTPS page cannot request plain HTTP APIs (mixed content block).
- CORS must be enabled by Hermes (or reverse proxy).

Recommended for Web/PWA:
- Use HTTPS endpoint for Hermes (e.g. Cloudflare Tunnel / Tailscale Funnel).
- Configure CORS allowlist for your web domain.

## Project Structure
```text
src/
  api/hermes/        # types + API client
  storage/           # connections/preferences/chat history
  theme/             # design tokens
App.tsx              # main UI and interaction logic
previewImages/       # README screenshots
scripts/             # build helper scripts
```

## Roadmap
- [ ] Export/import instance profiles
- [ ] Release channel for stable Android APK
- [ ] Better model metadata and capability detection
- [ ] Optional self-hosted lightweight relay mode

## Contributing
Contributions are welcome. Please read:
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md

## License
MIT
