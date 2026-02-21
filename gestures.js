// Landmark indices used:
//   5=INDEX_MCP,  8=INDEX_TIP
//   9=MIDDLE_MCP, 12=MIDDLE_TIP
//   13=RING_MCP,  16=RING_TIP
//   17=PINKY_MCP, 20=PINKY_TIP
//
// In normalized image-space, lower Y = higher in the image (finger pointing up).

export function isPointerGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;

  const indexExtended = landmarks[8].y  < landmarks[5].y;
  const middleCurled  = landmarks[12].y > landmarks[9].y;
  const ringCurled    = landmarks[16].y > landmarks[13].y;
  const pinkyCurled   = landmarks[20].y > landmarks[17].y;

  return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

// Detects a fast downward flick of the index fingertip while the pointer
// gesture is active. Returns true on the frame the velocity threshold is crossed.
// Ignores re-triggers within cooldownMs milliseconds.
export class FlickDetector {
  constructor({ velocityThreshold = 0.04, cooldownMs = 800 } = {}) {
    this._threshold = velocityThreshold;
    this._cooldownMs = cooldownMs;
    this._lastFiredAt = -Infinity;
    this._prevTipY = null;
  }

  // Call every frame with current landmarks (or null if no hand visible).
  // Returns true on the frame a flick is detected.
  check(landmarks) {
    if (!landmarks) {
      this._prevTipY = null;
      return false;
    }

    const isPointing = isPointerGesture(landmarks);
    const tipY = landmarks[8].y;

    if (!isPointing) {
      // Not in pointer pose — reset tracking but don't fire
      this._prevTipY = null;
      return false;
    }

    let fired = false;

    if (this._prevTipY !== null) {
      const deltaY = tipY - this._prevTipY; // positive = tip moved down (flick forward)
      const now = performance.now();

      if (deltaY > this._threshold && (now - this._lastFiredAt) >= this._cooldownMs) {
        this._lastFiredAt = now;
        fired = true;
      }
    }

    this._prevTipY = tipY;
    return fired;
  }
}
