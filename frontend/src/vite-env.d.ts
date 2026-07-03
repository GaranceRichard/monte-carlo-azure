/// <reference types="vite/client" />
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_PAGES?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
