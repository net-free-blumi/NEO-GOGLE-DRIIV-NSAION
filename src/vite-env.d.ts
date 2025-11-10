/// <reference types="vite/client" />

// Node.js types
declare namespace NodeJS {
  interface Timeout {
    ref(): Timeout;
    unref(): Timeout;
  }
}

// ImportMeta types
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ImportMetaEnv {
  readonly [key: string]: string | boolean | undefined;
}
