// Metro padrão do Expo + suporte a .wasm (necessário só para o expo-sqlite na pré-visualização web).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');

module.exports = config;
