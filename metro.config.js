const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add .tflite and .txt and .json to the list of asset extensions
config.resolver.assetExts.push("tflite", "json", "txt");

module.exports = config;
