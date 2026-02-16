const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const resolver = config.resolver ?? {};
const assetExts = resolver.assetExts ?? [];

// Add path alias resolution for Metro
config.resolver = {
  ...resolver,
  // expo-sqlite web imports a wasm binary (wa-sqlite.wasm)
  // so Metro must treat `.wasm` as a resolvable asset extension.
  assetExts: assetExts.includes('wasm') ? assetExts : [...assetExts, 'wasm'],
  alias: {
    ...(resolver.alias ?? {}),
    '@': path.resolve(__dirname, './'),
    '@/components': path.resolve(__dirname, './components'),
    '@/lib': path.resolve(__dirname, './lib'),
    '@/assets': path.resolve(__dirname, './assets'),
  },
};

module.exports = config;
