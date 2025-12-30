import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js";

/**********************************************************************
 * FPS SHOOTER (Standalone Entry Script)
 * - Separate from Playground (its own scene/camera/renderer)
 * - Pointer Lock + Mouse Look
 * - WASD move, Shift sprint, Space jump
 * - Hitscan raycast shooting
 * - Simple rigid-body impulses on hit boxes
 **********************************************************************/

let scene, camera, renderer;
let clock;

let isPointerLocked = false;

// -------- FX / AUDIO --------
const muzzleFX = [];   // { mesh, life }
const hitFX = [];      // { mesh, life }

let audioCtx = null;
let masterGain = null;


// look
let yaw = 0;
let pitch = 0;
const mouseSensitivity = 0.0022;

// movement
const keys = { w:false, a:false, s:false, d:false, shift:false, space:false };
let playerVelY = 0;
let onGround = true;

const walkSpeed = 6.0;
const sprintSpeed = 10.0;
const jumpVel = 6.5;
const gravity = -14.0;   // feels more “game-like” than -9.8
const eyeHeight = 1.7;

// world
const bulletsFX = [];   // simple tracers { line, life }

// raycast
const shootRaycaster = new THREE.Raycaster();
const tmpDir = new THREE.Vector3();

// UI
let crosshairEl, hudEl;

// ammo / fire rate
let ammo = 999;
let lastShotTime = 0;
const fireRate = 10; // shots per second
const maxDistance = 80;

let hp = 100;
const maxHP = 100;
let score = 0;

let healthOuter, healthInner, scoreEl;

// --- Incoming threats ---
// --- Threats ONLY ---
const threats = []; // { mesh, vel, radius, hp, scoreValue, alive }
const debris = [];  // { mesh, vel, radius, life }

// Spawn settings
let threatSpawnTimer = 0;
const threatSpawnEvery = 0.75;     // seconds (avg)
const threatSpawnJitter = 0.35;    // randomness
const threatMinDist = 18;
const threatMaxDist = 32;
const threatSpeedMin = 10;
const threatSpeedMax = 18;

// Spawn cone (in front of player)
const spawnConeHalfAngleDeg = 22; // tighter = more “in front”


// player hitbox
const playerRadius = 0.55;     // "capsule-ish" simplified as sphere
const playerCenterOffsetY = 1.0; // where player "body" center is (below eye)

// damage effect
let damageOverlayEl = null;
let damageOverlayT = 0;        // 0..1 fade
let shakeT = 0;
let shakeStrength = 0;

let kills = 0;

let isDead = false;
let deathScreenEl = null;
let deathTitleEl = null;
let deathStatsEl = null;
let respawnBtnEl = null;

// optional visual “death” filter intensity
let deathFade = 0; // 0..1



// init & run
init();
animate();

/**********************************************************************
 * INIT
 **********************************************************************/
function init() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070a);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, eyeHeight, 8);
  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  document.body.appendChild(renderer.domElement);

// --- Better lights ---
  scene.fog = new THREE.Fog(0x07070a, 30, 140);

  const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x140f18, 0.65);
  scene.add(hemi);

  // Key light
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(18, 24, 10);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 120;
  key.shadow.camera.left = -40;
  key.shadow.camera.right = 40;
  key.shadow.camera.top = 40;
  key.shadow.camera.bottom = -40;
  scene.add(key);

  // Fill light
  const fill = new THREE.DirectionalLight(0x88aaff, 0.45);
  fill.position.set(-16, 10, 18);
  scene.add(fill);

  // Rim light
  const rim = new THREE.DirectionalLight(0xff88aa, 0.25);
  rim.position.set(0, 12, -22);
  scene.add(rim);

  // floor
  const floorGeo = new THREE.PlaneGeometry(120, 120);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.95, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);



  // UI
  createUI();

  // input
  renderer.domElement.addEventListener("click", onClickCanvas);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);
}

