import * as THREE from "three";

// --- Tunable constants ---
const ORBIT_SENSITIVITY_X = 3.0;   // theta (horizontal) sensitivity
const ORBIT_SENSITIVITY_Y = 2.0;   // phi (vertical) sensitivity
const TWO_HAND_ZOOM_SENSITIVITY = 8.0;
const PAN_SENSITIVITY = 15.0;
const SMOOTHING = 0.3;             // exponential smoothing (0 = no smoothing, 1 = frozen)
const INERTIA_FRICTION = 0.92;     // per-frame velocity decay when coasting (0 = instant stop, 1 = forever)
const INERTIA_CUTOFF = 0.0001;     // stop drifting below this velocity

const PHI_MIN = 0.1;
const PHI_MAX = Math.PI - 0.1;
const RADIUS_MIN = 2;
const RADIUS_MAX = 40;

const WRIST = 0;
// fingertip → PIP (second knuckle) pairs for curl detection
const FINGER_TIP_PIP = [
  [8, 6],   // index
  [12, 10], // middle
  [16, 14], // ring
  [20, 18], // pinky
];

export function isFist(landmarks) {
  const wrist = landmarks[WRIST];
  // a finger is curled if its tip is closer to the wrist than its PIP joint
  let curledCount = 0;
  for (const [tipIdx, pipIdx] of FINGER_TIP_PIP) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    const tipDist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipDist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    if (tipDist < pipDist) curledCount++;
  }
  // fist if at least 3 of 4 fingers are curled (forgiving for pinky)
  return curledCount >= 3;
}

// "finger gun" — index extended, middle/ring/pinky curled
export function isFingerGun(landmarks) {
  const wrist = landmarks[WRIST];
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  // index must be extended (tip further from wrist than PIP)
  const indexTipDist = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y);
  const indexPipDist = Math.hypot(indexPip.x - wrist.x, indexPip.y - wrist.y);
  if (indexTipDist <= indexPipDist) return false;
  // middle, ring, pinky must be curled
  const curlPairs = [[12, 10], [16, 14], [20, 18]];
  let curled = 0;
  for (const [tipIdx, pipIdx] of curlPairs) {
    const tip = landmarks[tipIdx];
    const pip = landmarks[pipIdx];
    if (Math.hypot(tip.x - wrist.x, tip.y - wrist.y) < Math.hypot(pip.x - wrist.x, pip.y - wrist.y)) curled++;
  }
  return curled >= 2;
}

// thumb tap — thumb tip close to index MCP (the "click")
const THUMB_TAP_ENTER = 0.045;
const THUMB_TAP_EXIT = 0.07;

export function createThumbTapDetector() {
  let wasTapping = false;
  return function detect(landmarks) {
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const dist = Math.hypot(thumbTip.x - indexMcp.x, thumbTip.y - indexMcp.y);
    if (!wasTapping && dist < THUMB_TAP_ENTER) {
      wasTapping = true;
      return true; // just tapped
    } else if (wasTapping && dist > THUMB_TAP_EXIT) {
      wasTapping = false;
    }
    return false;
  };
}

