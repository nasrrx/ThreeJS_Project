// main.js
// DO NOT CHANGE THIS IMPORT LINE (same as your working one):
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js";

/**********************************************************************
 * GLOBALS
 **********************************************************************/
let scene, camera, renderer;
let raycaster, mouse;
let collisionRaycaster;
let textureLoader;

let planet;
let plane;
let bouncingSphere;
let spinningTorus;
let rotatingCube;
let wall;
let energyCone;

const clickableObjects = [];

let clock;
let timeElapsed = 0;

// Last clicked object (for gravity / movement / UI)
let lastClickedObject = null;

// Gravity state for single simulated object
const gravityState = {
  active: false,
  object: null,
  velocityY: 0,
  accelerationY: -9.8, // conceptually gravity, real value comes from presets
  floorY: 0
};

// Gravity presets
const gravityPresets = {
  earth: -9.8,
  moon: -1.62,
  jupiter: -24.79
};
let currentGravityPreset = "earth";

// Multiple dynamic bodies (extra falling spheres)
const dynamicBodies = []; // each: { mesh, velocityY, floorY, active }

// Projectile bodies (full 3D projectile motion)
const projectiles = []; // each: { mesh, velocity: THREE.Vector3, acceleration: THREE.Vector3, radius, active }

// Animation speed multipliers
const speedFactors = {
  sphere: 1,
  torus: 1,
  cube: 1
};

// Track which objects’ animation is paused due to gravity
const animationPaused = {
  sphere: false,
  torus: false,
  cube: false
};

// Simple orbit-like camera control
let isDragging = false;
const previousMousePosition = { x: 0, y: 0 };
const spherical = new THREE.Spherical(10, Math.PI / 3, Math.PI / 4); // radius, phi, theta
const orbitTarget = new THREE.Vector3(0, 1, 0);

// Movement input for last clicked object
const moveInput = {
  forward: 0,
  back: 0,
  left: 0,
  right: 0
};
const moveSpeed = 5;

// UI elements
let lastClickedLabel;
let gravityBtn;
let speedTargetSelect;
let speedInput;
let applySpeedBtn;
let gravityPresetSelect;
let spawnSphereBtn;
let glassModeBtn;

// Projectile UI elements
let projectileSpeedInput;
let projectileAngleInput;     // elevation angle
let projectileHAngleInput;    // horizontal (yaw) angle
let projectileAccelInput;     // extra vertical acceleration
let spawnProjectileBtn;
let clearProjectilesBtn;


// Store original cone material to toggle glass mode
let coneOriginalMaterial = null;
let coneIsGlass = false;


function setPlanetTexture(planetMesh, planetType) {
  if (!textureLoader || !planetMesh || !planetMesh.material) return;

  let fileName;
  switch (planetType) {
    case "earth":
      fileName = "EarthTexture.png";
      break;
    case "jupiter":
      fileName = "JupiterTexture.jpg";
      break;
    case "moon":
      fileName = "MoonTexture.jpg";
      break;
    default:
      fileName = null;
  }

  if (!fileName) {
    planetMesh.material.map = null;
    planetMesh.material.color.set(0xaaaaaa);
    planetMesh.material.needsUpdate = true;
    return;
  }

  textureLoader.load(fileName, (tex) => {
    planetMesh.material.map = tex;
    planetMesh.material.color.set(0xffffff);
    planetMesh.material.needsUpdate = true;
  });
}


  function placeObjectOnPlanet(object, phi, theta, radius) {
  // Calculate position on the planet's surface using spherical coordinates
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);  // height based on phi
  const z = radius * Math.sin(phi) * Math.sin(theta);

  object.position.set(x, y, z);  // Set the object's position on the planet surface
  object.castShadow = true;
  object.receiveShadow = true;
  scene.add(object);  // Add the object to the scene
}

/**********************************************************************
 * ENTRY POINT
 **********************************************************************/
init();
animate();

