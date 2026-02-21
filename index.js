import * as THREE from "three";
import { getVisionStuff } from "./getVisionStuff.js";
import { createHandCameraController, isFingerGun, createThumbTapDetector } from "./handCameraControl.js";
import { initSceneContext, registerObject, getRegisteredAncestor, setSelectedName, tickAnimations } from "./sceneContext.js";
import { initChatUI } from "./chatUI.js";
import {
  createWindmill, createMountedKnight, createCastle, createVillage,
  createTree, createHill, createMountain, buildVillager, getTerrainHeight,
} from "./getBodies.js";

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

// grass texture (procedural)
const grassSize = 512;
const grassCanvas = document.createElement("canvas");
grassCanvas.width = grassSize;
grassCanvas.height = grassSize;
const grassCtx = grassCanvas.getContext("2d");
grassCtx.fillStyle = "#4a6b2e";
grassCtx.fillRect(0, 0, grassSize, grassSize);

// organic color patches (soft radial splotches for macro variation)
const patchColors = [
  "rgba(74, 107, 46, 0.4)", "rgba(90, 124, 62, 0.3)",
  "rgba(107, 141, 78, 0.3)", "rgba(61, 90, 34, 0.4)",
  "rgba(100, 90, 50, 0.15)", "rgba(120, 140, 70, 0.2)",
];
for (let i = 0; i < 40; i++) {
  const cx = Math.random() * grassSize;
  const cy = Math.random() * grassSize;
  const r = 30 + Math.random() * 80;
  const grad = grassCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, patchColors[Math.floor(Math.random() * patchColors.length)]);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  grassCtx.fillStyle = grad;
  grassCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// small dirt/earth patches
for (let i = 0; i < 8; i++) {
  const cx = Math.random() * grassSize;
  const cy = Math.random() * grassSize;
  const r = 10 + Math.random() * 25;
  const grad = grassCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, "rgba(110, 85, 55, 0.5)");
  grad.addColorStop(0.6, "rgba(90, 75, 45, 0.3)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  grassCtx.fillStyle = grad;
  grassCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

// per-pixel micro noise
const imgData = grassCtx.getImageData(0, 0, grassSize, grassSize);
for (let i = 0; i < imgData.data.length; i += 4) {
  const n = (Math.random() - 0.5) * 18;
  imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + n));
  imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
  imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n * 0.5));
}
grassCtx.putImageData(imgData, 0, 0);

// dense curved grass blades
const bladeColors = [
  "#3d5a22", "#4a6b2e", "#5a7c3e", "#6b8d4e", "#7a9c5a",
  "#526e30", "#445e28", "#8aac5a", "#3a5520",
];
for (let i = 0; i < 3000; i++) {
  const bx = Math.random() * grassSize;
  const by = Math.random() * grassSize;
  const h = 4 + Math.random() * 10;
  const lean = (Math.random() - 0.5) * 6;
  grassCtx.strokeStyle = bladeColors[Math.floor(Math.random() * bladeColors.length)];
  grassCtx.globalAlpha = 0.3 + Math.random() * 0.5;
  grassCtx.lineWidth = 0.5 + Math.random() * 1.0;
  grassCtx.beginPath();
  grassCtx.moveTo(bx, by);
  grassCtx.quadraticCurveTo(bx + lean * 0.6 + (Math.random() - 0.5) * 2, by - h * 0.6, bx + lean, by - h);
  grassCtx.stroke();
}
grassCtx.globalAlpha = 1;
const grassTexture = new THREE.CanvasTexture(grassCanvas);
grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(20, 20);

