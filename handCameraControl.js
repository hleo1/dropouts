import * as THREE from "three";

// --- Tunable constants ---
const ORBIT_SENSITIVITY_X = 3.0;   // theta (horizontal) sensitivity
const ORBIT_SENSITIVITY_Y = 2.0;   // phi (vertical) sensitivity
const TWO_HAND_ZOOM_SENSITIVITY = 8.0;
const SMOOTHING = 0.3;             // exponential smoothing (0 = no smoothing, 1 = frozen)

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

function isFist(landmarks) {
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

export function createHandCameraController(camera, target = new THREE.Vector3()) {
  let theta = Math.PI / 2;   // azimuth
  let phi = Math.PI / 2;     // elevation
  let radius = 12;

  let prevWristX = null;
  let prevWristY = null;
  let prevHandDist = null;

  let smoothDx = 0;
  let smoothDy = 0;

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

  function update(allLandmarks) {
    if (!allLandmarks || allLandmarks.length === 0) {
      prevWristX = null;
      prevWristY = null;
      prevHandDist = null;
      return;
    }

    // both fists → treat as no hands (full stop)
    const allFists = allLandmarks.every((lm) => isFist(lm));
    if (allFists) {
      prevWristX = null;
      prevWristY = null;
      prevHandDist = null;
      return;
    }

    if (allLandmarks.length >= 2) {
      // --- TWO-HAND ZOOM mode ---
      const wristA = allLandmarks[0][WRIST];
      const wristB = allLandmarks[1][WRIST];

      const dx = wristA.x - wristB.x;
      const dy = wristA.y - wristB.y;
      const handDist = Math.sqrt(dx * dx + dy * dy);

      if (prevHandDist !== null) {
        const delta = handDist - prevHandDist;
        // hands moving apart → zoom in (decrease radius)
        radius -= delta * TWO_HAND_ZOOM_SENSITIVITY;
        radius = THREE.MathUtils.clamp(radius, RADIUS_MIN, RADIUS_MAX);
      }
      prevHandDist = handDist;

      // reset orbit tracking so we skip a jump when going back to one hand
      prevWristX = null;
      prevWristY = null;
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
    }

    updateCameraPosition();
  }

  return { update };
}
