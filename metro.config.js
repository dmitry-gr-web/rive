// Metro config for Expo
// Adds support for bundling .riv files as assets.

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure .riv is treated as an asset
config.resolver.assetExts = Array.from(new Set([...config.resolver.assetExts, 'riv']));

module.exports = config;
