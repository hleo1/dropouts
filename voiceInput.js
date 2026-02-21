import { SonioxClient } from "soniox-stt";

const RETRY_DELAY_MS = 2000;
const CONFIG_URL = "http://localhost:9876/config";

async function fetchSonioxKey() {
  const res = await fetch(CONFIG_URL);
  const { sonioxKey } = await res.json();
  return sonioxKey;
}

// STT often mishears "Claude" as cloud, clod, claud, klod, quad, etc.
const ACTIVATION_RE = /(?:hey\s+|ok\s+|okay\s+)?(?:claude|cloud|clod|claud|klod|klawd|clawd|quad|claw|claw'd|clawed|cloth|clyde|slot|float)[,:\s]*/i;

function stripActivation(text) {
  const trimmed = text.trim();
  const match = trimmed.match(ACTIVATION_RE);
  if (!match) return null;
  // Remove the activation phrase wherever it appears and return the rest
  const command = trimmed.replace(match[0], "").trim();
  return command || null;
}

export async function initVoiceInput({ onStatusChange, onPartialText, onFinalText }) {
  const sonioxKey = await fetchSonioxKey();

  function startSession() {
    onStatusChange("connecting");

    // Accumulated final tokens for the current utterance.
    // Final tokens are sent ONCE and never repeated in subsequent callbacks,
    // so we must collect them across calls.
    let finalTokens = [];

    const client = new SonioxClient({
      apiKey: sonioxKey,
      keepAlive: true,

      onStarted() {
        onStatusChange("listening");
        finalTokens = [];
      },

      onPartialResult(result) {
        const tokens = result.tokens || [];
        let nonFinalText = "";

        for (const token of tokens) {
          if (token.is_final) {
            if (token.text === "<end>" || token.text === "<fin>") {
              // Utterance complete — build full text from accumulated finals
              const fullText = finalTokens.map((t) => t.text).join("");
              finalTokens = [];
              onPartialText("");
              const command = stripActivation(fullText);
              if (command) {
                onFinalText(command);
              }
              return;
            }
            finalTokens.push(token);
          } else {
            nonFinalText += token.text;
          }
        }

        // Show accumulated final + current non-final as partial preview
        const preview = finalTokens.map((t) => t.text).join("") + nonFinalText;
        onPartialText(preview);
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
      model: "stt-rt-v4",
      enableEndpointDetection: true,
      audioConstraints: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  startSession();
}