/**********************************************************************
 * INIT
 **********************************************************************/
function init() {
  textureLoader = new THREE.TextureLoader();
  clock = new THREE.Clock();
  timeElapsed = 0;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Camera
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  updateCameraFromSpherical();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  /*********** PLANET (SPHERE) ***********/
  const planetGeometry = new THREE.SphereGeometry(50, 64, 64);  // Larger sphere
  const planetMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
  planet = new THREE.Mesh(planetGeometry, planetMaterial);

  // Load texture for planet surface (for example, Earth texture)


  planet.rotation.x = Math.PI / 2; // Rotate so the top of the sphere faces up
  planet.position.y = -50;  // Position the planet below the camera
  planet.receiveShadow = true;
  scene.add(planet);

  setPlanetTexture(planet, "earth");// You can modify this function to load different textures

  /*********** OBJECTS ON THE PLANET ***********/
  // Example: Place objects on the surface of the planet
  placeObjectOnPlanet(bouncingSphere, 0, 1, 10);
  placeObjectOnPlanet(spinningTorus, Math.PI / 4, 0, 20);  // Example placement for spinningTorus
  placeObjectOnPlanet(rotatingCube, Math.PI / 3, 0, -15);  // Example placement for rotatingCube

  /*********** COLORS ***********/
  const COLORS = {
    accentOrange: 0xffb347,
    accentBlue: 0x4ea9ff,
    accentPink: 0xff6fa4,
    cubeBase: 0x223049,
    wall: 0x2b2f3a
  };

  /*********** SPHERE (BOUNCING) ***********/
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accentBlue });
  bouncingSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  bouncingSphere.position.set(0, 1.5, 1);
  bouncingSphere.castShadow = true;
  scene.add(bouncingSphere);
  clickableObjects.push(bouncingSphere);

  /*********** TORUS (SPINNING) ***********/
  const torusGeometry = new THREE.TorusGeometry(1, 0.25, 16, 100);
  const torusMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accentOrange });
  spinningTorus = new THREE.Mesh(torusGeometry, torusMaterial);
  spinningTorus.position.set(3, 1.5, 0);
  spinningTorus.castShadow = true;
  scene.add(spinningTorus);
  clickableObjects.push(spinningTorus);

  /*********** CUBE (ROTATING) ***********/
  const cubeGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const cubeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.cubeBase });
  rotatingCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  rotatingCube.position.set(-3, 1, 0);
  rotatingCube.castShadow = true;
  scene.add(rotatingCube);
  clickableObjects.push(rotatingCube);

  /*********** WALL ***********/
  const wallGeometry = new THREE.BoxGeometry(0.3, 2.5, 8);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: COLORS.wall });
  wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.position.set(0, 1.25, -4);
  wall.castShadow = true;
  scene.add(wall);
  clickableObjects.push(wall);

  /*********** CONE ***********/
  const coneGeometry = new THREE.ConeGeometry(0.7, 1.6, 32);
  const coneMaterial = new THREE.MeshStandardMaterial({ color: COLORS.accentPink });
  energyCone = new THREE.Mesh(coneGeometry, coneMaterial);
  energyCone.position.set(-1.5, 0.8, 3);
  energyCone.castShadow = true;
  scene.add(energyCone);
  clickableObjects.push(energyCone);
  coneOriginalMaterial = energyCone.material;


  // AFTER creating bouncingSphere, spinningTorus, rotatingCube