/**********************************************************************
 * WORLD HELPERS
 **********************************************************************/

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.25; // master volume
  masterGain.connect(audioCtx.destination);
}

function playShootSound() {
  ensureAudio();
  const now = audioCtx.currentTime;

  // "thump" (low)
  const osc1 = audioCtx.createOscillator();
  const g1 = audioCtx.createGain();
  osc1.type = "triangle";
  osc1.frequency.setValueAtTime(180, now);
  osc1.frequency.exponentialRampToValueAtTime(90, now + 0.07);
  g1.gain.setValueAtTime(0.10, now);
  g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  osc1.connect(g1).connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.09);

  // "click" (high)
  const osc2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  osc2.type = "square";
  osc2.frequency.setValueAtTime(1200, now);
  osc2.frequency.exponentialRampToValueAtTime(600, now + 0.03);
  g2.gain.setValueAtTime(0.03, now);
  g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  osc2.connect(g2).connect(masterGain);
  osc2.start(now);
  osc2.stop(now + 0.05);

  // tiny noise burst (air)
  const bufferSize = 0.08 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = audioCtx.createBufferSource();
  const ng = audioCtx.createGain();
  noise.buffer = buffer;
  ng.gain.setValueAtTime(0.03, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  noise.connect(ng).connect(masterGain);
  noise.start(now);
}

function spawnMuzzleFlash() {
  // small cone-ish flash in front of camera
  const geo = new THREE.ConeGeometry(0.05, 0.18, 10);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, transparent: true, opacity: 0.9 });
  const m = new THREE.Mesh(geo, mat);

  m.position.copy(camera.position);
  const dir = getForwardDir();
  m.position.add(dir.clone().multiplyScalar(0.35));

  // orient cone forward
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  scene.add(m);
  muzzleFX.push({ mesh: m, life: 0.05 });
}

function spawnHitSpark(pos, normal) {
  // small burst sphere
  const geo = new THREE.SphereGeometry(0.06, 10, 10);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 });
  const s = new THREE.Mesh(geo, mat);

  s.position.copy(pos);
  if (normal) s.position.add(normal.clone().multiplyScalar(0.03));

  scene.add(s);
  hitFX.push({ mesh: s, life: 0.12 });
}

function updateSmallFX(dt) {
  for (let i = muzzleFX.length - 1; i >= 0; i--) {
    const fx = muzzleFX[i];
    fx.life -= dt;
    if (fx.mesh?.material) fx.mesh.material.opacity = Math.max(0, fx.life / 0.05);
    if (fx.life <= 0) {
      scene.remove(fx.mesh);
      muzzleFX.splice(i, 1);
    }
  }

  for (let i = hitFX.length - 1; i >= 0; i--) {
    const fx = hitFX[i];
    fx.life -= dt;
    if (fx.mesh?.material) fx.mesh.material.opacity = Math.max(0, fx.life / 0.12);
    fx.mesh.scale.multiplyScalar(1 + dt * 6);
    if (fx.life <= 0) {
      scene.remove(fx.mesh);
      hitFX.splice(i, 1);
    }
  }
}



function setThreatRefRecursive(obj, threatRef) {
  obj.userData.threatRef = threatRef;
  if (obj.children && obj.children.length) {
    for (const c of obj.children) setThreatRefRecursive(c, threatRef);
  }
}

function randBetween(a, b) { return a + Math.random() * (b - a); }

function getForwardDir() {
  const f = new THREE.Vector3();
  camera.getWorldDirection(f);
  f.normalize();
  return f;
}

