const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path alias resolution for Metro
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
  '@/components': path.resolve(__dirname, './components'),
  '@/lib': path.resolve(__dirname, './lib'),
  '@/assets': path.resolve(__dirname, './assets'),
};

module.exports = config;
