import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ['src/frontend/**/*'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@/backend/*'], message: 'Frontend code must not import from @/backend' }]
      }],
    },
  },
  {
    files: ['src/backend/**/*'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@/frontend/*'], message: 'Backend code must not import from @/frontend' }]
      }],
    },
  },
]);

export default eslintConfig;
