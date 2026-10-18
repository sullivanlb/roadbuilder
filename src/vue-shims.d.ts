/**
 * Ambient declaration so plain `tsc` (used by typescript-eslint) can resolve
 * `*.vue` imports. `vue-tsc` resolves the real SFCs and ignores this shim.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
