import * as THREE from "three";
import { getVisionStuff } from "./getVisionStuff.js";
import { createHandCameraController, isFingerGun, createThumbTapDetector } from "./handCameraControl.js";
import { initSceneContext, registerObject, getRegisteredAncestor, setSelectedName, tickAnimations } from "./sceneContext.js";
import { initChatUI } from "./chatUI.js";
import { createWindmill, createMountedKnight, createCastle, createVillage, GROUND_Y } from "./getBodies.js";
import { EffectComposer } from "jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "jsm/postprocessing/UnrealBloomPass.js";

// init three.js scene
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
// gradient sky
const skyCanvas = document.createElement("canvas");
skyCanvas.width = 2;
skyCanvas.height = 512;
const skyCtx = skyCanvas.getContext("2d");
const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 512);
skyGrad.addColorStop(0, "#0a0a2e");
skyGrad.addColorStop(0.2, "#1a1040");
skyGrad.addColorStop(0.4, "#4a2060");
skyGrad.addColorStop(0.6, "#8b3a62");
skyGrad.addColorStop(0.75, "#d4784a");
skyGrad.addColorStop(0.88, "#e8a040");
skyGrad.addColorStop(1, "#f0c870");
skyCtx.fillStyle = skyGrad;
skyCtx.fillRect(0, 0, 2, 512);
scene.background = new THREE.CanvasTexture(skyCanvas);

// atmospheric fog
scene.fog = new THREE.FogExp2(0x2a1845, 0.012);

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 200);
camera.position.z = 12;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(w, h),
  0.4,
  0.6,
  0.85
);
composer.addPass(bloomPass);

// lighting
const hemi = new THREE.HemisphereLight(0xc8e0f8, 0x6b8a3a, 0.6);
scene.add(hemi);

// main sun — warm directional key light
const sun = new THREE.DirectionalLight(0xfff0d6, 1.4);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
sun.shadow.camera.right = sun.shadow.camera.top = 30;
sun.shadow.bias = -0.001;
scene.add(sun);

// fill light — cool blue from opposite side to soften shadows
const fill = new THREE.DirectionalLight(0x8ab4f8, 0.35);
fill.position.set(-12, 10, -8);
scene.add(fill);

// rim/back light — subtle warm accent to separate objects from background
const rim = new THREE.DirectionalLight(0xffe0a0, 0.25);
rim.position.set(-5, 15, -15);
scene.add(rim);

// ambient bounce — very subtle warm uplighting to simulate ground bounce
const bounce = new THREE.PointLight(0xd4a050, 0.3, 50);
bounce.position.set(0, -3, 0);
scene.add(bounce);

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

// ground plane
const groundGeo = new THREE.PlaneGeometry(80, 80, 32, 32);
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
scene.add(windmill);
registerObject("windmill", windmill);

// castle with moat (bottom-left from default camera)
const castle = createCastle();
castle.position.set(-10, 0, 5);
castle.rotation.y = 0.4;
scene.add(castle);
registerObject("castle", castle);

// villages scattered around the scene
const villageSpots = [
  [10, -8], [-8, -10], [12, 7], [-14, -4], [5, 12], [-3, -12],
];
for (let i = 0; i < villageSpots.length; i++) {
  const [vx, vz] = villageSpots[i];
  const v = createVillage(3 + Math.floor(Math.random() * 3), 4 + Math.floor(Math.random() * 4));
  v.position.set(vx, 0, vz);
  scene.add(v);
  registerObject(`village-${i + 1}`, v);
}

// knight on boar-back in front of windmill
const knight = createMountedKnight();
knight.position.set(1.5, 0, 3.5);
knight.rotation.y = 0.3;
scene.add(knight);
registerObject("knight", knight);

// environment map for PBR reflections
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
scene.environment = pmremGenerator.fromScene(scene, 0, 0.1, 100).texture;
pmremGenerator.dispose();

// floating magic particles
const PARTICLE_COUNT = 200;
const PARTICLE_AREA = 60;
const PARTICLE_HEIGHT = 25;
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleSpeeds = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * PARTICLE_AREA;
  particlePositions[i * 3 + 1] = GROUND_Y + Math.random() * PARTICLE_HEIGHT;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_AREA;
  particleSpeeds[i] = 0.2 + Math.random() * 0.5;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0xffe8a0,
  size: 0.15,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

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

  const delta = clock.getDelta();
  tickAnimations(delta);
  windmill.userData.blades.rotation.z += 0.02;

  // animate particles
  const positions = particleGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3 + 1] += particleSpeeds[i] * delta;
    positions[i3] += Math.sin(Date.now() * 0.001 + i) * 0.003;
    positions[i3 + 2] += Math.cos(Date.now() * 0.0013 + i * 1.3) * 0.003;
    if (positions[i3 + 1] > GROUND_Y + PARTICLE_HEIGHT) {
      positions[i3] = (Math.random() - 0.5) * PARTICLE_AREA;
      positions[i3 + 1] = GROUND_Y;
      positions[i3 + 2] = (Math.random() - 0.5) * PARTICLE_AREA;
    }
  }
  particleGeo.attributes.position.needsUpdate = true;

  composer.render();
}
renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