placeObjectOnPlanet(bouncingSphere, 0, 1, 10);
placeObjectOnPlanet(spinningTorus, Math.PI / 4, 0, 20);
placeObjectOnPlanet(rotatingCube, Math.PI / 3, 0, 15);


  /*********** AXES HELPER ***********/
  const axes = new THREE.AxesHelper(3);
  scene.add(axes);

  /*********** RAYCASTING ***********/
  raycaster = new THREE.Raycaster();
  collisionRaycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener("click", onClick);

  /*********** SIMPLE ORBIT CAMERA CONTROLS ***********/
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  renderer.domElement.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("mouseup", onMouseUp);
  renderer.domElement.addEventListener("mouseleave", onMouseUp);
  renderer.domElement.addEventListener("wheel", onMouseWheel, { passive: true });

  /*********** KEYBOARD MOVEMENT (WASD) ***********/
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /*********** UI CREATED FROM JS ***********/
  createUI();

  /*********** RESIZE ***********/
  window.addEventListener("resize", onWindowResize);
}

function setPlanetFloor(planet) {
  if (!textureLoader || !plane) return;

  let fileName;
  switch (planet) {
    case "earth":
      fileName = "EarthTexture.png";
      break;
    case "jupiter":
      fileName = "JupiterTexture.jpg";
      break;
    case "moon":
      fileName = "MoonTexture.jpg";
      break;
    default:
      fileName = null;
  }

  if (!fileName) {
    // Remove texture, fallback to plain color
    plane.material.map = null;
    plane.material.color.set(0x333333);
    plane.material.needsUpdate = true;
    return;
  }

  textureLoader.load(
    fileName,
    function (tex) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2); // tile it a bit
      plane.material.map = tex;
      plane.material.color.set(0xffffff); // so texture shows correctly
      plane.material.needsUpdate = true;
    },
    undefined,
    function (err) {
      console.error("Failed to load planet texture:", fileName, err);
    }
  );
}

/**********************************************************************
 * UI CREATION
 **********************************************************************/
function createSection(title) {
    const section = document.createElement("div");
    section.style.border = "1px solid #444";
    section.style.padding = "8px";
    section.style.marginTop = "8px";
    section.style.borderRadius = "6px";

    const header = document.createElement("div");
    header.textContent = title;
    header.style.fontWeight = "bold";
    header.style.fontSize = "12px";
    header.style.marginBottom = "6px";

    section.appendChild(header);
    return section;
}

