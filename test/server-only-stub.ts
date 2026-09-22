/**
 * `server-only` has no runtime: Next's bundler resolves it to a build-time
 * error if a Client Component imports it. Vitest has no bundler, so the import
 * would just fail to resolve. Aliasing it here keeps the guard in the source
 * where it belongs instead of dropping it to make tests run.
 */
export {};