// Random direction inside a cone around `forward`
function randomDirInCone(forward, halfAngleDeg) {
  const halfAngle = THREE.MathUtils.degToRad(halfAngleDeg);

  // Build an orthonormal basis around forward
  const up = new THREE.Vector3(0, 1, 0);
  let right = new THREE.Vector3().crossVectors(forward, up);
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
  right.normalize();
  const realUp = new THREE.Vector3().crossVectors(right, forward).normalize();

  // Sample a small angle within the cone
  const u = Math.random();
  const v = Math.random();

  // Uniform-ish within cone solid angle:
  const cosTheta = 1 - u * (1 - Math.cos(halfAngle));
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
  const phi = 2 * Math.PI * v;

  const dir = new THREE.Vector3()
    .addScaledVector(forward, cosTheta)
    .addScaledVector(right, sinTheta * Math.cos(phi))
    .addScaledVector(realUp, sinTheta * Math.sin(phi))
    .normalize();

  return dir;
}

function spawnThreatInFront() {
  const forward = getForwardDir();
  const dirInCone = randomDirInCone(forward, spawnConeHalfAngleDeg);

  const dist = randBetween(threatMinDist, threatMaxDist);

  const spawnPos = camera.position.clone().add(dirInCone.clone().multiplyScalar(dist));
  let root = null;
  spawnPos.y = randBetween(0.9, 4.5);

// --- ROCKET ONLY (variants) ---
const g = new THREE.Group();

// --- Variant selection ---
const variant = Math.random();
let bodyColor = 0xd8d8d8;
let noseColor = 0xff4b4b;
let speedMul = 1.0;

// Fast red rocket
if (variant < 0.33) {
  bodyColor = 0xff5555;
  noseColor = 0xffffff;
  speedMul = 1.35;
}
// Medium yellow rocket
else if (variant < 0.66) {
  bodyColor = 0xffc94a;
  noseColor = 0xff8844;
  speedMul = 1.0;
}
// Slow heavy blue rocket
else {
  bodyColor = 0x4aa3ff;
  noseColor = 0x224466;
  speedMul = 0.75;
}

// --- Geometry ---
const bodyR = randBetween(0.18, 0.28);
const bodyH = randBetween(1.2, 1.8);
const approxRadius = bodyH * 0.55;

const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR, bodyH, 14, 1);
const bodyMat = new THREE.MeshStandardMaterial({
  color: bodyColor,
  roughness: 0.45,
  metalness: 0.6
});
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.castShadow = true;
g.add(body);

const noseGeo = new THREE.ConeGeometry(bodyR * 1.05, bodyR * 2.2, 14);
const noseMat = new THREE.MeshStandardMaterial({
  color: noseColor,
  roughness: 0.35,
  metalness: 0.5
});
const nose = new THREE.Mesh(noseGeo, noseMat);
nose.position.y = bodyH * 0.5 + (bodyR * 1.1);
nose.castShadow = true;
g.add(nose);

// fins
const finGeo = new THREE.BoxGeometry(bodyR * 0.2, bodyR * 0.9, bodyR * 1.2);
const finMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  roughness: 0.7,
  metalness: 0.4
});
for (let k = 0; k < 4; k++) {
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.castShadow = true;
  fin.position.y = -bodyH * 0.35;
  fin.rotation.y = (k * Math.PI) / 2;
  fin.position.x = Math.cos(fin.rotation.y) * bodyR * 1.1;
  fin.position.z = Math.sin(fin.rotation.y) * bodyR * 1.1;
  g.add(fin);
}

g.position.copy(spawnPos);
root = g;


  // random spin to feel alive
  root.rotation.y = Math.random() * Math.PI * 2;

  scene.add(root);

  // velocity aimed toward player
  const aimAt = camera.position.clone();
  aimAt.y = camera.position.y - 0.35;

  const velDir = aimAt.sub(spawnPos).normalize();
  const speed = randBetween(threatSpeedMin, threatSpeedMax) * speedMul;


const threat = {
  mesh: root,
  vel: velDir.multiplyScalar(speed),
  radius: approxRadius,
  hp: Math.round(randBetween(45, 80)),
  scoreValue: 100,
  alive: true
};


