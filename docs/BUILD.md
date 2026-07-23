# GNSS Logger Release Guide

### 1. Before Build (Production APK Size Optimization)

1. Remove `"expo-dev-client"` from `devDependencies` in [`package.json`](../package.json).

2. Sync packages and configurations:

   ```bash
   pnpm i
   ```

3. Target `arm64-v8a` only (reduces build time and prevents CMake long-path errors).
   In [`android/gradle.properties`](../android/gradle.properties), update:

   ```properties
   reactNativeArchitectures=arm64-v8a
   ```

4. Run the production build command:
   ```bash
   pnpm build
   ```
   _APK Location: [`android/app/build/outputs/apk/release`](../android/app/build/outputs/apk/release)_ -> `app-release.apk`

### 2. After Build (Restore Local Development)

1. Add `"expo-dev-client": "~6.0.21"` back to `devDependencies` in [`package.json`](../package.json).

2. Re-sync package dependencies:
   ```bash
   pnpm i
   ```
