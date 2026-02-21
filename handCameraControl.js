import * as THREE from "three";

// --- Tunable constants ---
const ORBIT_SENSITIVITY_X = 3.0;   // theta (horizontal) sensitivity
const ORBIT_SENSITIVITY_Y = 2.0;   // phi (vertical) sensitivity
const TWO_HAND_ZOOM_SENSITIVITY = 8.0;
const SMOOTHING = 0.3;             // exponential smoothing (0 = no smoothing, 1 = frozen)

// --- Inertia / momentum constants ---
const INERTIA_FRICTION = 0.92;     // velocity multiplier each frame (0.90 = fast stop, 0.97 = long glide)
const INERTIA_STOP_THRESHOLD = 0.0001; // velocity below this is treated as zero

// --- Globe spin (fast swipe) constants ---
const GLOBE_SPIN_FRICTION = 0.97;          // much longer glide for fast swipes
const FAST_SWIPE_THRESHOLD = 0.008;        // speed (in NDC/frame) above which we switch to globe spin

const PHI_MIN = 0.1;
const PHI_MAX = Math.PI - 0.1;
const RADIUS_MIN = 2;
const RADIUS_MAX = 40;
const GROUND_Y = -5;            // must match ground.position.y in index.js
const CAMERA_FLOOR_OFFSET = 0.5; // keep camera at least this far above the ground

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

  let smoothDx = 0;
  let smoothDy = 0;

  // inertia velocities (in theta/phi/radius per frame)
  let velTheta = 0;
  let velPhi = 0;
  let velRadius = 0;
  let activeFriction = INERTIA_FRICTION; // switches based on swipe speed

  // Compute the maximum phi so the camera never dips below the ground.
  // Camera Y = target.y + radius * cos(phi)
  // We need: target.y + radius * cos(phi) >= GROUND_Y + CAMERA_FLOOR_OFFSET
  // => cos(phi) >= (GROUND_Y + CAMERA_FLOOR_OFFSET - target.y) / radius
  function getPhiMax() {
    const minCosine = (GROUND_Y + CAMERA_FLOOR_OFFSET - target.y) / radius;
    // clamp cosine to valid acos range, then take the lesser of the static and dynamic limit
    if (minCosine <= -1) return PHI_MAX;          // ground is so far below it's unreachable
    if (minCosine >= 1) return PHI_MIN;           // shouldn't happen, but safety
    return Math.min(PHI_MAX, Math.acos(minCosine));
  }

  function updateCameraPosition() {
    // enforce floor limit before positioning
    phi = THREE.MathUtils.clamp(phi, PHI_MIN, getPhiMax());

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

      // --- INERTIA: coast with decaying velocity ---
      const hasInertia =
        Math.abs(velTheta) > INERTIA_STOP_THRESHOLD ||
        Math.abs(velPhi) > INERTIA_STOP_THRESHOLD ||
        Math.abs(velRadius) > INERTIA_STOP_THRESHOLD;

      if (hasInertia) {
        theta += velTheta;
        phi += velPhi;
        phi = THREE.MathUtils.clamp(phi, PHI_MIN, getPhiMax());
        radius += velRadius;
        radius = THREE.MathUtils.clamp(radius, RADIUS_MIN, RADIUS_MAX);

        velTheta *= activeFriction;
        velPhi *= activeFriction;
        velRadius *= activeFriction;

        // snap to zero when below threshold
        if (Math.abs(velTheta) <= INERTIA_STOP_THRESHOLD) velTheta = 0;
        if (Math.abs(velPhi) <= INERTIA_STOP_THRESHOLD) velPhi = 0;
        if (Math.abs(velRadius) <= INERTIA_STOP_THRESHOLD) velRadius = 0;

        updateCameraPosition();
      }
      return;
    }

    // both fists → treat as no hands (allow inertia to start)
    const allFists = allLandmarks.every((lm) => isFist(lm));
    if (allFists) {
      prevWristX = null;
      prevWristY = null;
      prevHandDist = null;
      // don't reset velocity — let inertia carry on next frame
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
        const radiusDelta = -delta * TWO_HAND_ZOOM_SENSITIVITY;
        radius += radiusDelta;
        radius = THREE.MathUtils.clamp(radius, RADIUS_MIN, RADIUS_MAX);

        // capture zoom velocity for inertia
        velRadius = radiusDelta;
        velTheta = 0;
        velPhi = 0;
        activeFriction = INERTIA_FRICTION;
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

        const dTheta = smoothDx * ORBIT_SENSITIVITY_X;
        const dPhi = smoothDy * ORBIT_SENSITIVITY_Y;

        theta += dTheta;
        phi += dPhi;
        phi = THREE.MathUtils.clamp(phi, PHI_MIN, getPhiMax());

        // capture orbit velocity for inertia
        velTheta = dTheta;
        velPhi = dPhi;
        velRadius = 0;

        // pick friction based on swipe speed — fast swipe = globe spin
        const speed = Math.hypot(rawDx, rawDy);
        activeFriction = speed > FAST_SWIPE_THRESHOLD ? GLOBE_SPIN_FRICTION : INERTIA_FRICTION;
      }
      prevWristX = wrist.x;
      prevWristY = wrist.y;
      prevHandDist = null;
    }

    updateCameraPosition();
  }

  return { update, stopInertia() { velTheta = 0; velPhi = 0; velRadius = 0; } };
}