export function createHandCameraController(camera, target = new THREE.Vector3()) {
  let theta = Math.PI / 2;   // azimuth
  let phi = Math.PI / 2;     // elevation
  let radius = 12;

  let prevWristX = null;
  let prevWristY = null;
  let prevHandDist = null;
  let prevPanX = null;
  let prevPanY = null;

  let smoothDx = 0;
  let smoothDy = 0;

  // reusable vectors for pan math
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _worldUp = new THREE.Vector3(0, 1, 0);

  function updateCameraPosition() {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.cos(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(target);
  }

  // set initial camera position
  updateCameraPosition();

  // "brake" — hard stop, zero velocity (fists, selection mode)
  // "coast" — no input, let inertia decay (hand left frame)
  function update(allLandmarks, mode) {
    // --- no hand input ---
    if (!allLandmarks || allLandmarks.length === 0) {
      prevWristX = null;
      prevWristY = null;
      prevHandDist = null;
      prevPanX = null;
      prevPanY = null;

      if (mode === "brake") {
        smoothDx = 0;
        smoothDy = 0;
      } else {
        // coast: decay velocity
        smoothDx *= INERTIA_FRICTION;
        smoothDy *= INERTIA_FRICTION;
        if (Math.abs(smoothDx) < INERTIA_CUTOFF) smoothDx = 0;
        if (Math.abs(smoothDy) < INERTIA_CUTOFF) smoothDy = 0;

        theta += smoothDx * ORBIT_SENSITIVITY_X;
        phi += smoothDy * ORBIT_SENSITIVITY_Y;
        phi = THREE.MathUtils.clamp(phi, PHI_MIN, PHI_MAX);
      }

      updateCameraPosition();
      return;
    }

    // both fists → brake
    const allFists = allLandmarks.every((lm) => isFist(lm));
    if (allFists) {
      smoothDx = 0;
      smoothDy = 0;
      prevWristX = null;
      prevWristY = null;
      prevHandDist = null;
      prevPanX = null;
      prevPanY = null;
      updateCameraPosition();
      return;
    }

    if (allLandmarks.length >= 2) {
      // classify each hand
      const fistA = isFist(allLandmarks[0]);
      const fistB = isFist(allLandmarks[1]);

      if (fistA !== fistB) {
        // --- ONE FIST + ONE OPEN = PAN mode ---
        const openHand = fistA ? allLandmarks[1] : allLandmarks[0];
        const wrist = openHand[WRIST];

        if (prevPanX !== null && prevPanY !== null) {
          const dx = wrist.x - prevPanX;
          const dy = wrist.y - prevPanY;

          // pan along camera's local right/up axes
          camera.getWorldDirection(_forward);
          _right.crossVectors(_forward, _worldUp).normalize();
          _up.crossVectors(_right, _forward).normalize();

          target.addScaledVector(_right, dx * PAN_SENSITIVITY);
          target.addScaledVector(_up, -dy * PAN_SENSITIVITY);
        }
        prevPanX = wrist.x;
        prevPanY = wrist.y;

        // reset orbit/zoom tracking
        smoothDx = 0;
        smoothDy = 0;
        prevWristX = null;
        prevWristY = null;
        prevHandDist = null;
      } else {
        // --- TWO-HAND ZOOM mode (both open) ---
        const wristA = allLandmarks[0][WRIST];
        const wristB = allLandmarks[1][WRIST];

        const dx = wristA.x - wristB.x;
        const dy = wristA.y - wristB.y;
        const handDist = Math.sqrt(dx * dx + dy * dy);

        if (prevHandDist !== null) {
          const delta = handDist - prevHandDist;
          radius -= delta * TWO_HAND_ZOOM_SENSITIVITY;
          radius = THREE.MathUtils.clamp(radius, RADIUS_MIN, RADIUS_MAX);
        }
        prevHandDist = handDist;

        // reset orbit/pan tracking
        smoothDx = 0;
        smoothDy = 0;
        prevWristX = null;
        prevWristY = null;
        prevPanX = null;
        prevPanY = null;
      }
    } else {
      // --- SINGLE-HAND ORBIT mode ---
      const wrist = allLandmarks[0][WRIST];

      if (prevWristX !== null && prevWristY !== null) {
        const rawDx = wrist.x - prevWristX;
        const rawDy = wrist.y - prevWristY;

        smoothDx = smoothDx * SMOOTHING + rawDx * (1 - SMOOTHING);
        smoothDy = smoothDy * SMOOTHING + rawDy * (1 - SMOOTHING);

        theta += smoothDx * ORBIT_SENSITIVITY_X;
        phi += smoothDy * ORBIT_SENSITIVITY_Y;
        phi = THREE.MathUtils.clamp(phi, PHI_MIN, PHI_MAX);
      }
      prevWristX = wrist.x;
      prevWristY = wrist.y;
      prevHandDist = null;
      prevPanX = null;
      prevPanY = null;
    }

    updateCameraPosition();
  }

  return { update };
}
