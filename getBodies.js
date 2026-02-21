import * as THREE from "three";

const GROUND_Y = -5;

function getBlock() {
  const w = 0.5 + Math.random() * 1.5;
  const h = 0.5 + Math.random() * 2.0;
  const d = 0.5 + Math.random() * 1.5;

  const geometry = new THREE.BoxGeometry(w, h, d);
  const palette = [0xe8d5b7, 0xd4a574, 0xc9b896, 0xdfc9a8, 0xe5d4b8];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const material = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3d2e1f });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  mesh.add(wireframe);

  const range = 16;
  const x = (Math.random() - 0.5) * range;
  const z = (Math.random() - 0.5) * range;
  mesh.position.set(x, GROUND_Y + h / 2, z);

  // small random rotation around Y for variety
  mesh.rotation.y = Math.random() * Math.PI;

  return { mesh };
}

export { getBlock };
