# Contributing Guide

Thanks for contributing to iHermes Chat.

## Workflow
1. Fork the repository.
2. Create a branch from `main`.
3. Make focused changes.
4. Run checks locally.
5. Open a pull request with clear context.

## Local Checks
```bash
npm install
npx tsc --noEmit
npm run web:build
```

## Commit Style
Use clear, scoped commit messages, for example:
- `feat(chat): add streaming phase indicator`
- `fix(web): avoid tabbar overlap on keyboard`
- `docs(readme): update PWA limitations`

## Pull Request Expectations
- Explain what changed and why.
- Include screenshots for UI changes.
- Mention testing done (platforms/commands).
- Keep PRs small and reviewable.

## Areas That Need Help
- Android release packaging workflow
- Web/PWA networking docs and troubleshooting
- Internationalization and docs quality