function createUI() {
  const ui = document.createElement("div");
  ui.style.position = "absolute";
  ui.style.top = "10px";
  ui.style.left = "10px";
  ui.style.padding = "10px 12px";
  ui.style.background = "rgba(0, 0, 0, 0.7)";
  ui.style.color = "#f5f5f5";
  ui.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ui.style.fontSize = "13px";
  ui.style.borderRadius = "8px";
  ui.style.zIndex = "10";
  ui.style.minWidth = "260px";

  ui.innerHTML = `
    <div><b>Physics Playground</b></div>
    <div style="font-size:11px;margin-top:4px;">
      • Click objects to select<br>
      • WASD: move last clicked object<br>
      • Mouse drag: orbit | wheel: zoom
    </div>
  `;

  /***************************************************************
   * SECTION: GRAVITY TOOLS
   ***************************************************************/
  const gravitySection = createSection("Gravity Tools");

  // Gravity button
  gravityBtn = document.createElement("button");
  gravityBtn.textContent = "Simulate Gravity on Last Clicked";
  gravityBtn.style.fontSize = "12px";
  gravityBtn.style.display = "block";

  // Gravity preset selector row
  const presetRow = document.createElement("div");
  presetRow.style.fontSize = "12px";
  presetRow.style.marginTop = "6px";

  const presetLabel = document.createElement("label");
  presetLabel.textContent = "Preset: ";

  gravityPresetSelect = document.createElement("select");
  gravityPresetSelect.style.fontSize = "12px";

  ["earth", "moon", "jupiter"].forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    gravityPresetSelect.appendChild(opt);
  });

  gravityPresetSelect.value = "earth";

  presetRow.appendChild(presetLabel);
  presetRow.appendChild(gravityPresetSelect);

  gravitySection.appendChild(gravityBtn);
  gravitySection.appendChild(presetRow);

  /***************************************************************
   * SECTION: PROJECTILE LAUNCHER
   ***************************************************************/
  const projectileSection = createSection("Projectile Launcher");

  // Speed
  const projRow1 = document.createElement("div");
  projRow1.style.fontSize = "12px";
  projRow1.textContent = "Speed: ";
  projectileSpeedInput = document.createElement("input");
  projectileSpeedInput.type = "number";
  projectileSpeedInput.step = "0.1";
  projectileSpeedInput.value = "10";
  projectileSpeedInput.style.width = "60px";
  projRow1.appendChild(projectileSpeedInput);

  // Elevation angle
  const projRow2 = document.createElement("div");
  projRow2.style.fontSize = "12px";
  projRow2.textContent = "Elev Angle (°): ";
  projectileAngleInput = document.createElement("input");
  projectileAngleInput.type = "number";
  projectileAngleInput.step = "1";
  projectileAngleInput.value = "45";
  projectileAngleInput.style.width = "60px";
  projRow2.appendChild(projectileAngleInput);

  // Horizontal angle
  const projRow3 = document.createElement("div");
  projRow3.style.fontSize = "12px";
  projRow3.textContent = "Horiz Angle (°): ";
  projectileHAngleInput = document.createElement("input");
  projectileHAngleInput.type = "number";
  projectileHAngleInput.step = "1";
  projectileHAngleInput.value = "0";
  projectileHAngleInput.style.width = "60px";
  projRow3.appendChild(projectileHAngleInput);

  // Extra acceleration
  const projRow4 = document.createElement("div");
  projRow4.style.fontSize = "12px";
  projRow4.textContent = "Extra Acc Y: ";
  projectileAccelInput = document.createElement("input");
  projectileAccelInput.type = "number";
  projectileAccelInput.step = "0.5";
  projectileAccelInput.value = "0";
  projectileAccelInput.style.width = "60px";
  projRow4.appendChild(projectileAccelInput);

  // Spawn Projectile button
  spawnProjectileBtn = document.createElement("button");
  spawnProjectileBtn.textContent = "Spawn Projectile";
  spawnProjectileBtn.style.marginTop = "6px";
  spawnProjectileBtn.style.fontSize = "12px";

  // NEW: Clear Projectiles button
  clearProjectilesBtn = document.createElement("button");
  clearProjectilesBtn.textContent = "Clear Projectiles";
  clearProjectilesBtn.style.marginTop = "4px";
  clearProjectilesBtn.style.fontSize = "12px";

  projectileSection.appendChild(projRow1);
  projectileSection.appendChild(projRow2);
  projectileSection.appendChild(projRow3);
  projectileSection.appendChild(projRow4);
  projectileSection.appendChild(spawnProjectileBtn);
  projectileSection.appendChild(clearProjectilesBtn);

  /***************************************************************
   * SECTION: OBJECT SPAWN
   ***************************************************************/
  const spawnSection = createSection("Spawn Objects");

  spawnSphereBtn = document.createElement("button");
  spawnSphereBtn.textContent = "Spawn Falling Sphere";
  spawnSphereBtn.style.fontSize = "12px";

  spawnSection.appendChild(spawnSphereBtn);

  /***************************************************************
   * SECTION: ANIMATION SPEED
   ***************************************************************/
  const speedSection = createSection("Animation Speed");

  const speedRow1 = document.createElement("div");
  speedRow1.style.fontSize = "12px";

  const labelObject = document.createElement("label");
  labelObject.textContent = "Target: ";

  speedTargetSelect = document.createElement("select");
  speedTargetSelect.style.fontSize = "12px";

    // CONTINUED FROM THE LAST PART

  ["sphere", "torus", "cube", "all"].forEach((val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    speedTargetSelect.appendChild(opt);
  });

  speedRow1.appendChild(labelObject);
  speedRow1.appendChild(speedTargetSelect);

  const speedRow2 = document.createElement("div");
  speedRow2.style.fontSize = "12px";
  speedRow2.style.marginTop = "4px";

  const labelSpeed = document.createElement("label");
  labelSpeed.textContent = "Multiplier: ";

  speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.step = "0.1";
  speedInput.value = "1";
  speedInput.style.width = "60px";

  applySpeedBtn = document.createElement("button");
  applySpeedBtn.textContent = "Apply";
  applySpeedBtn.style.marginLeft = "4px";
  applySpeedBtn.style.fontSize = "12px";

  speedRow2.appendChild(labelSpeed);
  speedRow2.appendChild(speedInput);
  speedRow2.appendChild(applySpeedBtn);

  speedSection.appendChild(speedRow1);
  speedSection.appendChild(speedRow2);

  /***************************************************************
   * SECTION: VISUAL EFFECTS
   ***************************************************************/
  const visualSection = createSection("Visual Effects");

  glassModeBtn = document.createElement("button");
  glassModeBtn.textContent = "Toggle Glass Mode (Cone)";
  glassModeBtn.style.fontSize = "12px";

  visualSection.appendChild(glassModeBtn);

  /***************************************************************
   * SECTION: SELECTED OBJECT INFO
   ***************************************************************/
  const infoSection = createSection("Selected Object");

  const lastRow = document.createElement("div");
  lastRow.style.fontSize = "12px";
  lastRow.innerHTML = `Last clicked: <span id="lastClickedLabel">None</span>`;
  lastClickedLabel = lastRow.querySelector("#lastClickedLabel");

  infoSection.appendChild(lastRow);

  /***************************************************************
   * ADD SECTIONS TO UI ROOT
   ***************************************************************/
  ui.appendChild(gravitySection);
  ui.appendChild(projectileSection);
  ui.appendChild(spawnSection);
  ui.appendChild(speedSection);
  ui.appendChild(visualSection);
  ui.appendChild(infoSection);

  document.body.appendChild(ui);

  /***************************************************************
   * EVENT LISTENERS
   ***************************************************************/
  gravityBtn.addEventListener("click", onGravityButtonClick);
  gravityPresetSelect.addEventListener("change", onGravityPresetChange);
  spawnSphereBtn.addEventListener("click", spawnFallingSphere);
  spawnProjectileBtn.addEventListener("click", spawnProjectile);
  glassModeBtn.addEventListener("click", toggleGlassMode);
  applySpeedBtn.addEventListener("click", onApplySpeedClick);
  clearProjectilesBtn.addEventListener("click", clearProjectiles);
}


