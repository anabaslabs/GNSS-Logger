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
3. Target `arm64-v8a` only (reduces build time and prevents CMake long-path errors).
   In [android/gradle.properties](file:///d:/Anabas-Labs/GNSS-Logger/android/gradle.properties#L31), update:
   ```properties
   reactNativeArchitectures=arm64-v8a
   ```

4. Run the production build command:
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
