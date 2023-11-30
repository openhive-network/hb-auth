import _dts from "rollup-plugin-dts";
import _esbuild from "rollup-plugin-esbuild";
import terser from "@rollup/plugin-terser";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

const esbuild = _esbuild?.default ?? _esbuild;
const dts = _dts?.default ?? _dts;

const name = require("./package.json").main.replace(/\.js$/, "");

function escape(str) {
  return str
    .replace(/[\\]/g, "\\\\")
    .replace(/[\"]/g, '\\"')
    .replace(/[\/]/g, "\\/")
    .replace(/[\b]/g, "\\b")
    .replace(/[\f]/g, "\\f")
    .replace(/[\n]/g, "\\n")
    .replace(/[\r]/g, "\\r")
    .replace(/[\t]/g, "\\t");
}

const bundle = (config) => ({
  ...config,
  input: ["src/index.ts"],
  external: (id) => !/^[./]/.test(id)
});

export default [
  
  bundle({
    output: [
      {
        file: `${name}.cjs`,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: `${name}.js`,
        format: "es",
        sourcemap: true,
      },
    ],
    plugins: [
      esbuild(),
      replace({
        "require('worker')": "require('./worker.js')",
        "from 'worker'": "from './worker.js'",
        delimiters: ["", ""],
        preventAssignment: true,
      }),
    ],
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
      esbuild(),
      resolve({
        moduleDirectories: ['node_modules']
      }),
      terser({
        warnings: true,
        mangle: {
          module: true,
        },
      }),
      {
        name: "worker-to-string",
        renderChunk(str) {
          return `export default "${escape(str)}"`;
        },
      },
    ],
  },
];
