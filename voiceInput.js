import { SonioxClient } from "soniox-stt";

const RETRY_DELAY_MS = 2000;
const CONFIG_URL = "http://localhost:9876/config";

async function fetchSonioxKey() {
  const res = await fetch(CONFIG_URL);
  const { sonioxKey } = await res.json();
  return sonioxKey;
}
// STT often mishears "Claude" as cloud, clod, claud, klod, quad, etc.
const ACTIVATION_RE = /^\s*(?:hey\s+|ok\s+|okay\s+)?(?:claude|cloud|clod|claud|klod|klawd|clawd|quad|claw|claw'd|clawed|cloth|clyde|slot|float)[,:\s]*/i;

function stripActivation(text) {
  const trimmed = text.trim();
  const match = trimmed.match(ACTIVATION_RE);
  if (!match) return null;
  const command = trimmed.slice(match[0].length).trim();
  return command || null;
}

export async function initVoiceInput({ onStatusChange, onPartialText, onFinalText }) {
  const sonioxKey = await fetchSonioxKey();

  function startSession() {
    onStatusChange("connecting");

    const client = new SonioxClient({
      apiKey: sonioxKey,

      onStarted() {
        onStatusChange("listening");
      },

      onPartialResult(result) {
        const tokens = result.tokens || [];
        const endIdx = tokens.findIndex((t) => t.text === "<end>");

        if (endIdx !== -1) {
          const finalText = tokens.slice(0, endIdx).map((t) => t.text).join("");
          onPartialText("");
          const command = stripActivation(finalText);
          if (command) {
            onFinalText(command);
          }
        } else {
          const partialText = tokens.map((t) => t.text).join("");
          onPartialText(partialText);
        }
      },

      onFinished() {
        onStatusChange("connecting");
        setTimeout(startSession, RETRY_DELAY_MS);
      },

      onError(status, message) {
        console.error("Soniox error:", status, message);
        onStatusChange("error");
        setTimeout(startSession, RETRY_DELAY_MS);
      },
    });

    client.start({
      model: "stt-rt-preview",
      enableEndpointDetection: true,
    });
  }

  startSession();
}
