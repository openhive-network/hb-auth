import _dts from "rollup-plugin-dts";
import _esbuild from "rollup-plugin-esbuild";
import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

const esbuild = _esbuild?.default ?? _esbuild;
const dts = _dts?.default ?? _dts;

const name = require("./package.json").main.replace(/\.js$/, "");

const bundle = (config) => ({
  ...config,
  input: "src/index.ts",
  external: (id) => !/^[./]/.test(id),
});

export default [
  bundle({
    output: [
      {
        file: `${name}.js`,
        format: "cjs",
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: `${name}.mjs`,
        format: "es",
        sourcemap: true,
        inlineDynamicImports: true,
      },
    ],
    plugins: [esbuild(), replace({
      "require('worker')": "require('./worker.js')",
      "from 'worker'": "from './worker.mjs'",
      delimiters: ['', ''],
      preventAssignment: true,
    }),],
  }),
  bundle({
    plugins: [dts()],
    output: {
      file: `${name}.d.ts`,
      format: "es",
    },
  }),
  {
    input: ["src/worker.ts"],
    output: [
      {
        file: `dist/worker.js`,
        format: "es",
      },
    ],
    plugins: [
      resolve(),
      terser({
        warnings: true,
        mangle: {
          module: true,
        },
      }),
      {
        name: "worker-to-string",
        renderChunk(str) {
          return `export default '${str}'`;
        },
      },
    ],
  },
];
