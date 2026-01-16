import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "warn",
    },
  },
  {
    // Test files don't need the project reference
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    languageOptions: {
      parserOptions: {
        project: null,
      },
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "probe/**", "*.js", "*.mjs"],
  }
);
