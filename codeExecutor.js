import { getSceneAPI } from "./sceneContext.js";

export async function executeGeneratedCode(codeString) {
  const api = getSceneAPI();
  const paramNames = Object.keys(api);
  const paramValues = Object.values(api);

  const wrappedCode = `"use strict";
return (async () => {
${codeString}
})();`;

  try {
    const fn = new Function(...paramNames, wrappedCode);
    const result = await fn(...paramValues);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}
