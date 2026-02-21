import * as THREE from "three";
import { getBlock } from "./getBodies.js";
import getVisionStuff from "./getVisionStuff.js";
import { createHandCameraController, isFingerGun, createThumbTapDetector } from "./handCameraControl.js";

// init three.js scene
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
camera.position.z = 12;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

// init video and MediaPipe
const { video, handLandmarker } = await getVisionStuff();

// PIP webcam overlay
const pipVideo = document.getElementById('webcam-pip');
pipVideo.srcObject = video.srcObject;

// hand dots canvas (overlays the PIP video)
const dotCanvas = document.getElementById('hand-dots');
const dotCtx = dotCanvas.getContext('2d');

// starfield for spatial orientation
const starCount = 500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i++) {
  starPositions[i] = (Math.random() - 0.5) * 100;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0x888888, size: 0.15 });
scene.add(new THREE.Points(starGeo, starMat));

// subtle ground grid
const gridHelper = new THREE.GridHelper(60, 40, 0x222244, 0x222244);
gridHelper.position.y = -5;
scene.add(gridHelper);

// hand-driven camera controller
const cameraController = createHandCameraController(camera);

// cursor + block selection
const cursorEl = document.getElementById('cursor');
const raycaster = new THREE.Raycaster();
const thumbTap = createThumbTapDetector();
let selectedMesh = null;
let selectedOriginalColor = null;
const HIGHLIGHT_COLOR = 0xf0c040; // deeper yellow

// cursor smoothing
const CURSOR_SMOOTHING = 0.35; // 0 = instant, 1 = frozen
let smoothCursorX = 0;
let smoothCursorY = 0;
let cursorInitialized = false;

// finger-gun hysteresis — need several consecutive frames to enter/exit
const FG_ENTER_FRAMES = 4;
const FG_EXIT_FRAMES = 6;
let fgConsecutive = 0;
let inFingerGunMode = false;

// static blocks on the ground
const blockMeshes = [];
const numBlocks = 40;
for (let i = 0; i < numBlocks; i++) {
  const block = getBlock();
  scene.add(block.mesh);
  blockMeshes.push(block.mesh);
}

function clearDotCanvas() {
  dotCanvas.width = dotCanvas.clientWidth;
  dotCanvas.height = dotCanvas.clientHeight;
  dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);
}

function drawHandDots(landmarks) {
  landmarks.forEach((lm) => {
    // landmarks are normalized 0-1; mirror X to match scaleX(-1) on the video
    const x = (1 - lm.x) * dotCanvas.width;
    const y = lm.y * dotCanvas.height;
    dotCtx.beginPath();
    dotCtx.arc(x, y, 3, 0, Math.PI * 2);
    dotCtx.fillStyle = '#00ff88';
    dotCtx.fill();
  });
}

function animate() {
  // hand-tracking → camera control + dots
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    const handResults = handLandmarker.detectForVideo(video, Date.now());

    clearDotCanvas();
    let fingerGunHand = null;

    if (handResults.landmarks.length > 0) {
      // check if any hand is doing finger gun
      for (const lm of handResults.landmarks) {
        if (isFingerGun(lm)) {
          fingerGunHand = lm;
          break;
        }
      }

      // finger-gun hysteresis — require consecutive frames to switch modes
      if (fingerGunHand) {
        if (!inFingerGunMode) {
          fgConsecutive++;
          if (fgConsecutive >= FG_ENTER_FRAMES) inFingerGunMode = true;
        } else {
          fgConsecutive = 0;
        }
      } else {
        if (inFingerGunMode) {
          fgConsecutive++;
          if (fgConsecutive >= FG_EXIT_FRAMES) {
            inFingerGunMode = false;
            cursorInitialized = false;
          }
        } else {
          fgConsecutive = 0;
        }
      }

      if (inFingerGunMode && fingerGunHand) {
        // --- SELECTION MODE ---
        const indexTip = fingerGunHand[8];
        const rawX = (1 - indexTip.x) * window.innerWidth;
        const rawY = indexTip.y * window.innerHeight;

        // smooth the cursor position
        if (!cursorInitialized) {
          smoothCursorX = rawX;
          smoothCursorY = rawY;
          cursorInitialized = true;
        } else {
          smoothCursorX += (rawX - smoothCursorX) * (1 - CURSOR_SMOOTHING);
          smoothCursorY += (rawY - smoothCursorY) * (1 - CURSOR_SMOOTHING);
        }

        cursorEl.style.display = 'block';
        cursorEl.style.left = smoothCursorX + 'px';
        cursorEl.style.top = smoothCursorY + 'px';

        // check thumb tap to select
        if (thumbTap(fingerGunHand)) {
          const ndc = new THREE.Vector2(
            (smoothCursorX / window.innerWidth) * 2 - 1,
            -(smoothCursorY / window.innerHeight) * 2 + 1
          );
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(blockMeshes);

          // deselect previous
          if (selectedMesh) {
            selectedMesh.material.color.set(selectedOriginalColor);
            selectedMesh.material.emissive?.set(0x000000);
          }

          if (hits.length > 0) {
            selectedMesh = hits[0].object;
            selectedOriginalColor = selectedMesh.material.color.getHex();
            selectedMesh.material.color.set(HIGHLIGHT_COLOR);
            cursorEl.classList.add('tapped');
            setTimeout(() => cursorEl.classList.remove('tapped'), 150);
          } else {
            selectedMesh = null;
            selectedOriginalColor = null;
          }
        }

        // don't move camera while in selection mode
        cameraController.update(null);
      } else {
        cursorEl.style.display = 'none';
        cameraController.update(handResults.landmarks);
      }

      handResults.landmarks.forEach((lm) => drawHandDots(lm));
    } else {
      cursorEl.style.display = 'none';
      cameraController.update(null);
      fgConsecutive = 0;
      inFingerGunMode = false;
      cursorInitialized = false;
    }
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
