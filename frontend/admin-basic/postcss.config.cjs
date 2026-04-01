const plugins = {}

try {
  require.resolve('@tailwindcss/postcss')
  plugins['@tailwindcss/postcss'] = {}
} catch {
  plugins.tailwindcss = {}
}

plugins.autoprefixer = {}

module.exports = { plugins }
