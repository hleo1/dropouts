import * as THREE from "three";
import { getBlock, createRedBox } from "./getBodies.js";
import getVisionStuff from "./getVisionStuff.js";
import { createHandCameraController } from "./handCameraControl.js";
import { FlickDetector } from "./gestures.js";

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

// All raycastable meshes — static blocks + user-placed red boxes
const raycastTargets = [];

const numBlocks = 40;
for (let i = 0; i < numBlocks; i++) {
  const block = getBlock();
  scene.add(block.mesh);
  raycastTargets.push(block.mesh);
}

// Center-screen raycaster
const raycaster = new THREE.Raycaster();
const CENTER_NDC = new THREE.Vector2(0, 0);

// Highlight state
let highlightedMesh = null;
let highlightedOriginalColor = null;

function setHighlight(mesh) {
  if (highlightedMesh && highlightedMesh !== mesh) {
    highlightedMesh.material.color.setHex(highlightedOriginalColor);
    highlightedMesh = null;
  }
  if (mesh && mesh !== highlightedMesh) {
    highlightedOriginalColor = mesh.material.color.getHex();
    mesh.material.color.setHex(0xffdd00);
    highlightedMesh = mesh;
  }
}

function clearHighlight() {
  if (highlightedMesh) {
    highlightedMesh.material.color.setHex(highlightedOriginalColor);
    highlightedMesh = null;
  }
}

const flickDetector = new FlickDetector({ velocityThreshold: 0.04, cooldownMs: 800 });

function drawHandDots(landmarks) {
  dotCanvas.width = dotCanvas.clientWidth;
  dotCanvas.height = dotCanvas.clientHeight;
  dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);

  if (!landmarks) return;

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
  let currentLandmarks = null;

  // hand-tracking → camera control + dots
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    const handResults = handLandmarker.detectForVideo(video, Date.now());

    if (handResults.landmarks.length > 0) {
      currentLandmarks = handResults.landmarks[0];
      cameraController.update(currentLandmarks);
      drawHandDots(currentLandmarks);
    } else {
      cameraController.update(null);
      drawHandDots(null);
    }
  }

  // Center-screen raycast
  raycaster.setFromCamera(CENTER_NDC, camera);
  const intersects = raycaster.intersectObjects(raycastTargets, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    setHighlight(hit.object);

    if (currentLandmarks) {
      if (flickDetector.check(currentLandmarks)) {
        // Offset box by 0.5 along surface normal so it sits on top of the hit surface
        const worldNormal = hit.face.normal.clone()
          .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
          .normalize();
        const placementPoint = hit.point.clone().add(worldNormal.multiplyScalar(0.5));
        const redBox = createRedBox(placementPoint);
        scene.add(redBox.mesh);
        raycastTargets.push(redBox.mesh);
      }
    }
  } else {
    clearHighlight();
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
