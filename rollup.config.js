import pkg from './package.json';

export default {
  input: './lib/index.js',
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      preserveModules: true
    }
  ],
  plugins: [
  ],
  external: Object.keys(pkg.dependencies).concat(['crypto', 'util']),
};
