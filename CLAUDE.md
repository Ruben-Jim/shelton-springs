@~/Dev/Apps/blueprints/cwr-master-context.md

## This project: Shelton Springs HOA (live client, care plan)

HOA community app: notices, documents, fees and fines, board, polls, damage reports, and push notifications. Live on the web (sheltonsprings.homes), iOS, and Android. A care plan started 2026-10-07. **Bug fixes are covered. New features are billable, so flag scope before building one.**

### Stack in this repo (exceptions to the CWR stack)
- Expo SDK 54 · RN 0.81 · TypeScript 5.9
- **Backend is Convex, not Firebase.** Schema and functions are in `convex/` (`schema.ts`, `crons.ts`, `http.ts`, `push.ts`, ...). The URL comes from `EXPO_PUBLIC_CONVEX_URL` in `.env.local`.
- **Navigation is React Navigation, not Expo Router.** See `App.tsx` (`NavigationContainer`), `src/navigation/`, and screens in `src/screens/`. `expo-router` is installed but isn't the router, so don't add `app/` routes.
- Claude tooling here: the Convex plugin (skills only; its MCP is blocked, so never query deployment data) and the `react-navigation` skill.
- Payments: PayPal/Venmo tracking only. Stripe was removed (see `markdown/STRIPE_REMOVAL_SUMMARY.md`).

### Use what exists
- Sheet: `src/components/ios/IosFormSheet.tsx` (Reanimated + Gesture Handler, `dismissEnabled`)
- Notifications: `src/services/` has both `Enhanced*` and `Latest*` notification managers. Check which one is actually imported before editing either.
- There's no cross-platform alert helper. About 21 `.tsx` files call `Alert.alert`, which does nothing on web. Flag it when it matters; don't sweep.

### Commands
- `npm start` · `npx convex dev` · `npm run web` · `npx tsc --noEmit` · `npm run lint`
- **Ask first:**
  - `npm run deploy` (exports and publishes to GitHub Pages, which is the live site)
  - `npx convex deploy` (production data)
  - EAS production builds and submits

### Traps
- The Play Store submit key is in `~/keys/shelton-springs-play-service-account.json` (`eas.json` → `submit.production.android`). **Never read it, and never copy it into the repo.**
- Production checklist for store builds: `PRODUCTION_BUILD_CHECKLIST.md`
