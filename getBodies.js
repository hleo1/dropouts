import * as THREE from "three";

const GROUND_Y = -5;

function getBlock() {
  const w = 0.5 + Math.random() * 1.5;
  const h = 0.5 + Math.random() * 2.0;
  const d = 0.5 + Math.random() * 1.5;

  const geometry = new THREE.BoxGeometry(w, h, d);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.85, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);

  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
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

function getBlockAt(x, z) {
  const w = 0.5 + Math.random() * 1.5;
  const h = 0.5 + Math.random() * 2.0;
  const d = 0.5 + Math.random() * 1.5;

  const geometry = new THREE.BoxGeometry(w, h, d);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.85, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);

  const edges = new THREE.EdgesGeometry(geometry);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  mesh.add(wireframe);

  mesh.position.set(x, GROUND_Y + h / 2, z);
  mesh.rotation.y = Math.random() * Math.PI;

  return { mesh };
}

export { getBlock, getBlockAt };
