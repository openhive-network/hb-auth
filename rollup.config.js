import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import { importMetaAssets } from '@web/rollup-plugin-import-meta-assets';


import data from "./package.json" assert { type: "json" };

const name = data.main.replace(/\.js$/, "").replace(".mjs", "");

const bundle = (config) => ({
  ...config,
  input: ["src/index.ts"],
});

export default [
  bundle({
    output: [
      {
        file: `${name}.js`,
        format: "es",
      },
    ],
    plugins: [
      esbuild(),
      resolve({
        preferBuiltins: false,
        browser: true,
        resolveOnly: [
          'comlink', 'idb'
        ]
      }),
      replace({
        "from 'worker'": "from './worker.js'",
        delimiters: ["", ""],
        preventAssignment: true,
      }),
      commonjs(),
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
      importMetaAssets(),
      resolve({
        moduleDirectories: ["node_modules"],
      }),
      replace({
        delimiters: ["", ""],
        values: {
          'import.meta.url': 'self.location.href'
        },
        preventAssignment: true,
      }),
      terser({
        warnings: true,
        mangle: {
          module: true,
        },
      }),
    ],
  },
];
