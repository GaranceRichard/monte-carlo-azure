/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_PAGES?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
