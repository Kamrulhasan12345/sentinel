const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add .tflite and .txt and .json to the list of asset extensions
config.resolver.assetExts.push("tflite");
config.resolver.assetExts.push("txt");
config.resolver.assetExts.push("json");

module.exports = config;
