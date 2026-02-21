import { askAgent } from "./solarAgent.js";
import { executeGeneratedCode } from "./codeExecutor.js";
import { initVoiceInput } from "./voiceInput.js";

export function initChatUI() {
  // --- container ---
  const panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "16px",
    left: "16px",
    width: "400px",
    maxHeight: "70vh",
    display: "flex",
    flexDirection: "column",
    background: "rgba(10, 10, 26, 0.85)",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(12px)",
    color: "#e0e0e0",
    fontFamily: "system-ui, sans-serif",
    fontSize: "13px",
    zIndex: "20",
    overflow: "hidden",
  });

  // --- voice status indicator ---
  const voiceSection = document.createElement("div");
  Object.assign(voiceSection.style, {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  });

  const voiceRow = document.createElement("div");
  Object.assign(voiceRow.style, {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });

  const voiceDot = document.createElement("div");
  Object.assign(voiceDot.style, {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#888",
    flexShrink: "0",
  });

  const voiceLabel = document.createElement("span");
  voiceLabel.style.fontSize = "12px";
  voiceLabel.textContent = "Connecting...";

  const partialText = document.createElement("div");
  Object.assign(partialText.style, {
    fontSize: "11px",
    color: "#aaa",
    fontStyle: "italic",
    minHeight: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });

  voiceRow.append(voiceDot, voiceLabel);
  voiceSection.append(voiceRow, partialText);
  panel.appendChild(voiceSection);

  // pulse animation for the dot
  const pulseKeyframes = `
    @keyframes voice-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = pulseKeyframes;
  document.head.appendChild(styleEl);

  function updateVoiceStatus(state) {
    if (state === "listening") {
      voiceDot.style.background = "#51cf66";
      voiceDot.style.animation = "voice-pulse 1.5s ease-in-out infinite";
      voiceLabel.textContent = "Listening...";
    } else if (state === "connecting") {
      voiceDot.style.background = "#fcc419";
      voiceDot.style.animation = "none";
      voiceLabel.textContent = "Connecting...";
    } else if (state === "error") {
      voiceDot.style.background = "#ff6b6b";
      voiceDot.style.animation = "none";
      voiceLabel.textContent = "Mic error";
    }
  }

  // --- message log ---
  const log = document.createElement("div");
  Object.assign(log.style, {
    flex: "1",
    overflowY: "auto",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  });
  panel.appendChild(log);

  function appendMsg(text, type = "info") {
    const el = document.createElement("div");
    el.style.lineHeight = "1.4";
    el.style.wordBreak = "break-word";

    if (type === "user") {
      el.style.color = "#4a90d9";
      el.textContent = `> ${text}`;
    } else if (type === "assistant") {
      el.style.color = "#c0c0c0";
      el.textContent = text;
    } else if (type === "code") {
      const pre = document.createElement("pre");
      Object.assign(pre.style, {
        background: "rgba(255,255,255,0.05)",
        padding: "8px",
        borderRadius: "6px",
        fontSize: "11px",
        overflow: "auto",
        maxHeight: "150px",
        whiteSpace: "pre-wrap",
        margin: "0",
      });
      pre.textContent = text;
      el.appendChild(pre);
    } else if (type === "error") {
      el.style.color = "#ff6b6b";
      el.textContent = text;
    } else if (type === "success") {
      el.style.color = "#51cf66";
      el.textContent = text;
    }

    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // --- status ---
  const status = document.createElement("div");
  Object.assign(status.style, {
    padding: "4px 12px",
    fontSize: "11px",
    color: "#888",
    minHeight: "18px",
  });
  panel.appendChild(status);

  function setStatus(text) {
    status.textContent = text;
  }

  // --- input row ---
  const inputRow = document.createElement("div");
  Object.assign(inputRow.style, {
    display: "flex",
    gap: "6px",
    padding: "10px 12px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  });

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.placeholder = "Type or speak...";
  Object.assign(textInput.style, {
    flex: "1",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#e0e0e0",
    fontSize: "13px",
    outline: "none",
  });

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Send";
  Object.assign(sendBtn.style, {
    padding: "8px 16px",
    borderRadius: "6px",
    border: "none",
    background: "#4a90d9",
    color: "#fff",
    cursor: "pointer",
    fontSize: "13px",
  });

  inputRow.append(textInput, sendBtn);
  panel.appendChild(inputRow);

  document.body.appendChild(panel);

  // --- handleUserInput: single entry point for voice/text ---
  let busy = false;

  async function handleUserInput(text) {
    text = text.trim();
    if (!text || busy) return;

    busy = true;
    appendMsg(text, "user");
    setStatus("Thinking...");

    try {
      const { code, explanation } = await askAgent(text);

      if (explanation) appendMsg(explanation, "assistant");

      if (code) {
        appendMsg(code, "code");
        setStatus("Executing...");
        const result = await executeGeneratedCode(code);
        if (result.success) {
          setStatus("Done!");
          appendMsg("Executed successfully.", "success");
        } else {
          setStatus("Error");
          appendMsg(`Execution error: ${result.error}`, "error");
        }
      } else {
        setStatus("Done (no code)");
      }
    } catch (err) {
      setStatus("Error");
      appendMsg(`Error: ${err.message}`, "error");
    }

    busy = false;
  }

  // wire up UI
  sendBtn.addEventListener("click", () => {
    handleUserInput(textInput.value);
    textInput.value = "";
  });
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleUserInput(textInput.value);
      textInput.value = "";
    }
  });

  // expose for voice integration
  window.handleUserInput = handleUserInput;

  // --- init voice input ---
  initVoiceInput({
    onStatusChange: updateVoiceStatus,
    onPartialText(text) {
      partialText.textContent = text;
    },
    onFinalText(text) {
      partialText.textContent = "";
      handleUserInput(text);
    },
  });
}
