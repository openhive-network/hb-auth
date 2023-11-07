module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["standard-with-typescript", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig.eslint.json",
    tsconfigRootDir: __dirname,
  },
  rules: {
    "n/handle-callback-err": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "new-cap": "off",
    "@typescript-eslint/naming-convention": "off"
  },
};
