<h1 align="center">iHermes Chat</h1>
<p align="center">
  Mobile-first Hermes client built with Expo.
  <br/>
  Connect to your own Hermes agent from Android, iOS, and Web (PWA).
</p>

<p align="center">
  <b>English</b> · <a href="./README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://ihermes.2winter.com"><img alt="Live Demo" src="https://img.shields.io/badge/Live%20Demo-ihermes.2winter.com-ffb347?style=for-the-badge"/></a>
  <a href="https://snack.expo.dev/@yfd/ihermes"><img alt="Expo Snack" src="https://img.shields.io/badge/Expo%20Snack-Preview-000020?style=for-the-badge&logo=expo"/></a>
  <a href="https://github.com/2winter-dev/iHermes"><img alt="Repo" src="https://img.shields.io/badge/GitHub-2winter--dev%2FiHermes-24292f?style=for-the-badge&logo=github"/></a>
</p>

<p align="center">
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/2winter-dev/iHermes?style=flat-square"/></a>
  <img alt="Platform" src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue?style=flat-square"/>
  <img alt="Expo" src="https://img.shields.io/badge/Expo-SDK%2056-4630EB?style=flat-square&logo=expo"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Yes-3178C6?style=flat-square&logo=typescript"/>
</p>

## Quick Access

| Entry | Link |
| --- | --- |
| Repository | https://github.com/2winter-dev/iHermes |
| Web / PWA Preview | https://ihermes.2winter.com |
| Snack Demo | https://snack.expo.dev/@yfd/ihermes |
| Android APK | https://github.com/2winter-dev/iHermes/releases/tag/beta0.1 |

## Core Features

### Instance & Connection
- Add / edit / delete / switch Hermes instances
- Connection status check + manual refresh
- Local-first persistence

### Chat Experience
- SSE streaming replies
- Thinking skeleton + phase hints
- Expandable tool-call step timeline
- Retry / copy helpers, long-press bubble copy

### Settings
- Theme toggle (warm / soft)
- Animation switch
- **Multilingual support: Chinese / English, default follows device language, fallback to English**
- Version / help / FAQ

## Run Locally

```bash
npm install
npm run start
npm run android
npm run ios
npm run web
```

## Build Android APK

```bash
# default (debug)
npm run android:assemble

# explicit debug / release
npm run android:assemble:debug
npm run android:assemble:release
```

Output paths:
- debug: `android/app/build/outputs/apk/debug/`
- release: `android/app/build/outputs/apk/release/`

## Expo Go Preview

```bash
git clone https://github.com/2winter-dev/iHermes.git
cd iHermes
npm install
npx expo start --tunnel
```

Open Expo Go on your phone and scan the QR code.

## iOS Experience

iOS users can try iHermes in two ways:

**Option 1: Build from Source**

```bash
git clone https://github.com/2winter-dev/iHermes.git
cd iHermes
npm install
npx expo run:ios
```

**Option 2: Expo Go QR Code**

1. Download [Expo Go](https://apps.apple.com/app/expo-go/id982107779) from the App Store
2. Scan the QR code below with the **system camera** to try it out

<p align="center">
  <img src="previewImages/expo-ihermes.png" alt="expo-qr" width="220" />
</p>



## Hermes Connectivity Notes for Web/PWA
- HTTPS pages cannot call plain HTTP APIs (mixed content blocked)
- Hermes endpoint must return correct CORS headers

Recommended setup:
- Expose Hermes via HTTPS (Cloudflare Tunnel / Tailscale Funnel)
- Configure proper CORS allowlist

## Project Stats

<p align="center">
  <img alt="last-commit" src="https://img.shields.io/github/last-commit/2winter-dev/iHermes?style=flat-square"/>
  <img alt="issues" src="https://img.shields.io/github/issues/2winter-dev/iHermes?style=flat-square"/>
  <img alt="pr" src="https://img.shields.io/github/issues-pr/2winter-dev/iHermes?style=flat-square"/>
  <img alt="repo-size" src="https://img.shields.io/github/repo-size/2winter-dev/iHermes?style=flat-square"/>
  <img alt="top-language" src="https://img.shields.io/github/languages/top/2winter-dev/iHermes?style=flat-square"/>
</p>

## Contributing
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

## License
MIT License. See [LICENSE](./LICENSE).
