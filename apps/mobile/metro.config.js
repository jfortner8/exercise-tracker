// Expo's Metro config finds the npm workspace on its own: it watches the repo root and resolves
// @et/core (TypeScript source, through its package "exports") from the shared node_modules.
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
