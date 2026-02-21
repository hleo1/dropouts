import * as THREE from "three";

const PLANETS = [
  { name: "mercury", orbitR: 4,  radius: 0.4,  color: 0xc0b0a0, speed: 1.6 },
  { name: "venus",   orbitR: 6,  radius: 0.65, color: 0xf0d070, speed: 1.2 },
  { name: "earth",   orbitR: 8,  radius: 0.7,  color: 0x44aaee, speed: 1.0, moon: true },
  { name: "mars",    orbitR: 10, radius: 0.5,  color: 0xff5533, speed: 0.8 },
  { name: "jupiter", orbitR: 14, radius: 1.5,  color: 0xe8b060, speed: 0.4 },
  { name: "saturn",  orbitR: 18, radius: 1.2,  color: 0xeece80, speed: 0.3, ring: true },
  { name: "uranus",  orbitR: 22, radius: 0.85, color: 0x66eedd, speed: 0.2, tilted: true },
  { name: "neptune", orbitR: 26, radius: 0.8,  color: 0x4488ff, speed: 0.15 },
];

const orbitMat = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.12,
  side: THREE.DoubleSide,
});

// --- procedural sun texture ---
function makeSunTexture(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // base gradient
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "#fff8e0");
  grad.addColorStop(0.3, "#ffcc44");
  grad.addColorStop(0.6, "#ff8800");
  grad.addColorStop(1, "#cc4400");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // plasma swirls — overlapping radial splotches
  const swirls = [
    { x: 0.3, y: 0.4, r: 0.25, color: "rgba(255,200,50,0.4)" },
    { x: 0.6, y: 0.3, r: 0.2, color: "rgba(255,150,30,0.5)" },
    { x: 0.5, y: 0.7, r: 0.3, color: "rgba(255,220,80,0.3)" },
    { x: 0.2, y: 0.6, r: 0.15, color: "rgba(255,180,40,0.4)" },
    { x: 0.7, y: 0.6, r: 0.2, color: "rgba(255,100,20,0.3)" },
    { x: 0.4, y: 0.2, r: 0.18, color: "rgba(255,240,120,0.35)" },
  ];
  for (const s of swirls) {
    const g = ctx.createRadialGradient(
      s.x * size, s.y * size, 0,
      s.x * size, s.y * size, s.r * size
    );
    g.addColorStop(0, s.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  // dark sunspot-like patches
  for (let i = 0; i < 12; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const sr = 5 + Math.random() * 20;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    g.addColorStop(0, "rgba(120,50,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  }

  // bright granulation noise
  const imgData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n * 0.7));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n * 0.3));
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

// --- procedural planet textures (512px, high detail) ---

