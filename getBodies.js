import * as THREE from "three";

const GROUND_Y = -5;

// shared material palette — use these for all scene objects
const materials = {
  stone: new THREE.MeshStandardMaterial({ color: 0x7a7a78, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8b7242, roughness: 0.7 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x5c4830, roughness: 0.6 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 }),
  sail: new THREE.MeshStandardMaterial({
    color: 0xf0e8d8, roughness: 0.5, side: THREE.DoubleSide,
  }),
  door: new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xc8e0f0, roughness: 0.2 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa8b0b8, roughness: 0.3, metalness: 0.7 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 }),
  water: new THREE.MeshStandardMaterial({
    color: 0x2a6496, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.8,
  }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x3d6b2e, roughness: 0.8 }),
  rock: new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.95 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }),
};


function createBladeArm() {
  const arm = new THREE.Group();
  const spar = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.07, 0.07), materials.darkWood
  );
  spar.position.x = 1.6;
  spar.castShadow = true;
  arm.add(spar);
  const sail = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.55, 0.02), materials.sail
  );
  sail.position.set(1.6, 0.32, 0);
  sail.castShadow = true;
  sail.receiveShadow = true;
  arm.add(sail);
  return arm;
}

function createWindmill() {
  const windmill = new THREE.Group();
  const TOWER_BOTTOM = GROUND_Y + 1.0;
  const TOWER_TOP = GROUND_Y + 6.0;
  const TOWER_HEIGHT = TOWER_TOP - TOWER_BOTTOM;
  const TOWER_R_BOTTOM = 0.9;
  const TOWER_R_TOP = 0.5;

  // stone foundation
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.1, 1.0, 10), materials.stone
  );
  base.position.y = GROUND_Y + 0.5;
  base.castShadow = true;
  base.receiveShadow = true;
  windmill.add(base);

  // tower body (tapered, smooth)
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R_TOP, TOWER_R_BOTTOM, TOWER_HEIGHT, 16),
    materials.wood
  );
  tower.position.y = TOWER_BOTTOM + TOWER_HEIGHT / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  windmill.add(tower);

  // decorative band rings
  for (const bandY of [GROUND_Y + 2.0, GROUND_Y + 3.5, GROUND_Y + 5.0]) {
    const t = (bandY - TOWER_BOTTOM) / TOWER_HEIGHT;
    const r = TOWER_R_BOTTOM + (TOWER_R_TOP - TOWER_R_BOTTOM) * t;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(r + 0.02, 0.04, 8, 24), materials.darkWood
    );
    band.position.y = bandY;
    band.rotation.x = Math.PI / 2;
    windmill.add(band);
  }

  // conical roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.5, 12), materials.roof
  );
  roof.position.y = TOWER_TOP + 0.75;
  roof.castShadow = true;
  windmill.add(roof);

  // hub (sphere, pushed forward)
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10), materials.darkWood
  );
  hub.position.set(0, TOWER_TOP + 0.3, 0.55);
  hub.castShadow = true;
  windmill.add(hub);

  // blades (4 arms with spar + sail)
  const bladesGroup = new THREE.Group();
  bladesGroup.position.set(0, TOWER_TOP + 0.3, 0.6);
  for (let i = 0; i < 4; i++) {
    const arm = createBladeArm();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    bladesGroup.add(arm);
  }
  windmill.add(bladesGroup);
  windmill.userData.blades = bladesGroup;

  // door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.7, 0.05), materials.door
  );
  door.position.set(0, GROUND_Y + 1.35, TOWER_R_BOTTOM + 0.01);
  windmill.add(door);

  // circular windows
  const winGeo = new THREE.CircleGeometry(0.12, 10);
  for (const wy of [GROUND_Y + 3.5, GROUND_Y + 5.0]) {
    const t = (wy - TOWER_BOTTOM) / TOWER_HEIGHT;
    const r = TOWER_R_BOTTOM + (TOWER_R_TOP - TOWER_R_BOTTOM) * t;
    const win = new THREE.Mesh(winGeo, materials.glass);
    win.position.set(0, wy, r + 0.02);
    windmill.add(win);
  }

  windmill.position.set(0, 0, 0);
  return windmill;
}

