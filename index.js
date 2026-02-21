import * as THREE from "three";
import { getBlock } from "./getBodies.js";
import getVisionStuff from "./getVisionStuff.js";
import { createHandCameraController } from "./handCameraControl.js";

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

// static blocks on the ground
const numBlocks = 40;
for (let i = 0; i < numBlocks; i++) {
  const block = getBlock();
  scene.add(block.mesh);
}

function drawHandDots(hands) {
  dotCanvas.width = dotCanvas.clientWidth;
  dotCanvas.height = dotCanvas.clientHeight;
  dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);

  if (!hands || hands.length === 0) return;

  for (const { landmarks, isRight } of hands) {
    const color = isRight ? '#00ff88' : '#ff8800';
    landmarks.forEach((lm) => {
      const x = (1 - lm.x) * dotCanvas.width;
      const y = lm.y * dotCanvas.height;
      dotCtx.beginPath();
      dotCtx.arc(x, y, 3, 0, Math.PI * 2);
      dotCtx.fillStyle = color;
      dotCtx.fill();
    });
  }
}

function animate() {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    const handResults = handLandmarker.detectForVideo(video, Date.now());
    const numHands = handResults.landmarks.length;

    if (numHands > 0) {
      let rightLandmarks = null;
      const handsForDots = [];

      for (let i = 0; i < numHands; i++) {
        const label = handResults.handednesses[i][0].categoryName;
        const isRight = label === 'Left';
        handsForDots.push({ landmarks: handResults.landmarks[i], isRight });
        if (isRight) {
          rightLandmarks = handResults.landmarks[i];
        }
      }

      cameraController.update(rightLandmarks);
      drawHandDots(handsForDots);
    } else {
      cameraController.update(null);
      drawHandDots(null);
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