/**********************************************************************
 * CAMERA (simple spherical orbit)
 **********************************************************************/
function updateCameraFromSpherical() {
  const pos = new THREE.Vector3().setFromSpherical(spherical);
  camera.position.copy(pos).add(orbitTarget);
  camera.lookAt(orbitTarget);
}

function onMouseDown(event) {
  isDragging = true;
  previousMousePosition.x = event.clientX;
  previousMousePosition.y = event.clientY;
}

function onMouseMove(event) {
  if (!isDragging) return;

  const deltaX = event.clientX - previousMousePosition.x;
  const deltaY = event.clientY - previousMousePosition.y;

  previousMousePosition.x = event.clientX;
  previousMousePosition.y = event.clientY;

  const rotationSpeed = 0.005;
  spherical.theta -= deltaX * rotationSpeed;
  spherical.phi -= deltaY * rotationSpeed;

  const epsilon = 0.001;
  spherical.phi = Math.max(epsilon, Math.min(Math.PI - epsilon, spherical.phi));

  updateCameraFromSpherical();
}

function onMouseUp() {
  isDragging = false;
}

function onMouseWheel(event) {
  const zoomFactor = 1 + event.deltaY * 0.001;
  spherical.radius *= zoomFactor;
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, 4, 30);
  updateCameraFromSpherical();
}

/**********************************************************************
 * KEYBOARD MOVEMENT (WASD)
 **********************************************************************/