function buildBoar() {
  const boar = new THREE.Group();
  const hideMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });

  // body (stocky barrel)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 1.5), hideMat
  );
  body.position.y = GROUND_Y + 0.85;
  body.castShadow = true;
  boar.add(body);

  // legs (short, stout)
  const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
  for (const [lx, lz] of [[-0.25, -0.5], [0.25, -0.5], [-0.25, 0.5], [0.25, 0.5]]) {
    const leg = new THREE.Mesh(legGeo, hideMat);
    leg.position.set(lx, GROUND_Y + 0.275, lz);
    leg.castShadow = true;
    boar.add(leg);
  }

  // head (big, blocky)
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.45, 0.5), hideMat
  );
  head.position.set(0, GROUND_Y + 0.9, -1.0);
  head.castShadow = true;
  boar.add(head);

  // snout
  const snout = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.2, 0.3), hideMat
  );
  snout.position.set(0, GROUND_Y + 0.75, -1.3);
  boar.add(snout);

  // tusks (curving upward)
  const tuskGeo = new THREE.ConeGeometry(0.03, 0.2, 5);
  for (const tx of [-0.12, 0.12]) {
    const tusk = new THREE.Mesh(tuskGeo, materials.sail);
    tusk.position.set(tx, GROUND_Y + 0.8, -1.4);
    tusk.rotation.x = -0.5;
    boar.add(tusk);
  }

  // ears (small, pointed, angled out)
  const earGeo = new THREE.ConeGeometry(0.06, 0.15, 4);
  for (const [ex, rz] of [[-0.2, 0.4], [0.2, -0.4]]) {
    const ear = new THREE.Mesh(earGeo, hideMat);
    ear.position.set(ex, GROUND_Y + 1.2, -0.9);
    ear.rotation.z = rz;
    boar.add(ear);
  }

  // bristle ridge (along spine)
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.12, 1.2), materials.darkWood
  );
  ridge.position.set(0, GROUND_Y + 1.21, -0.1);
  boar.add(ridge);

  // tail (short, curled up)
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.2), hideMat
  );
  tail.position.set(0, GROUND_Y + 1.1, 0.85);
  tail.rotation.x = -0.8;
  boar.add(tail);

  // saddle
  const saddle = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.1, 0.5), materials.door
  );
  saddle.position.set(0, GROUND_Y + 1.2, -0.1);
  boar.add(saddle);

  return boar;
}

function buildKnight() {
  const knight = new THREE.Group();
  const SEAT_Y = GROUND_Y + 1.25;
  const plumeMat = new THREE.MeshStandardMaterial({ color: 0xcc2233, roughness: 0.6 });

  // torso
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.6, 0.3), materials.metal
  );
  torso.position.y = SEAT_Y + 0.3;
  torso.castShadow = true;
  knight.add(torso);

  // helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8), materials.metal
  );
  helmet.position.y = SEAT_Y + 0.75;
  helmet.castShadow = true;
  knight.add(helmet);

  // visor slit
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.04, 0.05), materials.door
  );
  visor.position.set(0, SEAT_Y + 0.73, -0.16);
  knight.add(visor);

  // plume
  const plume = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.3, 0.25), plumeMat
  );
  plume.position.set(0, SEAT_Y + 0.95, 0);
  knight.add(plume);

  // arms
  const armGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
  const rArm = new THREE.Mesh(armGeo, materials.metal);
  rArm.position.set(-0.3, SEAT_Y + 0.25, 0);
  rArm.castShadow = true;
  knight.add(rArm);
  const lArm = new THREE.Mesh(armGeo, materials.metal);
  lArm.position.set(0.3, SEAT_Y + 0.25, 0);
  lArm.castShadow = true;
  knight.add(lArm);

  // lance
  const lance = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 3.0, 6), materials.darkWood
  );
  lance.position.set(-0.3, SEAT_Y + 0.7, -0.5);
  lance.rotation.x = 0.3;
  lance.castShadow = true;
  knight.add(lance);

  // shield
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.4, 0.3), materials.metal
  );
  shield.position.set(0.38, SEAT_Y + 0.25, -0.05);
  shield.castShadow = true;
  knight.add(shield);

  // shield emblem
  const emblem = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.2, 0.15), plumeMat
  );
  emblem.position.set(0.41, SEAT_Y + 0.27, -0.05);
  knight.add(emblem);

  // legs (hanging down sides of horse)
  const legGeo = new THREE.BoxGeometry(0.15, 0.4, 0.2);
  for (const lx of [-0.32, 0.32]) {
    const leg = new THREE.Mesh(legGeo, materials.metal);
    leg.position.set(lx, SEAT_Y - 0.15, -0.1);
    leg.castShadow = true;
    knight.add(leg);
  }

  return knight;
}

