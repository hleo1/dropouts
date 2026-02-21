import * as THREE from "three";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";

let _scene = null;
let _camera = null;

const objectRegistry = new Map();
const animations = new Map();
let animId = 0;
let _selectedName = null;

export function initSceneContext(scene, camera) {
  _scene = scene;
  _camera = camera;
}

export function getSceneAPI() {
  return {
    THREE,
    scene: _scene,
    camera: _camera,
    GROUND_Y: -5,

    addObject(mesh, name) {
      if (!name) name = `obj_${Date.now()}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      objectRegistry.set(name, mesh);
      _scene.add(mesh);
      return name;
    },

    removeObject(name) {
      const obj = objectRegistry.get(name);
      if (!obj) return false;
      _scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      objectRegistry.delete(name);
      return true;
    },

    getObject(name) {
      return objectRegistry.get(name) || null;
    },

    listObjects() {
      return Array.from(objectRegistry.keys());
    },

    getSelected() {
      return _selectedName;
    },

    clearAll() {
      for (const name of objectRegistry.keys()) {
        const obj = objectRegistry.get(name);
        _scene.remove(obj);
        obj.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        });
      }
      objectRegistry.clear();
      animations.clear();
    },

    createSphere(radius = 1, color = 0xff0000, pos = { x: 0, y: 0, z: 0 }) {
      const geo = new THREE.SphereGeometry(radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      return mesh;
    },

    createBox(width = 1, height = 1, depth = 1, color = 0x00ff00, pos = { x: 0, y: 0, z: 0 }) {
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      return mesh;
    },

    createCylinder(radiusTop = 0.5, radiusBottom = 0.5, height = 1, color = 0x0000ff, pos = { x: 0, y: 0, z: 0 }) {
      const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
      const mat = new THREE.MeshStandardMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      return mesh;
    },

    createPlane(width = 10, height = 10, color = 0x888888, pos = { x: 0, y: 0, z: 0 }) {
      const geo = new THREE.PlaneGeometry(width, height);
      const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      return mesh;
    },

    addPointLight(color = 0xffffff, intensity = 1, pos = { x: 0, y: 5, z: 0 }) {
      const light = new THREE.PointLight(color, intensity, 50);
      light.position.set(pos.x, pos.y, pos.z);
      return light;
    },

    addDirectionalLight(color = 0xffffff, intensity = 1, pos = { x: 5, y: 10, z: 5 }) {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(pos.x, pos.y, pos.z);
      return light;
    },

    addAmbientLight(color = 0xffffff, intensity = 0.5) {
      return new THREE.AmbientLight(color, intensity);
    },

    addAnimation(name, callback) {
      const id = ++animId;
      animations.set(name || `anim_${id}`, callback);
      return name || `anim_${id}`;
    },

    removeAnimation(name) {
      return animations.delete(name);
    },

    async loadGLTF(url) {
      const loader = new GLTFLoader();
      return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => resolve(gltf), undefined, reject);
      });
    },

    vec3(x = 0, y = 0, z = 0) {
      return new THREE.Vector3(x, y, z);
    },

    color(c) {
      return new THREE.Color(c);
    },

    degToRad(deg) {
      return THREE.MathUtils.degToRad(deg);
    },
  };
}

export function registerObject(name, obj) {
  objectRegistry.set(name, obj);
}

export function setSelectedName(name) {
  _selectedName = name;
}

export function getRegisteredAncestor(obj) {
  let current = obj;
  while (current) {
    for (const [name, registered] of objectRegistry) {
      if (registered === current) return { name, object: current };
    }
    current = current.parent;
  }
  return null;
}

export function tickAnimations(delta) {
  for (const cb of animations.values()) {
    try {
      cb(delta);
    } catch (_) {
      // ignore per-frame errors
    }
  }
}
