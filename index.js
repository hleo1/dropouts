import * as THREE from "three";
import { getBlock } from "./getBodies.js";
import { getVisionStuff } from "./getVisionStuff.js";
import { createHandCameraController, isFingerGun, createThumbTapDetector } from "./handCameraControl.js";
import { createHandCameraController } from "./handCameraControl.js";
import { initSceneContext, tickAnimations } from "./sceneContext.js";
import { initChatUI } from "./chatUI.js";

// init three.js scene
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
// gradient sky
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 2;
skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext("2d");
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
skyGrad.addColorStop(0, "#4a90d9");
skyGrad.addColorStop(0.5, "#7eb8e8");
skyGrad.addColorStop(1, "#b8d4f0");
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 2, 256);
scene.background = new THREE.CanvasTexture(skyCanvas);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
camera.position.z = 12;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// lighting
const hemi = new THREE.HemisphereLight(0xb8d4f0, 0x8b6b3a, 0.4);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff5e6, 1.0);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = sun.shadow.camera.bottom = -25;
sun.shadow.camera.right = sun.shadow.camera.top = 25;
scene.add(sun);

// init video and MediaPipe
const { video, handLandmarker } = await getVisionStuff();

// PIP webcam overlay
const pipVideo = document.getElementById("webcam-pip");
pipVideo.srcObject = video.srcObject;

// hand dots canvas (overlays the PIP video)
const dotCanvas = document.getElementById("hand-dots");
const dotCtx = dotCanvas.getContext("2d");

// ground plane
const groundGeo = new THREE.PlaneGeometry(80, 80, 32, 32);
const groundMat = new THREE.MeshLambertMaterial({
  color: 0x9c6b3a,
  side: THREE.DoubleSide,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -5;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(60, 40, 0x7a5a3a, 0x5c4428);
gridHelper.position.y = -4.99;
scene.add(gridHelper);

// hand-driven camera controller
const cameraController = createHandCameraController(camera);

// cursor + block selection
const cursorEl = document.getElementById("cursor");
const raycaster = new THREE.Raycaster();
const thumbTap = createThumbTapDetector();
let selectedMesh = null;
let selectedOriginalColor = null;
const HIGHLIGHT_COLOR = 0xf0c040;

// cursor smoothing
const CURSOR_SMOOTHING = 0.35;
let smoothCursorX = 0;
let smoothCursorY = 0;
let cursorInitialized = false;

// finger-gun hysteresis — need several consecutive frames to enter/exit
const FG_ENTER_FRAMES = 4;
const FG_EXIT_FRAMES = 6;
let fgConsecutive = 0;
let inFingerGunMode = false;
// scene API for LLM agent
initSceneContext(scene, camera);
initChatUI();
const clock = new THREE.Clock();

// static blocks on the ground
const blockMeshes = [];
const numBlocks = 40;
for (let i = 0; i < numBlocks; i++) {
  const block = getBlock();
  scene.add(block.mesh);
  blockMeshes.push(block.mesh);
}

function drawAllHands(handResults) {
  dotCanvas.width = dotCanvas.clientWidth;
  dotCanvas.height = dotCanvas.clientHeight;
  dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);

  for (let i = 0; i < handResults.landmarks.length; i++) {
    const label = handResults.handednesses[i][0].categoryName;
    const color = label === "Left" ? "#00ff88" : "#ff8800";

    for (const lm of handResults.landmarks[i]) {
      const x = (1 - lm.x) * dotCanvas.width;
      const y = lm.y * dotCanvas.height;
      dotCtx.beginPath();
      dotCtx.arc(x, y, 3, 0, Math.PI * 2);
      dotCtx.fillStyle = color;
      dotCtx.fill();
    }
  }
}

function animate() {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    const handResults = handLandmarker.detectForVideo(video, Date.now());

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

        if (!cursorInitialized) {
          smoothCursorX = rawX;
          smoothCursorY = rawY;
          cursorInitialized = true;
        } else {
          smoothCursorX += (rawX - smoothCursorX) * (1 - CURSOR_SMOOTHING);
          smoothCursorY += (rawY - smoothCursorY) * (1 - CURSOR_SMOOTHING);
        }

        cursorEl.style.display = "block";
        cursorEl.style.left = smoothCursorX + "px";
        cursorEl.style.top = smoothCursorY + "px";

        if (thumbTap(fingerGunHand)) {
          const ndc = new THREE.Vector2(
            (smoothCursorX / window.innerWidth) * 2 - 1,
            -(smoothCursorY / window.innerHeight) * 2 + 1
          );
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(blockMeshes);

          if (selectedMesh) {
            selectedMesh.material.color.set(selectedOriginalColor);
            selectedMesh.material.emissive?.set(0x000000);
          }

          if (hits.length > 0) {
            selectedMesh = hits[0].object;
            selectedOriginalColor = selectedMesh.material.color.getHex();
            selectedMesh.material.color.set(HIGHLIGHT_COLOR);
            cursorEl.classList.add("tapped");
            setTimeout(() => cursorEl.classList.remove("tapped"), 150);
          } else {
            selectedMesh = null;
            selectedOriginalColor = null;
          }
        }

        cameraController.update(null);
      } else {
        cursorEl.style.display = "none";
        cameraController.update(handResults.landmarks);
      }

      drawAllHands(handResults);
    } else {
      cursorEl.style.display = "none";
      cameraController.update(null);
      fgConsecutive = 0;
      inFingerGunMode = false;
      cursorInitialized = false;
      drawAllHands(handResults);
    }
  }

  tickAnimations(clock.getDelta());
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