function createMountedKnight() {
  const group = new THREE.Group();
  group.add(buildBoar());
  group.add(buildKnight());
  return group;
}

function buildCornerTower(x, z) {
  const tower = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.65, 4, 10), materials.stone
  );
  body.position.y = GROUND_Y + 2;
  body.castShadow = true;
  body.receiveShadow = true;
  tower.add(body);

  const roofCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 1.5, 10), materials.roof
  );
  roofCone.position.y = GROUND_Y + 4.75;
  roofCone.castShadow = true;
  tower.add(roofCone);

  // merlons around tower top
  const mGeo = new THREE.BoxGeometry(0.2, 0.3, 0.15);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const merlon = new THREE.Mesh(mGeo, materials.stone);
    merlon.position.set(Math.cos(angle) * 0.5, GROUND_Y + 4.15, Math.sin(angle) * 0.5);
    tower.add(merlon);
  }

  tower.position.set(x, 0, z);
  return tower;
}

function buildCastleKeep() {
  const keep = new THREE.Group();

  // main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 5, 2.5), materials.stone
  );
  body.position.y = GROUND_Y + 2.5;
  body.castShadow = true;
  body.receiveShadow = true;
  keep.add(body);

  // battlement rim
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.3, 2.8), materials.stone
  );
  rim.position.y = GROUND_Y + 5.15;
  keep.add(rim);

  // merlons (3 per side)
  const mGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
  for (const o of [-0.9, 0, 0.9]) {
    for (const [mx, mz] of [[o, -1.25], [o, 1.25], [-1.25, o], [1.25, o]]) {
      const m = new THREE.Mesh(mGeo, materials.stone);
      m.position.set(mx, GROUND_Y + 5.5, mz);
      keep.add(m);
    }
  }

  // flag pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 2, 6), materials.darkWood
  );
  pole.position.y = GROUND_Y + 6.3;
  keep.add(pole);

  // flag
  const flagMat = new THREE.MeshStandardMaterial({
    color: 0xcc2233, roughness: 0.6, side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), flagMat);
  flag.position.set(0.4, GROUND_Y + 6.95, 0);
  keep.add(flag);

  // windows on front and back
  const winGeo = new THREE.BoxGeometry(0.25, 0.5, 0.05);
  for (const wz of [-1.26, 1.26]) {
    for (const wy of [GROUND_Y + 2.5, GROUND_Y + 4.0]) {
      const win = new THREE.Mesh(winGeo, materials.glass);
      win.position.set(0, wy, wz);
      keep.add(win);
    }
  }

  return keep;
}

