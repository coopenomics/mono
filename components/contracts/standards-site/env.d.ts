/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

/** Версия платформы из lerna.json, подставляется vite при сборке. */
declare const __MONO_VERSION__: string;