function onKeyDown(event) {
  switch (event.key.toLowerCase()) {
    case "w":
      moveInput.forward = 1;
      break;
    case "s":
      moveInput.back = 1;
      break;
    case "a":
      moveInput.left = 1;
      break;
    case "d":
      moveInput.right = 1;
      break;
  }
}

function onKeyUp(event) {
  switch (event.key.toLowerCase()) {
    case "w":
      moveInput.forward = 0;
      break;
    case "s":
      moveInput.back = 0;
      break;
    case "a":
      moveInput.left = 0;
      break;
    case "d":
      moveInput.right = 0;
      break;
  }
}

/**********************************************************************
 * RAYCAST CLICK
 **********************************************************************/
function onClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableObjects, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    hit.material.color.setHex(Math.random() * 0xffffff);

    lastClickedObject = hit;
    if (lastClickedLabel) {
      lastClickedLabel.textContent = getObjectLabel(hit);
    }

    // stop gravity on previous object if running
    gravityState.active = false;
    gravityState.object = null;
  }
}

function getObjectLabel(obj) {
  if (obj === bouncingSphere) return "Sphere";
  if (obj === spinningTorus) return "Torus";
  if (obj === rotatingCube) return "Cube";
  if (obj === wall) return "Wall";
  if (obj === energyCone) return "Cone";
  return "Object";
}

/**********************************************************************
 * GRAVITY BUTTON (single object)
 **********************************************************************/
function onGravityButtonClick() {
  if (!lastClickedObject) {
    alert("Click any object first, then press the gravity button.");
    return;
  }

  // Compute approximate height for floor collision
  const box = new THREE.Box3().setFromObject(lastClickedObject);
  const height = box.max.y - box.min.y || 1;
  const floorY = 0 + height / 2; // plane at y=0

  gravityState.active = true;
  gravityState.object = lastClickedObject;
  gravityState.velocityY = 0;
  gravityState.floorY = floorY;

  // Pause that object's normal animation
  if (lastClickedObject === bouncingSphere) animationPaused.sphere = true;
  if (lastClickedObject === spinningTorus) animationPaused.torus = true;
  if (lastClickedObject === rotatingCube) animationPaused.cube = true;
}

/**********************************************************************
 * GRAVITY PRESET CHANGE
 **********************************************************************/
function onGravityPresetChange() {
  const preset = gravityPresetSelect.value; // "earth" | "moon" | "jupiter"
  currentGravityPreset = preset;

  // Bind floor texture to gravity setting
  if (preset === "earth") {
    setPlanetFloor("earth");
  } else if (preset === "jupiter") {
    setPlanetFloor("jupiter");
  } else if (preset === "moon") {
    // You don't have a moon texture, pick one:
    // Option 1: use Mars as a placeholder
    setPlanetFloor("mars");

    // Option 2 (if you prefer plain floor):
    // setPlanetFloor(null);
  }
}


/**********************************************************************
 * SPAWN FALLING SPHERE (simple vertical body)
 **********************************************************************/
function spawnFallingSphere() {
  const radius = 0.4;
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  const col = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color: col.getHex() });
  const mesh = new THREE.Mesh(geo, mat);

  const x = (Math.random() - 0.5) * 10;
  const z = (Math.random() - 0.5) * 10;
  mesh.position.set(x, 5 + Math.random() * 3, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const floorY = radius; // plane at y=0

  dynamicBodies.push({
    mesh,
    velocityY: 0,
    floorY,
    active: true
  });
}

/**********************************************************************
 * SPAWN PROJECTILE – with velocity, angle, etc.
 **********************************************************************/
