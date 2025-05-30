import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  {
    name: "node-bun-config",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        console: true,
        process: true,
        module: true,
        require: true,
        Bun: true,
      },
    },
    plugins: {
      "@typescript-eslint": ts,
    },
    rules: {},
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    settings: {
      "import/resolver": {
        node: true,
      },
    },
    ignores: ["**/__tests__/**", "**/*.test.ts"],
  },
]);