if (root.isGroup && threat.vel.lengthSq() > 1e-6) {
  const dir = threat.vel.clone().normalize();
  root.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), // rocket built pointing UP (Y)
    dir
  );
}


  // IMPORTANT: raycast hits children for rockets/crates -> tag every child with ref
  setThreatRefRecursive(root, threat);

  threats.push(threat);
}


function getPlayerCenter() {
  // your camera is at eyeHeight; body center slightly lower
  return new THREE.Vector3(camera.position.x, camera.position.y - (eyeHeight - playerCenterOffsetY), camera.position.z);
}

function updateThreats(dt) {

    if (isDead) return;

  // spawn loop
  threatSpawnTimer -= dt;
  if (isPointerLocked && threatSpawnTimer <= 0) 
 {
    threatSpawnTimer = threatSpawnEvery + randBetween(-threatSpawnJitter, threatSpawnJitter);
    spawnThreatInFront();
  }

  const playerCenter = getPlayerCenter();

  for (let i = threats.length - 1; i >= 0; i--) {
    const t = threats[i];
    if (!t.alive) continue;

    t.mesh.position.addScaledVector(t.vel, dt);

    // 🔁 Keep rockets facing their current velocity
        if (t.mesh.isGroup && t.vel.lengthSq() > 1e-6) {
        const dir = t.vel.clone().normalize();
        t.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir
        );
        }


    // cleanup if too far away (prevents infinite accumulation)
        if (t.mesh.position.distanceToSquared(camera.position) > (140 * 140)) {
        removeThreat(i);
        continue;
        }


    // slight drag
    t.vel.multiplyScalar(0.999);

    // player collision (sphere vs sphere)
    const r = t.radius + playerRadius;
    if (t.mesh.position.distanceToSquared(playerCenter) <= r * r) {
      takeDamage(18);              // tune damage
      triggerDamageFX(0.6);        // stronger flash
      shatterThreat(t, getForwardDir());
      removeThreat(i);
      continue;
    }

        // cleanup once it goes behind the player
        const toThreat = t.mesh.position.clone().sub(camera.position);
        const forward = getForwardDir();
        if (toThreat.dot(forward) < 0) {
        removeThreat(i);
        continue;
        }

  }
}

function removeThreat(index) {
  const t = threats[index];
  if (t?.mesh) scene.remove(t.mesh);
  threats.splice(index, 1);
}

function addTracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0.85 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  bulletsFX.push({ line, life: 0.05 }); // slightly shorter life = snappier
}



/**********************************************************************
 * UI
 **********************************************************************/