function spawnProjectile() {
  const baseGravity = gravityPresets[currentGravityPreset];

  let speed = parseFloat(projectileSpeedInput.value);
  if (isNaN(speed) || speed <= 0) speed = 10;

  let elevDeg = parseFloat(projectileAngleInput.value);
  if (isNaN(elevDeg)) elevDeg = 45;

  let horizDeg = parseFloat(projectileHAngleInput.value);
  if (isNaN(horizDeg)) horizDeg = 0;

  let extraAcc = parseFloat(projectileAccelInput.value);
  if (isNaN(extraAcc)) extraAcc = 0;

  // Convert to radians
  const elevRad = THREE.MathUtils.degToRad(elevDeg);
  const horizRad = THREE.MathUtils.degToRad(horizDeg);

  // Horizontal direction in XZ plane: 0° = -Z
  const dirXZ = new THREE.Vector3(
    Math.sin(horizRad),
    0,
    -Math.cos(horizRad)
  ).normalize();

  // Velocity components
  const vHorizontal = Math.cos(elevRad) * speed;
  const vVertical = Math.sin(elevRad) * speed;

  const velocity = new THREE.Vector3()
    .copy(dirXZ)
    .multiplyScalar(vHorizontal);
  velocity.y = vVertical;

  // Vertical acceleration (gravity + extra)
  const acceleration = new THREE.Vector3(0, baseGravity + extraAcc, 0);

  // Start position: from last clicked object if any, else near origin
  let startPos;
  if (lastClickedObject) {
    startPos = lastClickedObject.position.clone();
    startPos.y += 0.8;
  } else {
    startPos = new THREE.Vector3(0, 1.0, 2);
  }

  const radius = 0.25;
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  const color = new THREE.Color().setHSL(Math.random(), 0.7, 0.6);
  const mat = new THREE.MeshStandardMaterial({ color: color.getHex() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(startPos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity,
    acceleration,
    radius,
    active: true
  });
}

function clearProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (p.mesh) {
      scene.remove(p.mesh);
    }
  }
  projectiles.length = 0;
}


/**********************************************************************
 * TOGGLE GLASS MODE (CONE)
 **********************************************************************/
function toggleGlassMode() {
  if (!energyCone) return;

  if (!coneIsGlass) {
    // Switch to glass-like material
    const glassMat = new THREE.MeshPhysicalMaterial
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.05,
          transmission: 0.9,
          transparent: true,
          opacity: 0.9,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1
        })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.05,
          transparent: true,
          opacity: 0.5
        });

    energyCone.material = glassMat;
    coneIsGlass = true;
  } else {
    // Restore original solid material
    energyCone.material = coneOriginalMaterial;
    coneIsGlass = false;
  }
}

/**********************************************************************
 * SPEED BUTTON
 **********************************************************************/
function onApplySpeedClick() {
  if (!speedInput || !speedTargetSelect) return;

  let val = parseFloat(speedInput.value);
  if (isNaN(val) || val < 0) val = 0;

  const target = speedTargetSelect.value; // sphere | torus | cube | all

  if (target === "sphere" || target === "all") speedFactors.sphere = val;
  if (target === "torus" || target === "all") speedFactors.torus = val;
  if (target === "cube" || target === "all") speedFactors.cube = val;
}

/**********************************************************************
 * RESIZE
 **********************************************************************/
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**********************************************************************
 * MOVEMENT + COLLISION WITH OBJECTS
 **********************************************************************/
function getApproxRadius(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  return size.length() * 0.4; // half of the diagonal as a rough radius
}

