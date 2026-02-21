import * as THREE from "three";
import { getVisionStuff } from "./getVisionStuff.js";
import { createHandCameraController, isFingerGun, createThumbTapDetector } from "./handCameraControl.js";
import { initSceneContext, registerObject, getRegisteredAncestor, setSelectedName, tickAnimations } from "./sceneContext.js";
import { initChatUI } from "./solarChatUI.js";
import { PLANETS, createSun, createPlanet, createStarfield } from "./solarBodies.js";

// init three.js scene
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
camera.position.set(0, 15, 40);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// lighting — bright sun point light, no decay
const sunLight = new THREE.PointLight(0xfff5e0, 6, 0, 0);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
scene.add(sunLight);

// ambient — bright enough that the dark side still shows color
const ambient = new THREE.AmbientLight(0x667788, 1.2);
scene.add(ambient);

// fill from above
const fillLight = new THREE.DirectionalLight(0x8899aa, 0.6);
fillLight.position.set(0, 20, 10);
scene.add(fillLight);

// init video and MediaPipe
const { video, handLandmarker } = await getVisionStuff();

// PIP webcam overlay
const pipVideo = document.getElementById("webcam-pip");
pipVideo.srcObject = video.srcObject;

// hand dots canvas
const dotCanvas = document.getElementById("hand-dots");
const dotCtx = dotCanvas.getContext("2d");

// starfield backdrop
const starfield = createStarfield();
scene.add(starfield);

// sun at origin
const sunMesh = createSun();
scene.add(sunMesh);
registerObject("sun", sunMesh);

// planets
for (const p of PLANETS) {
  const planet = createPlanet(p.name, p.radius, p.color, {
    ring: p.ring,
    tilted: p.tilted,
    moon: p.moon,
  });

  // place in a straight line along +X
  planet.position.set(p.orbitR, 0, 0);

  scene.add(planet);
  registerObject(p.name, planet);
}

// hand-driven camera controller
const cameraController = createHandCameraController(camera);

// cursor + selection
const cursorEl = document.getElementById("cursor");
const raycaster = new THREE.Raycaster();
const thumbTap = createThumbTapDetector();
let selectedGroup = null;
const savedMaterials = new Map();
const HIGHLIGHT_EMISSIVE = new THREE.Color(0xff00ff);
const HIGHLIGHT_INTENSITY = 0.35;

function highlightGroup(group) {
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      savedMaterials.set(child, child.material);
      const cloned = child.material.clone();
      cloned.emissive = HIGHLIGHT_EMISSIVE.clone();
      cloned.emissiveIntensity = HIGHLIGHT_INTENSITY;
      child.material = cloned;
    }
  });
}

function unhighlightGroup() {
  for (const [mesh, original] of savedMaterials) {
    mesh.material.dispose();
    mesh.material = original;
  }
  savedMaterials.clear();
  selectedGroup = null;
  setSelectedName(null);
}

// cursor smoothing
const CURSOR_SMOOTHING = 0.35;
let smoothCursorX = 0;
let smoothCursorY = 0;
let cursorInitialized = false;

// finger-gun hysteresis
const FG_ENTER_FRAMES = 4;
const FG_EXIT_FRAMES = 6;
let fgConsecutive = 0;
let inFingerGunMode = false;

// scene API for LLM agent
initSceneContext(scene, camera);
initChatUI();
const clock = new THREE.Clock();

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
      for (const lm of handResults.landmarks) {
        if (isFingerGun(lm)) {
          fingerGunHand = lm;
          break;
        }
      }

      // finger-gun hysteresis
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
        cameraController.stopInertia();
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
          const hits = raycaster.intersectObjects(scene.children, true);

          if (selectedGroup) unhighlightGroup();

          let match = null;
          for (const hit of hits) {
            const ancestor = getRegisteredAncestor(hit.object);
            if (ancestor) { match = ancestor; break; }
          }

          if (match && match.object !== selectedGroup) {
            selectedGroup = match.object;
            setSelectedName(match.name);
            highlightGroup(selectedGroup);
            cursorEl.classList.add("tapped");
            setTimeout(() => cursorEl.classList.remove("tapped"), 150);
          }
        }

        cameraController.update(null, "brake");
      } else {
        cursorEl.style.display = "none";
        cameraController.update(handResults.landmarks);
      }

      drawAllHands(handResults);
    } else {
      cursorEl.style.display = "none";
      cameraController.update(null, "coast");
      fgConsecutive = 0;
      inFingerGunMode = false;
      cursorInitialized = false;
      drawAllHands(handResults);
    }
  }

  const delta = clock.getDelta();
  tickAnimations(delta);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