function createUI() {
  // Crosshair
  crosshairEl = document.createElement("div");
  crosshairEl.style.position = "fixed";
  crosshairEl.style.left = "50%";
  crosshairEl.style.top = "50%";
  crosshairEl.style.width = "10px";
  crosshairEl.style.height = "10px";
  crosshairEl.style.transform = "translate(-50%, -50%)";
  crosshairEl.style.border = "1px solid rgba(255,255,255,0.7)";
  crosshairEl.style.borderRadius = "50%";
  crosshairEl.style.zIndex = "9997";
  crosshairEl.style.pointerEvents = "none";
  document.body.appendChild(crosshairEl);

  // Top-left HUD container
  const hud = document.createElement("div");
  hud.style.position = "fixed";
  hud.style.top = "12px";
  hud.style.left = "12px";
  hud.style.zIndex = "9997";
  hud.style.display = "grid";
  hud.style.gap = "8px";
  hud.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  hud.style.color = "#fff";
  hud.style.userSelect = "none";
  document.body.appendChild(hud);

  hudEl = document.createElement("div");
  hudEl.style.position = "fixed";
  hudEl.style.bottom = "14px";
  hudEl.style.left = "14px";
  hudEl.style.padding = "10px 12px";
  hudEl.style.background = "rgba(0,0,0,0.55)";
  hudEl.style.border = "1px solid rgba(255,255,255,0.12)";
  hudEl.style.borderRadius = "10px";
  hudEl.style.color = "#fff";
  hudEl.style.fontSize = "12px";
  hudEl.style.zIndex = "9997";
  hudEl.style.userSelect = "none";
  document.body.appendChild(hudEl);

  updateHUD();


  // Score
  scoreEl = document.createElement("div");
  scoreEl.style.padding = "8px 10px";
  scoreEl.style.background = "rgba(0,0,0,0.55)";
  scoreEl.style.border = "1px solid rgba(255,255,255,0.12)";
  scoreEl.style.borderRadius = "10px";
  scoreEl.style.fontSize = "13px";
  scoreEl.textContent = `Score: ${score}`;
  hud.appendChild(scoreEl);

  // Health bar
  healthOuter = document.createElement("div");
  healthOuter.style.width = "220px";
  healthOuter.style.height = "14px";
  healthOuter.style.background = "rgba(0,0,0,0.55)";
  healthOuter.style.border = "1px solid rgba(255,255,255,0.18)";
  healthOuter.style.borderRadius = "10px";
  healthOuter.style.padding = "3px";
  hud.appendChild(healthOuter);

  healthInner = document.createElement("div");
  healthInner.style.height = "100%";
  healthInner.style.width = "100%";
  healthInner.style.borderRadius = "8px";
  healthInner.style.background = "rgba(255,80,80,0.85)";
  healthOuter.appendChild(healthInner);

  refreshHealthUI();

    // Damage overlay (red flash)
  damageOverlayEl = document.createElement("div");
  damageOverlayEl.style.position = "fixed";
  damageOverlayEl.style.inset = "0";
  damageOverlayEl.style.background = "rgba(255,0,0,0.0)";
  damageOverlayEl.style.pointerEvents = "none";
  damageOverlayEl.style.zIndex = "9996";
  damageOverlayEl.style.transition = "none";
  document.body.appendChild(damageOverlayEl);

    const killsEl = document.createElement("div");
  killsEl.id = "killsEl";
  killsEl.style.padding = "8px 10px";
  killsEl.style.background = "rgba(0,0,0,0.55)";
  killsEl.style.border = "1px solid rgba(255,255,255,0.12)";
  killsEl.style.borderRadius = "10px";
  killsEl.style.fontSize = "13px";
  killsEl.textContent = `Kills: ${kills}`;
  hud.appendChild(killsEl);


    // --- Death screen overlay ---
  deathScreenEl = document.createElement("div");
  deathScreenEl.style.position = "fixed";
  deathScreenEl.style.inset = "0";
  deathScreenEl.style.display = "none";
  deathScreenEl.style.alignItems = "center";
  deathScreenEl.style.justifyContent = "center";
  deathScreenEl.style.background = "rgba(0,0,0,0.75)";
  deathScreenEl.style.zIndex = "10000";
  deathScreenEl.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  deathScreenEl.style.color = "#fff";
  document.body.appendChild(deathScreenEl);

  const panel = document.createElement("div");
  panel.style.width = "min(520px, 92vw)";
  panel.style.padding = "18px 18px";
  panel.style.borderRadius = "16px";
  panel.style.background = "rgba(10,10,14,0.85)";
  panel.style.border = "1px solid rgba(255,255,255,0.14)";
  panel.style.boxShadow = "0 18px 60px rgba(0,0,0,0.55)";
  panel.style.textAlign = "center";
  deathScreenEl.appendChild(panel);

  deathTitleEl = document.createElement("div");
  deathTitleEl.style.fontSize = "26px";
  deathTitleEl.style.fontWeight = "800";
  deathTitleEl.style.marginBottom = "10px";
  deathTitleEl.textContent = "You Died";
  panel.appendChild(deathTitleEl);

  deathStatsEl = document.createElement("div");
  deathStatsEl.style.fontSize = "14px";
  deathStatsEl.style.opacity = "0.9";
  deathStatsEl.style.marginBottom = "14px";
  panel.appendChild(deathStatsEl);

  respawnBtnEl = document.createElement("button");
  respawnBtnEl.textContent = "Respawn";
  respawnBtnEl.style.cursor = "pointer";
  respawnBtnEl.style.border = "0";
  respawnBtnEl.style.padding = "10px 14px";
  respawnBtnEl.style.borderRadius = "12px";
  respawnBtnEl.style.fontSize = "14px";
  respawnBtnEl.style.fontWeight = "700";
  respawnBtnEl.style.background = "rgba(255,80,80,0.9)";
  respawnBtnEl.style.color = "#111";
  respawnBtnEl.onclick = () => {
    resetGame();
    // re-lock pointer on click if you want:
    renderer.domElement.requestPointerLock();
  };
  panel.appendChild(respawnBtnEl);


}

