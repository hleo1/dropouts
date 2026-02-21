import { askAgent } from "./agent.js";
import { executeGeneratedCode } from "./codeExecutor.js";
import { initVoiceInput } from "./voiceInput.js";

export function initChatUI() {
  // --- inject styles ---
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @keyframes voice-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes msg-in {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .chat-dropdown-open {
      opacity: 1 !important;
      pointer-events: auto !important;
      transform: translateY(0) !important;
    }
    .chat-msg {
      animation: msg-in 0.2s ease-out;
    }
    .chat-input:focus {
      border-color: rgba(255,255,255,0.3) !important;
      background: rgba(255,255,255,0.08) !important;
    }
    .chat-send-btn:hover {
      background: rgba(255,255,255,0.15) !important;
    }
    .chat-pill:hover {
      border-color: rgba(255,255,255,0.2) !important;
      background: rgba(10, 10, 30, 0.55) !important;
    }
    .chat-log::-webkit-scrollbar {
      width: 4px;
    }
    .chat-log::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 4px;
    }
    .chat-log::-webkit-scrollbar-track {
      background: transparent;
    }
  `;
  document.head.appendChild(styleEl);

  let expanded = false;

  // --- pill (always visible) ---
  const pill = document.createElement("div");
  pill.className = "chat-pill";
  Object.assign(pill.style, {
    position: "fixed",
    bottom: "16px",
    left: "16px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    background: "rgba(10, 10, 30, 0.45)",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.1)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    color: "#ddd",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "13px",
    zIndex: "21",
    cursor: "pointer",
    transition: "all 0.2s ease",
    userSelect: "none",
  });

  // voice dot
  const voiceDot = document.createElement("div");
  Object.assign(voiceDot.style, {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#888",
    flexShrink: "0",
  });

  // voice label
  const voiceLabel = document.createElement("span");
  voiceLabel.style.fontSize = "12px";
  voiceLabel.style.fontWeight = "500";
  voiceLabel.style.letterSpacing = "0.3px";
  voiceLabel.textContent = "Connecting...";

  // partial transcript inline
  const partialText = document.createElement("span");
  Object.assign(partialText.style, {
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "180px",
  });

  // chevron toggle
  const chevron = document.createElement("span");
  Object.assign(chevron.style, {
    fontSize: "10px",
    marginLeft: "4px",
    opacity: "0.5",
    transition: "transform 0.2s ease",
  });
  chevron.textContent = "\u25B2";

  pill.append(voiceDot, voiceLabel, partialText, chevron);
  document.body.appendChild(pill);

  // --- dropdown panel (opens upward) ---
  const dropdown = document.createElement("div");
  Object.assign(dropdown.style, {
    position: "fixed",
    bottom: "56px",
    left: "16px",
    width: "360px",
    maxHeight: "50vh",
    display: "flex",
    flexDirection: "column",
    background: "rgba(10, 10, 30, 0.5)",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    color: "#ddd",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "13px",
    zIndex: "20",
    overflow: "hidden",
    opacity: "0",
    pointerEvents: "none",
    transform: "translateY(8px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  });

  // --- message log ---
  const log = document.createElement("div");
  log.className = "chat-log";
  Object.assign(log.style, {
    flex: "1",
    overflowY: "auto",
    padding: "12px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: "60px",
  });

  // empty state
  const emptyHint = document.createElement("div");
  Object.assign(emptyHint.style, {
    color: "rgba(255,255,255,0.25)",
    fontSize: "12px",
    textAlign: "center",
    padding: "16px 0",
  });
  emptyHint.textContent = "Speak or type a command...";
  log.appendChild(emptyHint);

  dropdown.appendChild(log);

  function appendMsg(text, type = "info") {
    // remove empty hint on first message
    if (emptyHint.parentNode) emptyHint.remove();

    const el = document.createElement("div");
    el.className = "chat-msg";
    el.style.lineHeight = "1.45";
    el.style.wordBreak = "break-word";

    if (type === "user") {
      Object.assign(el.style, {
        color: "#7eb8f7",
        fontWeight: "500",
        paddingLeft: "8px",
        borderLeft: "2px solid rgba(126,184,247,0.4)",
      });
      el.textContent = text;
    } else if (type === "assistant") {
      el.style.color = "rgba(255,255,255,0.75)";
      el.textContent = text;
    } else if (type === "code") {
      const pre = document.createElement("pre");
      Object.assign(pre.style, {
        background: "rgba(255,255,255,0.04)",
        padding: "8px 10px",
        borderRadius: "8px",
        fontSize: "11px",
        overflow: "auto",
        maxHeight: "120px",
        whiteSpace: "pre-wrap",
        margin: "0",
        color: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(255,255,255,0.05)",
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

    // auto-expand when a message arrives
    if (!expanded) toggleDropdown();

    return el;
  }

  // --- status indicator (inside pill) ---
  const statusDot = document.createElement("div");
  Object.assign(statusDot.style, {
    display: "none",
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#7eb8f7",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
    flexShrink: "0",
  });
  pill.insertBefore(statusDot, chevron);

  function setStatus(text) {
    if (text && text !== "Done!" && text !== "Done (no code)") {
      statusDot.style.display = "block";
      voiceLabel.textContent = text;
    } else {
      statusDot.style.display = "none";
    }
  }

  // --- keyboard toggle button (bottom of dropdown) ---
  let inputVisible = false;
  const toggleBar = document.createElement("div");
  Object.assign(toggleBar.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 0",
  });

  const kbdBtn = document.createElement("button");
  kbdBtn.className = "chat-send-btn";
  kbdBtn.title = "Toggle keyboard input";
  kbdBtn.textContent = "Keyboard";
  Object.assign(kbdBtn.style, {
    height: "22px",
    padding: "0 10px",
    borderRadius: "11px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "rgba(255,255,255,0.3)",
    cursor: "pointer",
    fontSize: "10px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    letterSpacing: "0.5px",
    transition: "all 0.15s ease",
    flexShrink: "0",
  });

  toggleBar.appendChild(kbdBtn);
  dropdown.appendChild(toggleBar);

  // --- input row (hidden by default) ---
  const inputRow = document.createElement("div");
  Object.assign(inputRow.style, {
    display: "none",
    gap: "6px",
    padding: "8px 12px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  });

  const textInput = document.createElement("input");
  textInput.className = "chat-input";
  textInput.type = "text";
  textInput.placeholder = "Type a command...";
  Object.assign(textInput.style, {
    flex: "1",
    padding: "8px 12px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#e0e0e0",
    fontSize: "13px",
    outline: "none",
    transition: "all 0.15s ease",
  });

  const sendBtn = document.createElement("button");
  sendBtn.className = "chat-send-btn";
  sendBtn.innerHTML = "&#10148;";
  Object.assign(sendBtn.style, {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#aaa",
    cursor: "pointer",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    flexShrink: "0",
  });

  inputRow.append(textInput, sendBtn);
  dropdown.appendChild(inputRow);

  // toggle input visibility
  kbdBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    inputVisible = !inputVisible;
    inputRow.style.display = inputVisible ? "flex" : "none";
    toggleBar.style.display = inputVisible ? "none" : "flex";
    if (inputVisible) textInput.focus();
  });

  document.body.appendChild(dropdown);

  // --- toggle logic ---
  function toggleDropdown() {
    expanded = !expanded;
    if (expanded) {
      dropdown.classList.add("chat-dropdown-open");
      chevron.style.transform = "rotate(180deg)";
    } else {
      dropdown.classList.remove("chat-dropdown-open");
      chevron.style.transform = "rotate(0deg)";
    }
  }

  pill.addEventListener("click", toggleDropdown);

  // close dropdown if clicking outside
  document.addEventListener("mousedown", (e) => {
    if (expanded && !dropdown.contains(e.target) && !pill.contains(e.target)) {
      toggleDropdown();
    }
  });

  // --- voice status ---
  function updateVoiceStatus(state) {
    if (state === "listening") {
      voiceDot.style.background = "#51cf66";
      voiceDot.style.animation = "voice-pulse 1.5s ease-in-out infinite";
      voiceLabel.textContent = "Listening";
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

  // --- handleUserInput ---
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
          updateVoiceStatus("listening");
          appendMsg("Executed successfully.", "success");
        } else {
          setStatus("Error");
          updateVoiceStatus("listening");
          appendMsg(`Execution error: ${result.error}`, "error");
        }
      } else {
        setStatus("Done (no code)");
        updateVoiceStatus("listening");
      }
    } catch (err) {
      setStatus("Error");
      updateVoiceStatus("listening");
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
      partialText.textContent = text ? `"${text}"` : "";
    },
    onFinalText(text) {
      partialText.textContent = "";
      handleUserInput(text);
    },
  });
}