// ground plane with terrain displacement
const groundGeo = new THREE.PlaneGeometry(80, 80, 128, 128);
const pos = groundGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  // plane lies in XY before rotation; Y becomes Z in world, Z attr stores displacement → becomes Y
  pos.setZ(i, getTerrainHeight(x, -y));
}
groundGeo.computeVertexNormals();
const groundMat = new THREE.MeshStandardMaterial({
  map: grassTexture,
  roughness: 0.9,
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

// windmill at origin
const windmill = createWindmill();
windmill.position.y = getTerrainHeight(0, 0);
scene.add(windmill);
registerObject("windmill", windmill);

// castle with moat (bottom-left from default camera)
const castle = createCastle();
castle.position.set(-10, getTerrainHeight(-10, 5), 5);
castle.rotation.y = 0.4;
scene.add(castle);
registerObject("castle", castle);

// villages scattered densely around the scene
const villageSpots = [
  [10, -8], [-8, -10], [12, 7], [-14, -4], [5, 12], [-3, -12],
  [4, 8], [-6, 4], [8, 4], [-10, -8], [15, -3], [-2, 7],
  [6, -4], [-12, 12],
];
for (let i = 0; i < villageSpots.length; i++) {
  const [vx, vz] = villageSpots[i];
  const cottages = 5 + Math.floor(Math.random() * 4);
  const villagers = 6 + Math.floor(Math.random() * 5);
  const v = createVillage(cottages, villagers);
  v.position.set(vx, getTerrainHeight(vx, vz), vz);
  scene.add(v);
  registerObject(`village-${i + 1}`, v);
}

// knight on boar-back in front of windmill
const knight = createMountedKnight();
knight.position.set(1.5, getTerrainHeight(1.5, 3.5), 3.5);
knight.rotation.y = 0.3;
scene.add(knight);
registerObject("knight", knight);

// trees scattered densely throughout the scene
const treePositions = [
  [6, 3], [-5, -7], [14, 2], [-12, 8], [8, -12],
  [-7, 14], [16, -5], [-15, -8], [3, -9], [11, 11],
  [-9, 3], [18, 8], [-4, 10], [7, -6], [-16, 1],
  [2, -6], [-3, 8], [9, 1], [-7, -3], [13, -9],
  [5, -14], [-11, 2], [17, 4], [-14, 10], [1, 14],
  [-8, -15], [10, 5], [-5, 12], [15, 10], [-18, -3],
  [7, 9], [-2, -8], [4, -3], [-9, 7], [12, -4],
  [20, 1], [-20, 6], [3, 16], [-6, -18], [8, 18],
  [-15, 14], [18, -10], [-17, -12], [11, -15], [0, -16],
];
for (let i = 0; i < treePositions.length; i++) {
  const [tx, tz] = treePositions[i];
  const s = 0.8 + Math.random() * 0.5;
  const tree = createTree(s);
  tree.position.set(tx, getTerrainHeight(tx, tz), tz);
  tree.rotation.y = Math.random() * Math.PI * 2;
  scene.add(tree);
  registerObject(`tree-${i + 1}`, tree);
}

// standalone villagers wandering between villages
for (let i = 0; i < 20; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 3 + Math.random() * 18;
  const vx = Math.cos(angle) * dist;
  const vz = Math.sin(angle) * dist;
  const v = buildVillager();
  v.position.set(vx, getTerrainHeight(vx, vz), vz);
  v.rotation.y = Math.random() * Math.PI * 2;
  scene.add(v);
}

// hills — gentle bumps across the landscape
const hillSpots = [
  [8, 10, 4, 1.5], [-12, -6, 3.5, 1.2], [16, -8, 5, 2.0],
  [-18, 10, 4.5, 1.8], [3, -15, 3, 1.0], [-6, 16, 4, 1.4],
  [14, 14, 3.5, 1.3], [-16, -14, 5, 2.2],
];
for (let i = 0; i < hillSpots.length; i++) {
  const [hx, hz, hr, hh] = hillSpots[i];
  const hill = createHill(hr, hh);
  hill.position.set(hx, getTerrainHeight(hx, hz), hz);
  scene.add(hill);
  registerObject(`hill-${i + 1}`, hill);
}

// mountains — tall peaks at the far edges framing the scene
const mountainSpots = [
  [25, 20, 6, 12], [-28, 15, 7, 14], [30, -15, 5, 10],
  [-25, -22, 8, 16], [0, 28, 6, 11],
];
for (let i = 0; i < mountainSpots.length; i++) {
  const [mx, mz, mr, mh] = mountainSpots[i];
  const mountain = createMountain(mr, mh);
  mountain.position.set(mx, getTerrainHeight(mx, mz), mz);
  scene.add(mountain);
  registerObject(`mountain-${i + 1}`, mountain);
}

// hand-driven camera controller
const cameraController = createHandCameraController(camera);

// cursor + block selection
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

// finger-gun hysteresis — need several consecutive frames to enter/exit
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

          // find first hit that belongs to a registered object
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

  tickAnimations(clock.getDelta());
  windmill.userData.blades.rotation.z += 0.02;
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