function shatterThreat(threat, shotDir) {
  const center = threat.mesh.position.clone();
  const baseRadius = Math.max(0.25, threat.radius);

  const chunkCount = Math.round(10 + baseRadius * 16);

  for (let i = 0; i < chunkCount; i++) {
    const r = randBetween(0.06, 0.14);
    const geo = new THREE.SphereGeometry(r, 10, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff8a8a, roughness: 0.85 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;

    m.position.copy(center).add(new THREE.Vector3(
      randBetween(-baseRadius, baseRadius),
      randBetween(-baseRadius, baseRadius),
      randBetween(-baseRadius, baseRadius)
    ));

    scene.add(m);

    const outward = m.position.clone().sub(center).normalize();
    const v = outward.multiplyScalar(randBetween(2, 6))
      .add(shotDir.clone().normalize().multiplyScalar(randBetween(4, 9)))
      .add(new THREE.Vector3(randBetween(-1,1), randBetween(1,4), randBetween(-1,1)));

    debris.push({
      mesh: m,
      vel: v,
      radius: r,
      life: randBetween(0.7, 1.4)
    });
  }
}


function updateDebris(dt) {
  const floorY = 0.05;

  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;

    d.vel.y += gravity * dt;
    d.mesh.position.addScaledVector(d.vel, dt);

    if (d.mesh.position.y < floorY) {
      d.mesh.position.y = floorY;
      if (d.vel.y < 0) d.vel.y *= -0.25;
      d.vel.x *= 0.88;
      d.vel.z *= 0.88;
    }

    d.vel.multiplyScalar(0.99);

    if (d.life <= 0) {
      scene.remove(d.mesh);
      debris.splice(i, 1);
    }
  }
}



function triggerDamageFX(amount01) {
  // amount01 is 0..1
  damageOverlayT = Math.min(1, damageOverlayT + amount01);

  // screen shake
  shakeT = Math.min(0.18, shakeT + 0.08 * amount01);
  shakeStrength = Math.min(0.22, shakeStrength + 0.12 * amount01);
}

function updateDamageFX(dt) {
  // fade out overlay
  damageOverlayT = Math.max(0, damageOverlayT - dt * 1.8);

  if (damageOverlayEl) {
    const alpha = 0.55 * damageOverlayT; // max opacity
    damageOverlayEl.style.background = `rgba(255,0,0,${alpha.toFixed(3)})`;
  }

  // decay shake
  shakeT = Math.max(0, shakeT - dt * 2.6);
  shakeStrength = Math.max(0, shakeStrength - dt * 2.8);
}

function applyCameraShake() {
  if (shakeT <= 0) return new THREE.Vector3(0, 0, 0);

  // small random offset each frame (cheap but effective)
  const s = shakeStrength;
  return new THREE.Vector3(
    (Math.random() - 0.5) * s,
    (Math.random() - 0.5) * s * 0.6,
    (Math.random() - 0.5) * s
  );
}

function addScore(points) {
  score += points;
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;

  const kEl = document.getElementById("killsEl");
  if (kEl) kEl.textContent = `Kills: ${kills}`;
}