function createCastle() {
  const castle = new THREE.Group();
  const WALL_H = 3;
  const WALL_Y = GROUND_Y + WALL_H / 2;
  const HALF = 3;

  // moat (water ring)
  const moat = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 6.5, 32), materials.water
  );
  moat.rotation.x = -Math.PI / 2;
  moat.position.y = GROUND_Y + 0.02;
  moat.receiveShadow = true;
  castle.add(moat);

  // curtain walls
  const addWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, WALL_H, d), materials.stone
    );
    wall.position.set(x, WALL_Y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    castle.add(wall);
  };
  addWall(6.3, 0.3, 0, HALF);           // back
  addWall(0.3, 6.3, -HALF, 0);          // left
  addWall(0.3, 6.3, HALF, 0);           // right
  addWall(1.8, 0.3, -2.1, -HALF);       // front-left
  addWall(1.8, 0.3, 2.1, -HALF);        // front-right

  // corner towers
  for (const [tx, tz] of [[-HALF, -HALF], [HALF, -HALF], [-HALF, HALF], [HALF, HALF]]) {
    castle.add(buildCornerTower(tx, tz));
  }

  // gatehouse (raised block above gate)
  const gatehouse = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.0, 0.5), materials.stone
  );
  gatehouse.position.set(0, GROUND_Y + 3.5, -HALF);
  gatehouse.castShadow = true;
  castle.add(gatehouse);

  // gate (dark opening)
  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.5, 0.1), materials.door
  );
  gate.position.set(0, GROUND_Y + 1.25, -HALF);
  castle.add(gate);

  // drawbridge over moat
  const drawbridge = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.08, 3.5), materials.wood
  );
  drawbridge.position.set(0, GROUND_Y + 0.04, -HALF - 1.75);
  drawbridge.receiveShadow = true;
  castle.add(drawbridge);

  castle.add(buildCastleKeep());

  return castle;
}

function buildCottage() {
  const cottage = new THREE.Group();
  const wallColors = [0xd4c4a8, 0xc9b896, 0xe0d0b0, 0xbcaa8a];
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallColors[Math.floor(Math.random() * wallColors.length)], roughness: 0.8,
  });

  const w = 0.8 + Math.random() * 0.6;
  const h = 0.7 + Math.random() * 0.4;
  const d = 0.8 + Math.random() * 0.6;

  // walls
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = GROUND_Y + h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  cottage.add(walls);

  // pyramid roof
  const roofR = Math.max(w, d) * 0.75;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(roofR, 0.5 + Math.random() * 0.3, 4), materials.roof
  );
  roof.position.y = GROUND_Y + h + 0.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  cottage.add(roof);

  // door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.4, 0.03), materials.door
  );
  door.position.set(0, GROUND_Y + 0.2, d / 2 + 0.01);
  cottage.add(door);

  // window
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.03), materials.glass
  );
  win.position.set(w * 0.3, GROUND_Y + h * 0.6, d / 2 + 0.01);
  cottage.add(win);

  return cottage;
}

function buildVillager() {
  const villager = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
  const clothColors = [0x4466aa, 0xaa4444, 0x44aa44, 0x886644, 0xaa8844, 0x664488];
  const clothMat = new THREE.MeshStandardMaterial({
    color: clothColors[Math.floor(Math.random() * clothColors.length)], roughness: 0.7,
  });

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), skinMat);
  head.position.y = GROUND_Y + 0.95;
  head.castShadow = true;
  villager.add(head);

  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.15), clothMat);
  body.position.y = GROUND_Y + 0.7;
  body.castShadow = true;
  villager.add(body);

  // legs
  const legGeo = new THREE.BoxGeometry(0.07, 0.35, 0.07);
  for (const lx of [-0.05, 0.05]) {
    const leg = new THREE.Mesh(legGeo, materials.darkWood);
    leg.position.set(lx, GROUND_Y + 0.35, 0);
    leg.castShadow = true;
    villager.add(leg);
  }

  // arms
  const armGeo = new THREE.BoxGeometry(0.06, 0.3, 0.06);
  for (const ax of [-0.15, 0.15]) {
    const arm = new THREE.Mesh(armGeo, clothMat);
    arm.position.set(ax, GROUND_Y + 0.68, 0);
    villager.add(arm);
  }

  return villager;
}

