<h1 align="center">iHermes Chat</h1>
<p align="center">
  Mobile-first Hermes client built with Expo.
  <br/>
  Connect to your own Hermes agent from Android, iOS, and Web (PWA).
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
  <img alt="React Native" src="https://img.shields.io/badge/React%20Native-0.85-61DAFB?style=flat-square&logo=react"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Yes-3178C6?style=flat-square&logo=typescript"/>
</p>

<p align="center">
  <img alt="Stars" src="https://img.shields.io/github/stars/2winter-dev/iHermes?style=social"/>
  <img alt="Forks" src="https://img.shields.io/github/forks/2winter-dev/iHermes?style=social"/>
</p>

## Quick Access

| Entry | Link |
| --- | --- |
| Repository | https://github.com/2winter-dev/iHermes |
| Web / PWA Preview | https://ihermes.2winter.com |
| Snack Demo | https://snack.expo.dev/@yfd/ihermes |
| Android APK | https://github.com/2winter-dev/iHermes/releases/tag/beta0.1 |

## Snack Preview

<p align="center">
  <a href="https://snack.expo.dev/@yfd/ihermes">
    <img src="https://img.shields.io/badge/Open%20Interactive%20Snack-Click%20to%20Preview-000020?style=for-the-badge&logo=expo" alt="open-snack"/>
  </a>
</p>

<p align="center">
  <a href="https://snack.expo.dev/@yfd/ihermes">
    <img src="previewImages/overview.jpg" alt="snack-preview-cover" width="280"/>
  </a>
</p>

## Preview Gallery

<table>
  <tr>
    <td align="center"><b>Overview</b></td>
  </tr>
  <tr>
    <td align="center"><img src="previewImages/overview.jpg" alt="overview" width="280" /></td>
  </tr>
</table>

<table>
  <tr>
    <td align="center"><b>Warm Theme</b></td>
    <td align="center"><b>Soft Theme</b></td>
  </tr>
  <tr>
    <td align="center">
      <img src="previewImages/orange-theme.jpg" alt="orange-theme" width="210" />
      <img src="previewImages/orange-theme-chat.jpg" alt="orange-theme-chat" width="210" />
      <img src="previewImages/orange-theme-chat2.jpg" alt="orange-theme-chat2" width="210" />
    </td>
    <td align="center">
      <img src="previewImages/blue-theme.jpg" alt="blue-theme" width="210" />
      <img src="previewImages/blue-theme-chat.jpg" alt="blue-theme-chat" width="210" />
      <img src="previewImages/blue-theme-chat2.jpg" alt="blue-theme-chat2" width="210" />
    </td>
  </tr>
</table>

## Features

### Connection & Instances
- Add / edit / delete Hermes instances
- Fast instance switching with auto-select
- Connection state indicator and manual refresh
- Local-first credentials and settings persistence

### Conversation UX
- Streaming (SSE) assistant output
- Thinking skeleton and phase hint
- Expandable tool-call timeline (order + status)
- Retry last answer / copy latest answer
- Message timestamp and long-press copy

### Settings & Help
- Warm / soft theme toggle
- Animation switch
- Hermes version + app version display
- API key setup notes and FAQ guidance

## Tech Stack

- Expo + React Native + React Native Web
- TypeScript
- `expo-secure-store`, `expo-clipboard`, `@expo/vector-icons`
- Vercel (web deployment)

## Run Locally

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo SDK 56 environment

### Install
```bash
npm install
```

### Start
```bash
npm run start
npm run android
npm run ios
npm run web
```

### Build Web
```bash
npm run web:build
```

### Deploy Web
```bash
npm run web:deploy
```

## Expo Go Preview

```bash
git clone https://github.com/2winter-dev/iHermes.git
cd iHermes
npm install
npx expo start --tunnel
```

Open Expo Go on your phone and scan the QR code.

## Hermes Connectivity Notes (Web/PWA)

Web/PWA requests are restricted by browser security policies.

- HTTPS pages cannot call plain HTTP APIs (mixed content blocked)
- Hermes endpoint must return proper CORS headers

Recommended setup:
- Expose Hermes through HTTPS (for example: Cloudflare Tunnel / Tailscale Funnel)
- Allow your web domain in CORS policy

## Project Structure

```text
src/
  api/hermes/        # Types + API client
  storage/           # Connections / preferences / chat history
  theme/             # Design tokens
App.tsx              # Main UI and interaction logic
previewImages/       # README screenshot resources
scripts/             # Build helper scripts
```

## Project Stats

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api/pin/?username=2winter-dev&repo=iHermes&theme=default&hide_border=true" alt="repo-card" />
</p>

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api/top-langs/?username=2winter-dev&layout=compact&theme=default&hide_border=true" alt="top-langs" />
</p>

## Roadmap

- [ ] Export / import instance profiles
- [ ] Stable Android release pipeline
- [ ] Better model metadata + capability detection
- [ ] Optional lightweight relay mode

## Contributing

Contributions are welcome. Please read:
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)

## License

MIT License. See [LICENSE](./LICENSE).