function shoot() {
  if (ammo <= 0) return;
  ammo--;
  updateHUD();

  camera.getWorldDirection(tmpDir);

  shootRaycaster.set(camera.position, tmpDir);
  shootRaycaster.far = maxDistance;

  // Raycast against whole scene graph under each threat (rockets have children)
  const roots = threats.map(t => t.mesh);
  const hits = shootRaycaster.intersectObjects(roots, true);

  const start = camera.position.clone();
  const end = hits.length ? hits[0].point.clone() : start.clone().add(tmpDir.clone().multiplyScalar(maxDistance));
  addTracer(start, end);

  if (!hits.length) return;

  const hit = hits[0];

  // Get threat ref (works even if you hit a rocket fin)
  const t = hit.object?.userData?.threatRef;
  if (!t || !t.alive) return;

  // Find index for removal
  const idx = threats.indexOf(t);
  if (idx < 0) return;


  // Damage model
  let damage = 28;
  t.hp -= damage;

  // knockback impulse
  const impulse = tmpDir.clone().normalize().multiplyScalar(10);
  t.vel.add(impulse);

  // hit flash
t.mesh.traverse((obj) => {
  if (obj.isMesh && obj.material && obj.material.color) {
    obj.material.color.offsetHSL(0, 0, 0.15);
    setTimeout(() => {
      // reset by re-setting original? simplest: just slightly darken back
      obj.material.color.offsetHSL(0, 0, -0.15);
    }, 60);
  }
});

  if (t.hp <= 0) {
    kills++;
    addScore(t.scoreValue);
    shatterThreat(t, tmpDir);
    removeThreat(idx);
  }
}


function refreshHealthUI() {
  const pct = Math.max(0, Math.min(1, hp / maxHP));
  healthInner.style.width = `${pct * 100}%`;
}


function die() {
  if (isDead) return;
  isDead = true;

  // big hit FX + death fade
  triggerDamageFX(1.0);
  deathFade = 1.0;

  // show death screen + stats
  if (deathStatsEl) {
    deathStatsEl.textContent = `Score: ${score}  |  Kills: ${kills}`;
  }
  if (deathScreenEl) {
    deathScreenEl.style.display = "flex";
  }

  // leave pointer lock so you can click the respawn button
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
}


function takeDamage(amount) {
  if (isDead) return;

  hp = Math.max(0, hp - amount);
  refreshHealthUI();

  triggerDamageFX(Math.min(1, amount / 35));

  if (hp <= 0) {
    die();
  }
}

function resetGame() {
  // hide death screen
  if (deathScreenEl) deathScreenEl.style.display = "none";

  ammo = 999;
  updateHUD();


  // reset state
  isDead = false;
  deathFade = 0;

  hp = maxHP;
  score = 0;
  kills = 0;
  refreshHealthUI();
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  const kEl = document.getElementById("killsEl");
  if (kEl) kEl.textContent = `Kills: ${kills}`;

  // reset movement/camera
  camera.position.set(0, eyeHeight, 8);
  yaw = 0;
  pitch = 0;
  playerVelY = 0;
  onGround = true;

  // reset timers
  threatSpawnTimer = 0.15;

  // clear threats
  for (const t of threats) {
    if (t?.mesh) scene.remove(t.mesh);
  }
  threats.length = 0;

  // clear debris
  for (const d of debris) {
    if (d?.mesh) scene.remove(d.mesh);
  }
  debris.length = 0;

  // clear tracers
  for (const fx of bulletsFX) {
    if (fx?.line) scene.remove(fx.line);
  }
  bulletsFX.length = 0;

  // clear damage effect
  damageOverlayT = 0;
  shakeT = 0;
  shakeStrength = 0;
  if (damageOverlayEl) damageOverlayEl.style.background = "rgba(255,0,0,0.0)";

  // restore visuals
  renderer.domElement.style.filter = "";
}





