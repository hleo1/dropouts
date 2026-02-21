import * as THREE from "three";

// --- Tunable constants ---
const ORBIT_SENSITIVITY_X = 3.0;   // theta (horizontal) sensitivity
const ORBIT_SENSITIVITY_Y = 2.0;   // phi (vertical) sensitivity
const ZOOM_SENSITIVITY = 15.0;
const SMOOTHING = 0.3;             // exponential smoothing (0 = no smoothing, 1 = frozen)

const PINCH_ENTER = 0.06;          // distance to enter pinch/zoom mode
const PINCH_EXIT = 0.09;           // distance to exit pinch/zoom mode

const PHI_MIN = 0.1;
const PHI_MAX = Math.PI - 0.1;
const RADIUS_MIN = 2;
const RADIUS_MAX = 40;

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;

export function createHandCameraController(camera, target = new THREE.Vector3()) {
  let theta = Math.PI / 2;   // azimuth
  let phi = Math.PI / 2;     // elevation
  let radius = 12;

  let prevWristX = null;
  let prevWristY = null;
  let prevPinchDist = null;
  let isPinching = false;

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

  function update(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      // hand disappeared — reset previous so we skip delta on reappearance
      prevWristX = null;
      prevWristY = null;
      prevPinchDist = null;
      return;
    }

    const wrist = landmarks[WRIST];
    const thumbTip = landmarks[THUMB_TIP];
    const indexTip = landmarks[INDEX_TIP];

    // pinch distance (2D in normalised coords)
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const pinchDist = Math.sqrt(dx * dx + dy * dy);

    // hysteresis for pinch detection
    if (!isPinching && pinchDist < PINCH_ENTER) {
      isPinching = true;
      prevPinchDist = null; // reset so we skip first-frame jump
    } else if (isPinching && pinchDist > PINCH_EXIT) {
      isPinching = false;
      prevWristX = null; // reset orbit tracking on mode switch
      prevWristY = null;
    }

    if (isPinching) {
      // --- ZOOM mode ---
      if (prevPinchDist !== null) {
        const delta = pinchDist - prevPinchDist;
        radius -= delta * ZOOM_SENSITIVITY;
        radius = THREE.MathUtils.clamp(radius, RADIUS_MIN, RADIUS_MAX);
      }
      prevPinchDist = pinchDist;
      // reset orbit previous so we skip delta when switching back
      prevWristX = null;
      prevWristY = null;
    } else {
      // --- ORBIT mode (open hand) ---
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
      prevPinchDist = null;
    }

    updateCameraPosition();
  }

  return { update };
}