function updateLastClickedMovement(delta) {
  if (!lastClickedObject) return;

  // Build desired movement direction from WASD relative to camera
  const dir = new THREE.Vector3();

  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();

  const camRight = new THREE.Vector3().crossVectors(
    camForward,
    new THREE.Vector3(0, 1, 0)
  ).normalize();

  if (moveInput.forward) dir.add(camForward);
  if (moveInput.back) dir.sub(camForward);
  if (moveInput.left) dir.sub(camRight);
  if (moveInput.right) dir.add(camRight);

  if (dir.lengthSq() === 0) return; // no input

  dir.normalize();
  const distance = moveSpeed * delta;
  const displacement = dir.clone().multiplyScalar(distance);

  // Candidate new position
  const newPos = lastClickedObject.position.clone().add(displacement);

  // Approx radius of moving object
  const myRadius = getApproxRadius(lastClickedObject) * 0.6; // scale a bit down
  const margin = 0.15; // extra spacing so it feels solid but not too far

  // Check distance to all other clickable objects
  for (let i = 0; i < clickableObjects.length; i++) {
    const other = clickableObjects[i];
    if (other === lastClickedObject) continue;

    const otherRadius = getApproxRadius(other) * 0.6;
    const minDist = myRadius + otherRadius + margin;

    const otherPos = other.position.clone();
    const dist = newPos.distanceTo(otherPos);

    if (dist < minDist) {
      // Too close to this object -> block movement this frame
      return;
    }
  }

  // No collisions -> move
  lastClickedObject.position.copy(newPos);
}

/**********************************************************************
 * ANIMATION LOOP
 **********************************************************************/
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  timeElapsed += delta;

  const gAccel = gravityPresets[currentGravityPreset];

  // Sphere: bounce unless under gravity
  if (!animationPaused.sphere && bouncingSphere) {
    const amplitude = 0.6;
    const baseline = 1.5;
    const baseFrequency = 1.5;
    const freq = baseFrequency * speedFactors.sphere;
    bouncingSphere.position.y =
      baseline + Math.abs(Math.sin(timeElapsed * freq)) * amplitude;
  }

  // Torus: spin unless paused
  if (!animationPaused.torus && spinningTorus) {
    spinningTorus.rotation.x += 0.01 * speedFactors.torus;
    spinningTorus.rotation.y += 0.02 * speedFactors.torus;
  }

  // Cube: rotate unless paused
  if (!animationPaused.cube && rotatingCube) {
    rotatingCube.rotation.y += 0.015 * speedFactors.cube;
    rotatingCube.rotation.x += 0.005 * speedFactors.cube;
  }

  // Gravity simulation for single object
  if (gravityState.active && gravityState.object) {
    gravityState.velocityY += gAccel * delta;
    gravityState.object.position.y += gravityState.velocityY * delta;

    if (gravityState.object.position.y <= gravityState.floorY) {
      gravityState.object.position.y = gravityState.floorY;
      gravityState.velocityY *= -0.5; // bounce with damping

      // finished?
      if (Math.abs(gravityState.velocityY) < 0.5) {
        // Restore animation on that object
        if (gravityState.object === bouncingSphere) animationPaused.sphere = false;
        if (gravityState.object === spinningTorus) animationPaused.torus = false;
        if (gravityState.object === rotatingCube) animationPaused.cube = false;

        gravityState.active = false;
        gravityState.object = null;
      }
    }
  }

  // Gravity for dynamic spawned spheres (vertical only)
  for (let i = dynamicBodies.length - 1; i >= 0; i--) {
    const body = dynamicBodies[i];
    if (!body.active) continue;

    body.velocityY += gAccel * delta;
    body.mesh.position.y += body.velocityY * delta;

    if (body.mesh.position.y <= body.floorY) {
      body.mesh.position.y = body.floorY;
      body.velocityY *= -0.5;

      if (Math.abs(body.velocityY) < 0.5) {
        body.active = false;
      }
    }
  }

  // Projectile motion (full 3D v + a)
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (!p.active) continue;

    p.velocity.addScaledVector(p.acceleration, delta);
        p.mesh.position.addScaledVector(p.velocity, delta);

    const floorY = p.radius; // ground at y=0
    if (p.mesh.position.y <= floorY) {
      p.mesh.position.y = floorY;
      p.active = false; // stop projectile at impact
    }
  }

  // Movement of last clicked object with collision
  updateLastClickedMovement(delta);

  renderer.render(scene, camera);
}
console.log("planet:", planet);
console.log("planet.material:", planet?.material);


