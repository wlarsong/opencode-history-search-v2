/**
 * Node ESM loader hook: resolves "bun:sqlite" to the local shim so the
 * search code can be smoke-tested under Node without Bun installed.
 */
export async function resolve(specifier, context, next) {
  if (specifier === "bun:sqlite") {
    return {
      url: new URL("./sqlite-shim.mjs", import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
