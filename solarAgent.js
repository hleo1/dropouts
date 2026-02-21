const PROXY_URL = "http://localhost:9876/v1/messages";
const MODEL = "claude-opus-4-6";

const conversationHistory = [];

const SYSTEM_PROMPT = `You are a 3D scene builder. You write JavaScript code that runs in a Three.js scene.

SCENE LAYOUT:
- Background is black (space). No ground plane.
- A glowing sun sits at the origin with a PointLight attached.
- 8 planets orbit the sun in the XZ plane (y=0).
- A dim AmbientLight provides baseline visibility.
- Camera starts at (0, 15, 40), controlled by hand gestures.

PRE-EXISTING OBJECTS (already registered, use getObject to modify or removeObject to delete):
- "sun" — emissive sphere at origin, radius 2
- "mercury" — small gray planet, orbit radius 4
- "venus" — yellow-orange planet, orbit radius 6
- "earth" — blue planet, orbit radius 8 (has a moon child)
- "mars" — red planet, orbit radius 10
- "jupiter" — large orange planet, orbit radius 14
- "saturn" — ringed planet, orbit radius 18
- "uranus" — cyan planet, orbit radius 22 (tilted)
- "neptune" — dark blue planet, orbit radius 26

AVAILABLE API (all in scope, no imports needed):
- THREE — the full Three.js namespace
- scene, camera — the live scene and camera
- GROUND_Y — equals -5 (not really used here; objects float at y=0)

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
- getSelected() — returns the name of the user's currently selected object (via finger-gun pointing), or null
- clearAll() — remove ALL registered objects (including pre-existing scene objects)

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
4. Use MeshStandardMaterial for objects.
5. Objects float in space — position relative to y=0. No ground plane.
6. For animations, use addAnimation with a descriptive name.
7. To modify an existing object, use getObject("name") and change its properties.
8. Colors can be hex numbers (0xff0000) or strings ("#ff0000").
9. When asked to clear/reset, call clearAll().
10. Keep code concise. No imports, no DOM access.`;

export async function askAgent(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "proxy-injected",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      temperature: 1,
      thinking: {
        type: "enabled",
        budget_tokens: 10000,
      },
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

  // keep full content blocks (including thinking) for valid conversation history
  conversationHistory.push({ role: "assistant", content: data.content });

  // extract code from ```js ... ``` fences
  const codeMatch = assistantText.match(/```(?:js|javascript)\s*\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : null;

  // explanation is everything outside the code fence
  const explanation = assistantText
    .replace(/```(?:js|javascript)\s*\n[\s\S]*?```/g, "")
    .trim();

  return { code, explanation, raw: assistantText };
}
