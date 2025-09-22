import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default [
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], 
    languageOptions: { 
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2020,
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly",
        global: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
      }
    }
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: "detect"
      }
    },
    rules: {
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/no-unescaped-entities": "off", // Allow apostrophes and quotes in JSX
    }
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off", // Allow require() in config files
      "no-undef": "off", // TypeScript handles this
    }
  },
  {
    files: ["**/*.config.{js,mjs,cjs}", "**/scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly",
      }
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    }
  }
];