// paint an irregular opaque blob (used for continents, mare, etc.)
function paintBlob(ctx, cx, cy, avgR, color, irregularity) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wobble = 1 + (Math.random() - 0.5) * irregularity;
    const px = cx + Math.cos(a) * avgR * wobble;
    const py = cy + Math.sin(a) * avgR * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function makeEarthTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // deep ocean base
  ctx.fillStyle = "#1a4b8c";
  ctx.fillRect(0, 0, S, S);

  // ocean depth variation
  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 30 + Math.random() * 80;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    const dark = Math.random() > 0.5;
    grad.addColorStop(0, dark ? "rgba(10,35,80,0.5)" : "rgba(30,80,160,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }

  // continents — large opaque green/brown landmasses
  const continents = [
    { x: 0.25, y: 0.35, r: 0.15 },  // Africa-like
    { x: 0.25, y: 0.25, r: 0.1 },   // Europe-like
    { x: 0.55, y: 0.35, r: 0.12 },  // Asia-like (west)
    { x: 0.65, y: 0.3, r: 0.14 },   // Asia-like (east)
    { x: 0.85, y: 0.35, r: 0.08 },  // Americas-like
    { x: 0.9, y: 0.5, r: 0.1 },     // S. America-like
    { x: 0.4, y: 0.75, r: 0.07 },   // Australia-like
  ];
  const landColors = ["#2d6b1e", "#3a7a28", "#4a8832", "#5a7a30", "#6b8a28"];
  for (const cont of continents) {
    const cx = cont.x * S;
    const cy = cont.y * S;
    const cr = cont.r * S;
    // main body
    paintBlob(ctx, cx, cy, cr, landColors[Math.floor(Math.random() * landColors.length)], 0.6);
    // sub-blobs for coastline irregularity
    for (let j = 0; j < 4; j++) {
      const ox = cx + (Math.random() - 0.5) * cr * 1.2;
      const oy = cy + (Math.random() - 0.5) * cr * 1.2;
      const or = cr * (0.2 + Math.random() * 0.4);
      paintBlob(ctx, ox, oy, or, landColors[Math.floor(Math.random() * landColors.length)], 0.7);
    }
  }

  // mountain/highland areas (darker green-brown on continents)
  for (let i = 0; i < 15; i++) {
    const cont = continents[Math.floor(Math.random() * continents.length)];
    const cx = cont.x * S + (Math.random() - 0.5) * cont.r * S;
    const cy = cont.y * S + (Math.random() - 0.5) * cont.r * S;
    const cr = 8 + Math.random() * 20;
    paintBlob(ctx, cx, cy, cr, "rgba(60,80,30,0.8)", 0.5);
  }

  // deserts (sandy patches on land)
  const desertSpots = [
    { x: 0.22, y: 0.38, r: 0.04 },  // Sahara-like
    { x: 0.55, y: 0.38, r: 0.05 },  // Central Asia-like
    { x: 0.4, y: 0.73, r: 0.03 },   // Australian outback
  ];
  for (const d of desertSpots) {
    paintBlob(ctx, d.x * S, d.y * S, d.r * S, "#c4a855", 0.5);
    paintBlob(ctx, d.x * S + 5, d.y * S + 3, d.r * S * 0.7, "#d4b865", 0.4);
  }

  // ice caps — thick white bands at poles
  const capGrad1 = ctx.createLinearGradient(0, 0, 0, S * 0.1);
  capGrad1.addColorStop(0, "rgba(240,248,255,0.95)");
  capGrad1.addColorStop(1, "rgba(240,248,255,0)");
  ctx.fillStyle = capGrad1;
  ctx.fillRect(0, 0, S, S * 0.1);

  const capGrad2 = ctx.createLinearGradient(0, S * 0.9, 0, S);
  capGrad2.addColorStop(0, "rgba(240,248,255,0)");
  capGrad2.addColorStop(1, "rgba(240,248,255,0.95)");
  ctx.fillStyle = capGrad2;
  ctx.fillRect(0, S * 0.9, S, S * 0.1);

  // cloud bands
  for (let i = 0; i < 20; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cw = 30 + Math.random() * 80;
    const ch = 4 + Math.random() * 10;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, (Math.random() - 0.5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // per-pixel noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeMarsTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // rusty orange base
  ctx.fillStyle = "#c45a28";
  ctx.fillRect(0, 0, S, S);

  // color variation — lighter and darker rust patches
  for (let i = 0; i < 30; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 20 + Math.random() * 60;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    const colors = ["rgba(180,70,30,0.5)", "rgba(200,100,50,0.4)", "rgba(150,55,20,0.5)", "rgba(220,130,70,0.3)"];
    grad.addColorStop(0, colors[Math.floor(Math.random() * colors.length)]);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }

  // dark basalt regions (like Syrtis Major)
  const darkRegions = [
    { x: 0.3, y: 0.45, r: 0.1 },
    { x: 0.6, y: 0.4, r: 0.08 },
    { x: 0.8, y: 0.5, r: 0.06 },
    { x: 0.15, y: 0.55, r: 0.07 },
  ];
  for (const d of darkRegions) {
    paintBlob(ctx, d.x * S, d.y * S, d.r * S, "rgba(80,40,20,0.7)", 0.6);
  }

  // Valles Marineris-like canyon streak
  ctx.strokeStyle = "rgba(70,30,15,0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(S * 0.2, S * 0.48);
  ctx.quadraticCurveTo(S * 0.4, S * 0.46, S * 0.6, S * 0.5);
  ctx.stroke();

  // polar ice caps
  const capGrad1 = ctx.createLinearGradient(0, 0, 0, S * 0.08);
  capGrad1.addColorStop(0, "rgba(240,240,250,0.9)");
  capGrad1.addColorStop(1, "rgba(240,240,250,0)");
  ctx.fillStyle = capGrad1;
  ctx.fillRect(0, 0, S, S * 0.08);

  const capGrad2 = ctx.createLinearGradient(0, S * 0.92, 0, S);
  capGrad2.addColorStop(0, "rgba(240,240,250,0)");
  capGrad2.addColorStop(1, "rgba(240,240,250,0.7)");
  ctx.fillStyle = capGrad2;
  ctx.fillRect(0, S * 0.92, S, S * 0.08);

  // craters
  for (let i = 0; i < 50; i++) {
    const cx = Math.random() * S;
    const cy = S * 0.1 + Math.random() * S * 0.8;
    const cr = 2 + Math.random() * 8;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(90,40,15,0.5)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 1, cy - 1, cr * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(210,120,60,0.3)";
    ctx.fill();
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n * 0.6));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n * 0.3));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeJupiterTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // warm tan base
  ctx.fillStyle = "#c49450";
  ctx.fillRect(0, 0, S, S);

  // distinct horizontal bands with varying colors
  const bandColors = [
    "#d4a860", "#b07830", "#e0c080", "#a06820",
    "#c89850", "#90582a", "#ddb870", "#b88840",
    "#c0a060", "#a87838", "#e8c888", "#b08030",
  ];
  let y = 0;
  for (let i = 0; y < S; i++) {
    const bh = 8 + Math.random() * 30;
    ctx.fillStyle = bandColors[i % bandColors.length];
    ctx.fillRect(0, y, S, bh);
    // wavy edge between bands
    ctx.beginPath();
    for (let x = 0; x < S; x += 4) {
      const wy = y + bh + Math.sin(x * 0.05 + i) * 4;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.lineTo(S, y);
    ctx.lineTo(0, y);
    ctx.closePath();
    ctx.fillStyle = bandColors[(i + 1) % bandColors.length];
    ctx.fill();
    y += bh;
  }

  // Great Red Spot
  const grsX = S * 0.65;
  const grsY = S * 0.58;
  const grsW = S * 0.08;
  const grsH = S * 0.05;
  const grsGrad = ctx.createRadialGradient(grsX, grsY, 0, grsX, grsY, grsW);
  grsGrad.addColorStop(0, "#cc4422");
  grsGrad.addColorStop(0.5, "#bb5533");
  grsGrad.addColorStop(1, "rgba(180,100,60,0)");
  ctx.fillStyle = grsGrad;
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, grsW, grsH, 0, 0, Math.PI * 2);
  ctx.fill();

  // smaller storm ovals
  for (let i = 0; i < 5; i++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const sw = 6 + Math.random() * 15;
    const sh = 4 + Math.random() * 8;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sw);
    grad.addColorStop(0, "rgba(240,210,160,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n * 0.5));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeSaturnTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // pale gold base
  ctx.fillStyle = "#d4b878";
  ctx.fillRect(0, 0, S, S);

  // soft horizontal bands — more muted than Jupiter
  const bandColors = [
    "#dcc888", "#c4a858", "#e0d098", "#b89848",
    "#d0be78", "#c8b068", "#e4d4a0", "#bca058",
  ];
  let y = 0;
  for (let i = 0; y < S; i++) {
    const bh = 10 + Math.random() * 35;
    ctx.fillStyle = bandColors[i % bandColors.length];
    ctx.fillRect(0, y, S, bh);
    y += bh;
  }

  // subtle storm spots
  for (let i = 0; i < 3; i++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const sr = 10 + Math.random() * 20;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, "rgba(220,200,150,0.5)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, sr, sr * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeMercuryTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // grey base
  ctx.fillStyle = "#9a9088";
  ctx.fillRect(0, 0, S, S);

  // dark mare regions
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 20 + Math.random() * 50;
    paintBlob(ctx, cx, cy, cr, "rgba(70,65,60,0.5)", 0.5);
  }

  // bright highland regions
  for (let i = 0; i < 6; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 15 + Math.random() * 40;
    paintBlob(ctx, cx, cy, cr, "rgba(180,170,160,0.4)", 0.4);
  }

  // heavy cratering
  for (let i = 0; i < 80; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 2 + Math.random() * 15;
    // dark rim
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60,55,50,${0.3 + Math.random() * 0.3})`;
    ctx.fill();
    // bright floor
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, cr * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(160,150,140,${0.2 + Math.random() * 0.2})`;
    ctx.fill();
  }

  // bright ray craters
  for (let i = 0; i < 3; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    for (let r = 0; r < 6; r++) {
      const angle = Math.random() * Math.PI * 2;
      const len = 15 + Math.random() * 30;
      ctx.strokeStyle = "rgba(200,195,185,0.3)";
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.stroke();
    }
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeVenusTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // yellowish cloud base
  ctx.fillStyle = "#d4b868";
  ctx.fillRect(0, 0, S, S);

  // thick cloud layers — horizontal banding
  for (let y = 0; y < S; y += 5 + Math.random() * 15) {
    const bh = 4 + Math.random() * 12;
    const shade = (Math.random() - 0.5) * 40;
    ctx.fillStyle = `rgb(${200 + shade},${170 + shade * 0.7},${90 + shade * 0.4})`;
    ctx.fillRect(0, y, S, bh);
  }

  // vortex swirls
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 20 + Math.random() * 50;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    grad.addColorStop(0, "rgba(230,200,120,0.4)");
    grad.addColorStop(0.5, "rgba(200,170,80,0.2)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }

  // darker cloud patches
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 15 + Math.random() * 35;
    paintBlob(ctx, cx, cy, cr, "rgba(160,130,60,0.3)", 0.4);
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeUranusTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // pale cyan-green base
  ctx.fillStyle = "#5cc8b8";
  ctx.fillRect(0, 0, S, S);

  // very subtle banding
  for (let y = 0; y < S; y += 15 + Math.random() * 25) {
    const bh = 8 + Math.random() * 18;
    const shade = (Math.random() - 0.5) * 20;
    ctx.fillStyle = `rgba(${90 + shade},${200 + shade},${190 + shade},0.3)`;
    ctx.fillRect(0, y, S, bh);
  }

  // faint cloud patches
  for (let i = 0; i < 6; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 20 + Math.random() * 40;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    grad.addColorStop(0, "rgba(140,230,220,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
  }

  // pole darkening
  const poleGrad1 = ctx.createLinearGradient(0, 0, 0, S * 0.15);
  poleGrad1.addColorStop(0, "rgba(40,100,100,0.4)");
  poleGrad1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = poleGrad1;
  ctx.fillRect(0, 0, S, S * 0.15);

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeNeptuneTexture(S) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");

  // deep blue base
  ctx.fillStyle = "#2244aa";
  ctx.fillRect(0, 0, S, S);

  // blue variation bands
  const bandBlues = ["#1a3890", "#2850b0", "#1e3c98", "#3060c0", "#1a3088"];
  let y = 0;
  for (let i = 0; y < S; i++) {
    const bh = 12 + Math.random() * 30;
    ctx.fillStyle = bandBlues[i % bandBlues.length];
    ctx.fillRect(0, y, S, bh);
    y += bh;
  }

  // Great Dark Spot
  const gdsX = S * 0.4;
  const gdsY = S * 0.45;
  const gdsGrad = ctx.createRadialGradient(gdsX, gdsY, 0, gdsX, gdsY, S * 0.06);
  gdsGrad.addColorStop(0, "#0a1855");
  gdsGrad.addColorStop(0.7, "#152880");
  gdsGrad.addColorStop(1, "rgba(25,50,130,0)");
  ctx.fillStyle = gdsGrad;
  ctx.beginPath();
  ctx.ellipse(gdsX, gdsY, S * 0.07, S * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // bright cloud streaks
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cw = 20 + Math.random() * 50;
    ctx.fillStyle = "rgba(180,200,255,0.2)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, 3 + Math.random() * 5, (Math.random() - 0.5) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

function makeRockyTexture(S, baseColor) {
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  const c = new THREE.Color(baseColor);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, S, S);

  // color variation patches
  for (let i = 0; i < 15; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 20 + Math.random() * 50;
    const shift = (Math.random() - 0.5) * 50;
    paintBlob(ctx, cx, cy, cr, `rgba(${Math.max(0, r + shift)},${Math.max(0, g + shift)},${Math.max(0, b + shift)},0.4)`, 0.5);
  }

  // craters
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const cr = 2 + Math.random() * 12;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)},0.5)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, cr * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.min(255, r + 25)},${Math.min(255, g + 25)},${Math.min(255, b + 25)},0.3)`;
    ctx.fill();
  }

  // noise
  const imgData = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
    imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

const TEXTURE_MAKERS = {
  mercury: (S) => makeMercuryTexture(S),
  venus: (S) => makeVenusTexture(S),
  earth: (S) => makeEarthTexture(S),
  mars: (S) => makeMarsTexture(S),
  jupiter: (S) => makeJupiterTexture(S),
  saturn: (S) => makeSaturnTexture(S),
  uranus: (S) => makeUranusTexture(S),
  neptune: (S) => makeNeptuneTexture(S),
};

function makePlanetTexture(size, baseColor, name) {
  const maker = TEXTURE_MAKERS[name];
  if (maker) return maker(size);
  return makeRockyTexture(size, baseColor);
}

const BUMP_SCALE_MAP = {
  mercury: 0.6,
  venus: 0.15,
  earth: 0.35,
  mars: 0.5,
  jupiter: 0.12,
  saturn: 0.1,
  uranus: 0.08,
  neptune: 0.1,
};

function createSun() {
  const group = new THREE.Group();

  // main sun sphere with texture
  const sunTex = makeSunTexture(512);
  const sunMat = new THREE.MeshStandardMaterial({
    map: sunTex,
    emissiveMap: sunTex,
    emissive: 0xffaa33,
    emissiveIntensity: 1.5,
    roughness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(2, 48, 48), sunMat);
  group.add(body);

  // corona glow — layered additive sprites, no geometry shells
  const coronaCanvas = document.createElement("canvas");
  coronaCanvas.width = 256;
  coronaCanvas.height = 256;
  const cCtx = coronaCanvas.getContext("2d");
  const coronaGrad = cCtx.createRadialGradient(128, 128, 20, 128, 128, 128);
  coronaGrad.addColorStop(0, "rgba(255,220,100,0.8)");
  coronaGrad.addColorStop(0.15, "rgba(255,180,60,0.5)");
  coronaGrad.addColorStop(0.4, "rgba(255,120,30,0.15)");
  coronaGrad.addColorStop(0.7, "rgba(255,80,10,0.04)");
  coronaGrad.addColorStop(1, "rgba(0,0,0,0)");
  cCtx.fillStyle = coronaGrad;
  cCtx.fillRect(0, 0, 256, 256);
  const coronaTex = new THREE.CanvasTexture(coronaCanvas);

  // inner glow sprite
  const innerMat = new THREE.SpriteMaterial({
    map: coronaTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const innerGlow = new THREE.Sprite(innerMat);
  innerGlow.scale.set(8, 8, 1);
  innerGlow.raycast = () => {};
  group.add(innerGlow);

  // outer glow sprite
  const outerMat = new THREE.SpriteMaterial({
    map: coronaTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.4,
  });
  const outerGlow = new THREE.Sprite(outerMat);
  outerGlow.scale.set(14, 14, 1);
  outerGlow.raycast = () => {};
  group.add(outerGlow);

  return group;
}

// generate a grayscale bump map from a color texture canvas
function makeBumpTexture(colorTex) {
  const src = colorTex.image;
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const lum = imgData.data[i] * 0.3 + imgData.data[i + 1] * 0.59 + imgData.data[i + 2] * 0.11;
    imgData.data[i] = lum;
    imgData.data[i + 1] = lum;
    imgData.data[i + 2] = lum;
  }
  ctx.putImageData(imgData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function makeGlowSprite(color, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const c = new THREE.Color(color);
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.45)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(0.7, `rgba(${r},${g},${b},0.02)`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  sprite.raycast = () => {};
  return sprite;
}

// rim-light colors per planet (Fresnel-like atmosphere edge glow)
const RIM_COLORS = {
  mercury: 0x888888,
  venus: 0xddbb66,
  earth: 0x88ccff,
  mars: 0xcc6644,
  jupiter: 0xddaa55,
  saturn: 0xccbb77,
  uranus: 0x66ddcc,
  neptune: 0x5588dd,
};

function createPlanet(name, radius, color, options = {}) {
  const group = new THREE.Group();

  const colorTex = makePlanetTexture(512, color, name);
  const bumpTex = makeBumpTexture(colorTex);
  const bumpScale = BUMP_SCALE_MAP[name] || 0.3;

  const mat = new THREE.MeshStandardMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: bumpScale,
    roughness: 0.6,
    metalness: 0.0,
    emissive: color,
    emissiveIntensity: 0.2,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // subtle glow sprite
  const glow = makeGlowSprite(color, radius * 3.5);
  group.add(glow);

  // rim-light shell — Fresnel-like edge glow for 3D volume on all planets
  const rimColor = RIM_COLORS[name] || color;
  const rimMat = new THREE.MeshBasicMaterial({
    color: rimColor,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const rimShell = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 32, 32), rimMat);
  rimShell.raycast = () => {};
  group.add(rimShell);

  if (options.ring) {
    const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 2.2, 64);
    // procedural ring texture — concentric bands
    const ringCanvas = document.createElement("canvas");
    ringCanvas.width = 256;
    ringCanvas.height = 16;
    const rCtx = ringCanvas.getContext("2d");
    for (let x = 0; x < 256; x++) {
      const t = x / 256;
      const brightness = 150 + Math.sin(t * 30) * 40 + Math.random() * 20;
      rCtx.fillStyle = `rgb(${brightness},${brightness * 0.85},${brightness * 0.6})`;
      rCtx.fillRect(x, 0, 1, 16);
    }
    const ringTex = new THREE.CanvasTexture(ringCanvas);
    const ringMat = new THREE.MeshStandardMaterial({
      map: ringTex,
      roughness: 0.6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      emissive: 0xc8a060,
      emissiveIntensity: 0.15,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    group.add(ring);
  }

  if (options.tilted) {
    group.rotation.z = THREE.MathUtils.degToRad(30);
  }

  if (options.moon) {
    const moonTex = makeRockyTexture(128, 0xbbbbbb);
    const moonBump = makeBumpTexture(moonTex);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTex,
      bumpMap: moonBump,
      bumpScale: 0.5,
      roughness: 0.9,
      emissive: 0x888888,
      emissiveIntensity: 0.15,
    });
    const moon = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.27, 24, 24), moonMat);
    moon.castShadow = true;
    moon.position.set(radius * 2.5, 0, 0);
    group.add(moon);
    group.userData.moon = moon;
  }

  return group;
}

function createOrbitRing(orbitRadius) {
  const geo = new THREE.RingGeometry(orbitRadius - 0.03, orbitRadius + 0.03, 128);
  const mesh = new THREE.Mesh(geo, orbitMat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function createStarfield() {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 20;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    // slight color variation — warm whites, cool blues
    const tint = Math.random();
    if (tint < 0.1) {
      colors[i * 3] = 0.7 + Math.random() * 0.3;
      colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i * 3 + 2] = 1.0;
    } else if (tint < 0.2) {
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85 + Math.random() * 0.15;
      colors[i * 3 + 2] = 0.7 + Math.random() * 0.2;
    } else {
      const w = 0.8 + Math.random() * 0.2;
      colors[i * 3] = w;
      colors[i * 3 + 1] = w;
      colors[i * 3 + 2] = w;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

export { PLANETS, createSun, createPlanet, createOrbitRing, createStarfield };
