module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
            '@/components': './components',
            '@/lib': './lib',
            '@/assets': './assets',
          },
        },
      ],
      // Reanimated v4 moved its Babel plugin into react-native-worklets
      'react-native-worklets/plugin',
    ],
  };
};