function createVillage(numCottages, numVillagers) {
  const village = new THREE.Group();

  // stone well at center
  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 0.4, 8), materials.stone
  );
  well.position.y = GROUND_Y + 0.2;
  well.castShadow = true;
  village.add(well);

  // cottages arranged in a ring
  for (let i = 0; i < numCottages; i++) {
    const cottage = buildCottage();
    const angle = (i / numCottages) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 1.5 + Math.random() * 2;
    cottage.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    cottage.rotation.y = angle + Math.PI;
    village.add(cottage);
  }

  // villagers scattered around
  for (let i = 0; i < numVillagers; i++) {
    const v = buildVillager();
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * 3.5;
    v.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    v.rotation.y = Math.random() * Math.PI * 2;
    village.add(v);
  }

  return village;
}

// flat zones: [x, z, radius] — structures that need flat ground beneath them
const FLAT_ZONES = [
  [0, 0, 6],       // windmill
  [-10, 5, 10],    // castle + moat
  [1.5, 3.5, 2],   // knight
];

function getTerrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.15) * Math.cos(z * 0.12) * 1.5;
  h += Math.sin(x * 0.3 + 1.0) * Math.cos(z * 0.25 + 0.5) * 0.6;
  h += Math.sin(x * 0.08 + 2.0) * Math.cos(z * 0.1 - 1.0) * 0.8;
  // flatten near key structures
  let flatten = 1;
  for (const [fx, fz, fr] of FLAT_ZONES) {
    const d = Math.sqrt((x - fx) ** 2 + (z - fz) ** 2);
    if (d < fr) {
      flatten = Math.min(flatten, Math.max(0, (d / fr) ** 2));
    }
  }
  return h * flatten;
}

function createHill(radius, height) {
  const hill = new THREE.Group();
  const geo = new THREE.SphereGeometry(radius, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.Mesh(geo, materials.foliage);
  mesh.scale.y = height / radius;
  mesh.position.y = GROUND_Y;
  mesh.receiveShadow = true;
  hill.add(mesh);
  return hill;
}

function createMountain(baseRadius, peakHeight) {
  const mountain = new THREE.Group();
  // main rocky body
  const body = new THREE.Mesh(
    new THREE.ConeGeometry(baseRadius, peakHeight, 8), materials.rock
  );
  body.position.y = GROUND_Y + peakHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  mountain.add(body);
  // snow cap
  const capH = peakHeight * 0.25;
  const capR = baseRadius * 0.3;
  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(capR, capH, 8), materials.snow
  );
  cap.position.y = GROUND_Y + peakHeight - capH * 0.3;
  cap.castShadow = true;
  mountain.add(cap);
  return mountain;
}

function createTree(scale = 1) {
  const tree = new THREE.Group();

  // tapered trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.15 * scale, 1.4 * scale, 8),
    materials.bark
  );
  trunk.position.y = GROUND_Y + 0.7 * scale;
  trunk.castShadow = true;
  tree.add(trunk);

  // canopy: 2–3 overlapping spheres
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const r = (0.5 + Math.random() * 0.25) * scale;
    const ox = (Math.random() - 0.5) * 0.3 * scale;
    const oz = (Math.random() - 0.5) * 0.3 * scale;
    const oy = GROUND_Y + 1.4 * scale + i * 0.25 * scale;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8), materials.foliage
    );
    leaf.position.set(ox, oy, oz);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    tree.add(leaf);
  }

  return tree;
}

export {
  materials, GROUND_Y, getTerrainHeight,
  createWindmill, createMountedKnight, createCastle, createVillage,
  createTree, createHill, createMountain, buildVillager,
};
