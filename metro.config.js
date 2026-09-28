const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// 发布物 SQLite 单文件作为资源打包（Spike S1/S3）
config.resolver.assetExts.push('db');

module.exports = config;