function updateHUD() {
  const lockText = isPointerLocked ? "Locked" : "Click to lock";
  hudEl.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px;">FPS Shooter</div>
    <div>Mouse: look | LMB: shoot | ${lockText}</div>
    <div>WASD: move | Shift: sprint | Space: jump</div>
    <div style="margin-top:6px; opacity:0.9;">Ammo: ${ammo}</div>
  `;
}

/**********************************************************************
 * INPUT
 **********************************************************************/
function onClickCanvas() {
  // First click should lock pointer
  if (!isPointerLocked) renderer.domElement.requestPointerLock();
  ensureAudio();

}

function onPointerLockChange() {
  isPointerLocked = (document.pointerLockElement === renderer.domElement);
  updateHUD();
}

function onMouseMove(e) {
  if (!isPointerLocked) return;

  yaw   -= e.movementX * mouseSensitivity;
  pitch -= e.movementY * mouseSensitivity;

  const limit = Math.PI / 2 - 0.01;
  pitch = Math.max(-limit, Math.min(limit, pitch));
}

function onMouseDown(e) {
      if (isDead) return;

  

  if (e.button !== 0) return;
  if (!isPointerLocked) return;

  const now = performance.now() * 0.001;
  if (now - lastShotTime < 1 / fireRate) return;

  lastShotTime = now;
  shoot();
  playShootSound();

}

function onKeyDown(e) {
  const c = e.code;
  if (c === "KeyW") keys.w = true;
  if (c === "KeyA") keys.a = true;
  if (c === "KeyS") keys.s = true;
  if (c === "KeyD") keys.d = true;
  if (c === "ShiftLeft" || c === "ShiftRight") keys.shift = true;

  if (c === "Space") {
    keys.space = true;
    if (onGround) {
      playerVelY = jumpVel;
      onGround = false;
    }
  }
}

function onKeyUp(e) {
  const c = e.code;
  if (c === "KeyW") keys.w = false;
  if (c === "KeyA") keys.a = false;
  if (c === "KeyS") keys.s = false;
  if (c === "KeyD") keys.d = false;
  if (c === "ShiftLeft" || c === "ShiftRight") keys.shift = false;
  if (c === "Space") keys.space = false;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}


/**********************************************************************
 * UPDATE LOOP
 **********************************************************************/
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

    // If dead: keep rendering, but no movement/spawn/shoot updates
     if (isDead) {
    // death visual filter
    renderer.domElement.style.filter = "grayscale(1) contrast(1.1) blur(0.8px) brightness(0.8)";

    updateDebris(dt);
    updateDamageFX(dt);

    renderer.render(scene, camera);
    return;
  } else {
    renderer.domElement.style.filter = "";
  }


  // apply look
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // player move (XZ relative to camera yaw)
  const speed = keys.shift ? sprintSpeed : walkSpeed;

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  const right   = new THREE.Vector3(1, 0,  0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);

  const moveDir = new THREE.Vector3();
  if (keys.w) moveDir.add(forward);
  if (keys.s) moveDir.sub(forward);
  if (keys.d) moveDir.add(right);
  if (keys.a) moveDir.sub(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize().multiplyScalar(speed * dt);
    camera.position.add(moveDir);
  }

  // vertical movement (jump/gravity)
  playerVelY += gravity * dt;
  camera.position.y += playerVelY * dt;

  // floor at y = eyeHeight
  if (camera.position.y <= eyeHeight) {
    camera.position.y = eyeHeight;
    playerVelY = 0;
    onGround = true;
  } else {
    onGround = false;
  }



  updateThreats(dt);
  updateDebris(dt);
  updateDamageFX(dt);

  // update tracers
  for (let i = bulletsFX.length - 1; i >= 0; i--) {
    bulletsFX[i].life -= dt;
    if (bulletsFX[i].life <= 0) {
      scene.remove(bulletsFX[i].line);
      bulletsFX.splice(i, 1);
    }
  }

  // Apply camera shake (offset only for rendering)
  const shake = applyCameraShake();
  camera.position.add(shake);
  renderer.render(scene, camera);
  camera.position.sub(shake);

  

}

