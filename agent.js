const PROXY_URL = "http://localhost:9876/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";

let apiKey = "";
const conversationHistory = [];

export function setApiKey(key) {
  apiKey = key.trim();
}
export function getApiKey() {
  return apiKey;
}

const SYSTEM_PROMPT = `You are a 3D scene builder. You write JavaScript code that runs in a Three.js scene.

SCENE LAYOUT:
- Ground is a brown plane at y = -5.
- 40 earthy-colored blocks sit on the ground.
- Background is a gradient blue sky.
- Lighting: HemisphereLight (sky/ground) + DirectionalLight ("sun") with shadows.
- Shadows are enabled (PCFSoftShadowMap). Objects you create should cast/receive shadows.
- Camera starts at radius 12 from origin, controlled by hand gestures.

AVAILABLE API (all in scope, no imports needed):
- THREE — the full Three.js namespace
- scene, camera — the live scene and camera
- GROUND_Y — equals -5 (top of ground)

Object helpers (return a Mesh, do NOT add to scene):
- createSphere(radius, color, {x,y,z})
- createBox(width, height, depth, color, {x,y,z})
- createCylinder(radiusTop, radiusBottom, height, color, {x,y,z})
- createPlane(width, height, color, {x,y,z})

Light helpers (return a Light, do NOT add to scene):
- addPointLight(color, intensity, {x,y,z})
- addDirectionalLight(color, intensity, {x,y,z})
- addAmbientLight(color, intensity)

Scene management:
- addObject(mesh, "name") — adds to scene + registry. ALWAYS give a name.
- removeObject("name") — remove by name
- getObject("name") — get existing object to modify
- listObjects() — array of registered names
- clearAll() — remove all agent-created objects (keeps original blocks)

Animation:
- addAnimation("name", (delta) => { ... }) — runs every frame, delta in seconds
- removeAnimation("name")

Utilities:
- vec3(x,y,z), color(c), degToRad(deg)
- await loadGLTF(url) — load a .glb/.gltf file

RULES:
1. Output ONLY a fenced JS code block (\`\`\`js ... \`\`\`).
2. Before/after the fence you may write a SHORT explanation (1-2 sentences).
3. Always use addObject(mesh, "name") to add objects.
4. Use MeshStandardMaterial for objects (lights are already in the scene).
5. Position objects relative to GROUND_Y (-5). An object sitting on the ground: y = GROUND_Y + height/2.
6. For animations, use addAnimation with a descriptive name.
7. To modify an existing object, use getObject("name") and change its properties.
8. Colors can be hex numbers (0xff0000) or strings ("#ff0000").
9. When asked to clear/reset, call clearAll().
10. Keep code concise. No imports, no DOM access.`;

export async function askAgent(userMessage) {
  if (!apiKey) throw new Error("API key not set");

  conversationHistory.push({ role: "user", content: userMessage });

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: conversationHistory,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const assistantText = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  conversationHistory.push({ role: "assistant", content: assistantText });

  // extract code from ```js ... ``` fences
  const codeMatch = assistantText.match(/```(?:js|javascript)\s*\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : null;

  // explanation is everything outside the code fence
  const explanation = assistantText
    .replace(/```(?:js|javascript)\s*\n[\s\S]*?```/g, "")
    .trim();

  return { code, explanation, raw: assistantText };
}
