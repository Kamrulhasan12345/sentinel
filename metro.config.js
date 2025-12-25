const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .tflite to the list of asset extensions
config.resolver.assetExts.push('tflite');

module.exports = config;
