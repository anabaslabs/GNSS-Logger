const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Disable package exports to prevent Metro from resolving to ESM versions of packages (like Zustand)
// that contain incompatible 'import.meta' statements.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
