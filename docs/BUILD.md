# GNSS Logger Release Guide

### 1. Before Build (Production APK Size Optimization)

1. Remove `"expo-dev-client"` from `devDependencies` in `package.json`.
2. Sync packages and configurations:
   ```bash
   pnpm i
   ```
   ```bash
   pnpm prebuild
   ```
3. Run the production build command:
   ```bash
   pnpm build:android
   ```
   _APK Location: `android/app/build/outputs/apk/release/app-release.apk`_

### 2. After Build (Restore Local Development)

1. Add `"expo-dev-client": "~6.0.21"` back to `devDependencies` in `package.json`.
2. Re-sync package dependencies:
   ```bash
   pnpm i
   ```
   ```bash
   pnpm prebuild
   ```
