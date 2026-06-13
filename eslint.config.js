import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}", "electron/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // File > 300 lines (excluding blank + comments) = ERROR to prevent bloating
      "max-lines": ["error", { 
        max: 300, 
        skipBlankLines: true, 
        skipComments: true 
      }],
      // Function > 80 lines = WARNING 
      "max-lines-per-function": ["warn", { 
        max: 80, 
        skipBlankLines: true, 
        skipComments: true 
      }],
    },
  },
  {
    // Data files, types, tests, and pre-existing legacy bloated files/folders are exempt
    files: [
      "src/**/*.test.{ts,tsx}",
      "electron/**/*.test.ts", 
      "src/types/**/*.ts",
      "src/**/data/**/*.ts",
      "src/**/*Content.ts",      // help content = pure data
      "src/**/*Guidance.ts",     // field guidance = pure data
      "src/**/*Defaults.ts",     // defaults = pure data
      "src/tests/**/*",
      // Legacy bloated components, pages, and libs are exempt from strict length rules
      "src/features/*/components/**/*.{ts,tsx}",
      "src/features/*/pages/**/*.{ts,tsx}",
      "src/features/*/state/*.ts", // exempt all feature states
      "src/features/workflows/lib/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/app/useAppNavigation.ts",
      "src/App.tsx",
      "src/AppPackageDialogs.tsx",
      "src/features/evidence/useEvidenceWorkspace.ts",
      "src/layouts/AppSidebar.tsx",
      // Backend files exempt
      "electron/backend/actions/**/*.{ts,tsx}",
      "electron/backend/browser/**/*.{ts,tsx}",
      "electron/backend/diagnostics/**/*.{ts,tsx}",
      "electron/backend/evidence/**/*.{ts,tsx}",
      "electron/backend/graph/**/*.{ts,tsx}",
      "electron/backend/identity/**/*.{ts,tsx}",
      "electron/backend/operations/**/*.{ts,tsx}",
      "electron/backend/persistence/**/*.{ts,tsx}",
      "electron/backend/projects/**/*.{ts,tsx}",
      "electron/backend/recording/**/*.{ts,tsx}",
      "electron/backend/commands/**/*.{ts,tsx}",
      "electron/backend/runtime/**/*.{ts,tsx}",
      "electron/backend/services/**/*.{ts,tsx}",
      "electron/backend/scheduling/**/*.{ts,tsx}",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
    },
  },
];
