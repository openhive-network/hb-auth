import dts from "rollup-plugin-dts";
import esbuild from "rollup-plugin-esbuild";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";

import data from './package.json' assert { type: "json" };

const name = data.main.replace(/\.js$/, "").replace(".mjs", "");

const bundle = (config) => ({
  ...config,
  input: ["src/index.ts"]
});

export default [
  bundle({
    output: [
      {
        file: `${name}.js`,
        format: "es"
      },
    ],
    plugins: [
      esbuild(),
      resolve(),
      replace({
        "from 'worker'": "from './worker.js'",
        delimiters: ["", ""],
        preventAssignment: true,
      }),
      commonjs()
    ],
  }),
  bundle({
    output: [
      {
        file: `${name}.full.js`,
        format: 'es',
        sourcemap: false
      }
    ],
    plugins: [
      esbuild(),
      resolve(),
      commonjs()
    ]
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
    ],
  },
];
