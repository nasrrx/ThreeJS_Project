import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js";

/**********************************************************************
 * WAVE LAB (UI HEAVY) — NO INTERACTION
 * - Grid + floor + optional axes
 * - Wave line (points) with optional second wave (interference)
 * - Standing wave mode
 * - Color modes (height-based / speed-based / solid)
 * - Pause / Step / Reset / Presets
 * - Optional auto-rotate camera (no drag, no wheel, no click)
 *
 * NOTE:
 * - Removed ALL interaction: click impulses, raycasting, pointer/drag, wheel zoom, keyboard hotkeys.
 * - Removed Phase, Damping, Height Scale (as before).
 **********************************************************************/

let scene, camera, renderer, clock;

let gridHelper, axesHelper, floorMesh;
let waveGroup, points = [], line;
let uiRoot;

let isPaused = false;
let stepOnce = false;

// Static orbit camera (still “orbits” if autoRotate is enabled)
let orbitYaw = 0.2;
let orbitPitch = -0.35;
let orbitRadius = 12.0;

// Wave configuration
const params = {
  // sim + wave
  amplitude: 1.2,
  frequency: 1.6,
  speed: 2.2,
  spacing: 0.18,
  pointCount: 140,

  // optional second wave (interference)
  waveBEnabled: false,
  ampB: 0.7,
  freqB: 1.65,
  speedB: 2.1,
  phaseB: 1.0, // kept (Wave B only)

  // standing wave mode
  standingWave: false,

  // visuals
  showGrid: true,
  showAxes: false,
  showFloor: true,
  showLine: true,
  showPoints: true,
  pointSize: 0.06,
  lineThicknessHint: 1,

  // color
  colorMode: "height",  // "height" | "velocity" | "solid"
  colorIntensity: 1.0,
  solidColor: "#66aaff",

  // camera
  autoRotate: false,
  autoRotateSpeed: 0.25
};

init();
animate();

/**********************************************************************
 * INIT
 **********************************************************************/
function init() {
  clock = new THREE.Clock();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.Fog(0x050508, 18, 45);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  updateCamera();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Lights
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(10, 14, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
  fill.position.set(-12, 8, 10);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // Helpers + floor
  buildEnvironment();

  // Wave objects
  buildWave();

  // UI
  buildUI();
  applyAllToggles();

  // Only resize event (no other interaction)
  window.addEventListener("resize", onResize);
}

/**********************************************************************
 * ENVIRONMENT
 **********************************************************************/
function buildEnvironment() {
  // floor
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.95, metalness: 0.0 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -1.75;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // grid
  gridHelper = new THREE.GridHelper(32, 32, 0x7788aa, 0x334455);
  gridHelper.position.y = floorMesh.position.y + 0.01;
  gridHelper.material.opacity = 0.22;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // axes
  axesHelper = new THREE.AxesHelper(3.5);
  axesHelper.position.y = floorMesh.position.y + 0.02;
  scene.add(axesHelper);
}

/**********************************************************************
 * WAVE BUILD
 **********************************************************************/
function buildWave() {
  if (waveGroup) scene.remove(waveGroup);

  waveGroup = new THREE.Group();
  scene.add(waveGroup);

  points.length = 0;

  const geoPoint = new THREE.SphereGeometry(params.pointSize, 12, 12);
  const matPoint = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.solidColor),
    roughness: 0.35,
    metalness: 0.1
  });

  for (let i = 0; i < params.pointCount; i++) {
    const p = new THREE.Mesh(geoPoint, matPoint.clone());
    p.castShadow = true;

    const x = (i - params.pointCount / 2) * params.spacing;
    p.position.set(x, 0, 0);

    waveGroup.add(p);
    points.push(p);
  }

  // line (through points)
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(params.pointCount * 3);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));

  const lineMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55
  });

  line = new THREE.Line(lineGeo, lineMat);
  waveGroup.add(line);

  updateLineGeometry();
}

/**********************************************************************
 * UI (kept, but no keyboard/mouse bindings)
 **********************************************************************/
function buildUI() {
  uiRoot = document.createElement("div");
  uiRoot.style.position = "fixed";
  uiRoot.style.left = "12px";
  uiRoot.style.bottom = "12px";
  uiRoot.style.zIndex = "9999";
  uiRoot.style.width = "min(420px, 94vw)";
  uiRoot.style.padding = "12px";
  uiRoot.style.borderRadius = "14px";
  uiRoot.style.border = "1px solid rgba(255,255,255,0.14)";
  uiRoot.style.background = "rgba(0,0,0,0.55)";
  uiRoot.style.backdropFilter = "blur(10px)";
  uiRoot.style.boxShadow = "0 18px 60px rgba(0,0,0,0.55)";
  uiRoot.style.fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
  uiRoot.style.color = "#fff";
  uiRoot.style.userSelect = "none";

  uiRoot.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <div>
        <div style="font-weight:900; font-size:14px; letter-spacing:0.3px;">Wave Lab</div>
        <div style="opacity:0.75; font-size:12px;">
          No interaction • Use UI controls only
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="btnPause" style="${btnStyle()}">${isPaused ? "Resume" : "Pause"}</button>
        <button id="btnStep" style="${btnStyle()}">Step</button>
        <button id="btnReset" style="${btnStyle()}">Reset</button>
      </div>
    </div>

    <div style="height:10px;"></div>

    <details open style="border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:10px;">
      <summary style="cursor:pointer; font-weight:800; font-size:12px; opacity:0.9;">Wave Controls</summary>
      <div style="height:8px;"></div>

      ${slider("Amplitude", "amplitude", 0, 3, 0.01)}
      ${slider("Frequency", "frequency", 0.1, 5, 0.01)}
      ${slider("Speed", "speed", 0.1, 8, 0.01)}

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
        ${toggle("Standing Wave", "standingWave")}
        ${toggle("Wave B (Interference)", "waveBEnabled")}
      </div>

      <div id="waveBBlock" style="margin-top:10px; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.10); display:none;">
        <div style="font-weight:800; font-size:12px; opacity:0.9; margin-bottom:8px;">Wave B</div>
        ${slider("Amp B", "ampB", 0, 3, 0.01)}
        ${slider("Freq B", "freqB", 0.1, 5, 0.01)}
        ${slider("Speed B", "speedB", 0.1, 8, 0.01)}
        ${slider("Phase B", "phaseB", -Math.PI, Math.PI, 0.01)}
      </div>
    </details>

    <div style="height:10px;"></div>

    <details style="border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:10px;">
      <summary style="cursor:pointer; font-weight:800; font-size:12px; opacity:0.9;">Visuals</summary>
      <div style="height:8px;"></div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${toggle("Grid", "showGrid")}
        ${toggle("Axes", "showAxes")}
        ${toggle("Floor", "showFloor")}
        ${toggle("Line", "showLine")}
        ${toggle("Points", "showPoints")}
      </div>

      ${slider("Point Size", "pointSize", 0.02, 0.14, 0.001)}
      ${slider("Color Intensity", "colorIntensity", 0.1, 2.5, 0.01)}

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:10px;">
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:12px; opacity:0.85;">Color Mode</div>
          <select id="selColorMode" style="${selectStyle()}">
            <option value="height">Height (blue→white→red)</option>
            <option value="solid">Solid</option>
          </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:12px; opacity:0.85;">Solid Color</div>
          <input id="inSolidColor" type="color" value="${params.solidColor}" style="${colorInputStyle()}" />
        </div>
      </div>
    </details>

    <div style="height:10px;"></div>

    <details style="border:1px solid rgba(255,255,255,0.10); border-radius:12px; padding:10px;">
      <summary style="cursor:pointer; font-weight:800; font-size:12px; opacity:0.9;">Camera</summary>
      <div style="height:8px;"></div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${toggle("Auto Rotate", "autoRotate")}
      </div>
      ${slider("Auto Rotate Speed", "autoRotateSpeed", 0.0, 2.0, 0.01)}
    </details>

    <div style="height:10px;"></div>

    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <button id="btnPresetSine" style="${btnStyle()}">Preset: Sine</button>
      <button id="btnPresetBeats" style="${btnStyle()}">Preset: Beats</button>
      <button id="btnPresetStanding" style="${btnStyle()}">Preset: Standing</button>
      <button id="btnPresetCalm" style="${btnStyle()}">Preset: Calm</button>
    </div>
  `;

  document.body.appendChild(uiRoot);

  // Buttons
  document.getElementById("btnPause").onclick = togglePause;
  document.getElementById("btnStep").onclick = () => { stepOnce = true; isPaused = true; refreshPauseBtnText(); };
  document.getElementById("btnReset").onclick = () => { resetSim(); };

  // Presets
  document.getElementById("btnPresetSine").onclick = () => applyPreset("sine");
  document.getElementById("btnPresetBeats").onclick = () => applyPreset("beats");
  document.getElementById("btnPresetStanding").onclick = () => applyPreset("standing");
  document.getElementById("btnPresetCalm").onclick = () => applyPreset("calm");

  // Bind sliders
  bindSlider("amplitude", () => {});
  bindSlider("frequency", () => {});
  bindSlider("speed", () => {});
  bindSlider("ampB", () => {});
  bindSlider("freqB", () => {});
  bindSlider("speedB", () => {});
  bindSlider("phaseB", () => {});
  bindSlider("pointSize", () => rebuildWave());
  bindSlider("colorIntensity", () => {});
  bindSlider("autoRotateSpeed", () => {});

  // Toggles
  bindToggle("standingWave", () => {});
  bindToggle("waveBEnabled", () => updateWaveBBlock());
  bindToggle("showGrid", applyAllToggles);
  bindToggle("showAxes", applyAllToggles);
  bindToggle("showFloor", applyAllToggles);
  bindToggle("showLine", applyAllToggles);
  bindToggle("showPoints", applyAllToggles);
  bindToggle("autoRotate", () => {});

  // Color mode + solid color
  const sel = document.getElementById("selColorMode");
  sel.value = params.colorMode;
  sel.onchange = () => {
    params.colorMode = sel.value;
    updateSolidColorVisibility();
  };

  const colorIn = document.getElementById("inSolidColor");
  colorIn.value = params.solidColor;
  colorIn.oninput = () => {
    params.solidColor = colorIn.value;
    applySolidColorToPoints();
  };

  updateWaveBBlock();
  updateSolidColorVisibility();
}

function slider(label, key, min, max, step) {
  return `
    <div style="display:grid; grid-template-columns: 1fr 70px; gap:10px; align-items:center; margin:8px 0;">
      <div>
        <div style="font-size:12px; opacity:0.9; margin-bottom:4px;">${label}</div>
        <input id="sl_${key}" type="range" min="${min}" max="${max}" step="${step}" value="${params[key]}"
          style="width:100%;" />
      </div>
      <div id="val_${key}" style="font-size:12px; opacity:0.85; text-align:right;">
        ${Number(params[key]).toFixed(3)}
      </div>
    </div>
  `;
}

function toggle(label, key) {
  const checked = params[key] ? "checked" : "";
  return `
    <label style="display:flex; align-items:center; gap:8px; font-size:12px; opacity:0.9; cursor:pointer;">
      <input id="tg_${key}" type="checkbox" ${checked} />
      ${label}
    </label>
  `;
}

function btnStyle() {
  return `
    cursor:pointer;
    border:1px solid rgba(255,255,255,0.14);
    background: rgba(255,255,255,0.08);
    color:#fff;
    padding:10px 12px;
    border-radius: 12px;
    font-weight: 800;
    font-size: 12px;
  `;
}

function selectStyle() {
  return `
    width:100%;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.35);
    color:#fff;
    padding: 10px 10px;
    outline: none;
  `;
}

function colorInputStyle() {
  return `
    width:100%;
    height:42px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(0,0,0,0.35);
    padding: 4px;
  `;
}

function bindSlider(key, onChange) {
  const el = document.getElementById("sl_" + key);
  const val = document.getElementById("val_" + key);
  if (!el || !val) return;

  el.addEventListener("input", () => {
    params[key] = Number(el.value);
    val.textContent = Number(params[key]).toFixed(3);
    onChange && onChange();
  });
}

function bindToggle(key, onChange) {
  const el = document.getElementById("tg_" + key);
  if (!el) return;

  el.addEventListener("change", () => {
    params[key] = !!el.checked;
    onChange && onChange();
  });
}

function updateWaveBBlock() {
  const block = document.getElementById("waveBBlock");
  if (block) block.style.display = params.waveBEnabled ? "block" : "none";
}

function updateSolidColorVisibility() {
  const colorInput = document.getElementById("inSolidColor");
  if (colorInput) colorInput.disabled = (params.colorMode !== "solid");
  applySolidColorToPoints();
}

function applySolidColorToPoints() {
  if (params.colorMode !== "solid") return;
  const col = new THREE.Color(params.solidColor);
  for (const p of points) {
    if (p.material && p.material.color) p.material.color.copy(col);
  }
}

function togglePause() {
  isPaused = !isPaused;
  refreshPauseBtnText();
}

function refreshPauseBtnText() {
  const btn = document.getElementById("btnPause");
  if (btn) btn.textContent = isPaused ? "Resume" : "Pause";
}

function syncUI() {
  const keys = ["showGrid","showAxes","showFloor","showLine","showPoints","autoRotate","standingWave","waveBEnabled"];
  for (const k of keys) {
    const el = document.getElementById("tg_" + k);
    if (el) el.checked = !!params[k];
  }
  updateWaveBBlock();
}

/**********************************************************************
 * WAVE UPDATE (analytic)
 **********************************************************************/
function resetSim() {
  // no impulses anymore, so reset is just a redraw (kept for UI consistency)
}

function rebuildWave() {
  buildWave();
  applyAllToggles();
}

function applyAllToggles() {
  if (gridHelper) gridHelper.visible = !!params.showGrid;
  if (axesHelper) axesHelper.visible = !!params.showAxes;
  if (floorMesh) floorMesh.visible = !!params.showFloor;
  if (line) line.visible = !!params.showLine;
  for (const p of points) p.visible = !!params.showPoints;
}

function waveY(i, t) {
  const x = i * 0.25; // param-space x (not world x)
  const a = params.amplitude;
  const f = params.frequency;
  const s = params.speed;

  if (params.standingWave) {
    return a * Math.sin(x * f) * Math.sin(t * s);
  }

  let y = Math.sin(x * f + t * s) * a;

  if (params.waveBEnabled) {
    y += Math.sin(x * params.freqB + t * params.speedB + params.phaseB) * params.ampB;
  }

  return y;
}

function updateWave() {
  const t = clock.getElapsedTime();

  if (params.autoRotate) {
    orbitYaw += params.autoRotateSpeed * 0.0025;
    updateCamera();
  }

  for (let i = 0; i < points.length; i++) {
    const y = waveY(i, t);
    points[i].position.y = y;
    applyPointColor(i, y);
  }

  updateLineGeometry();
}

function applyPointColor(i, y) {
  const p = points[i];
  if (!p.material || !p.material.color) return;

  if (params.colorMode === "solid") {
    p.material.color.set(params.solidColor);
    return;
  }

  // "velocity" mode removed since we removed impulses; keep menu simple.
  if (params.colorMode === "height") {
    const t = clamp((y * 0.45 * params.colorIntensity) + 0.5, 0, 1);
    const r = t < 0.5 ? lerp(0.25, 1.0, t * 2) : 1.0;
    const g = t < 0.5 ? lerp(0.35, 1.0, t * 2) : lerp(1.0, 0.35, (t - 0.5) * 2);
    const b = t < 0.5 ? 1.0 : lerp(1.0, 0.25, (t - 0.5) * 2);
    p.material.color.setRGB(r, g, b);
  }
}

function updateLineGeometry() {
  if (!line) return;
  const attr = line.geometry.getAttribute("position");
  for (let i = 0; i < points.length; i++) {
    const p = points[i].position;
    attr.setXYZ(i, p.x, p.y, p.z);
  }
  attr.needsUpdate = true;
}

/**********************************************************************
 * CAMERA (only via autoRotate)
 **********************************************************************/
function updateCamera() {
  const x = Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitRadius;
  const z = Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitRadius;
  const y = Math.sin(orbitPitch) * orbitRadius + 4.8;

  camera.position.set(x, y, z);
  camera.lookAt(0, 0.4, 0);
}

/**********************************************************************
 * LOOP
 **********************************************************************/
function animate() {
  requestAnimationFrame(animate);

  clock.getDelta(); // keep clock advancing consistently

  if (!isPaused || stepOnce) {
    updateWave();
    stepOnce = false;
  }

  renderer.render(scene, camera);
}

/**********************************************************************
 * RESIZE
 **********************************************************************/
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**********************************************************************
 * PRESETS
 **********************************************************************/
function applyPreset(name) {
  if (name === "sine") {
    Object.assign(params, {
      amplitude: 1.2, frequency: 1.6, speed: 2.2,
      standingWave: false,
      waveBEnabled: false,
      colorMode: "height"
    });
  }

  if (name === "beats") {
    Object.assign(params, {
      amplitude: 1.0, frequency: 1.55, speed: 2.0,
      waveBEnabled: true, ampB: 0.95, freqB: 1.60, speedB: 2.0, phaseB: 0.8,
      standingWave: false,
      colorMode: "height"
    });
  }

  if (name === "standing") {
    Object.assign(params, {
      amplitude: 1.6, frequency: 1.3, speed: 2.5,
      standingWave: true,
      waveBEnabled: false,
      colorMode: "height"
    });
  }

  if (name === "calm") {
    Object.assign(params, {
      amplitude: 0.7, frequency: 1.1, speed: 1.4,
      standingWave: false,
      waveBEnabled: false,
      colorMode: "solid",
      solidColor: "#7bd3ff"
    });
  }

  applyAllToggles();
  updateWaveBBlock();
  updateSolidColorVisibility();
  syncUI();
  refreshAllSliderLabels();
}

function refreshAllSliderLabels() {
  const sliderKeys = [
    "amplitude","frequency","speed",
    "ampB","freqB","speedB","phaseB",
    "pointSize","colorIntensity","autoRotateSpeed"
  ];

  for (const k of sliderKeys) {
    const sl = document.getElementById("sl_" + k);
    const val = document.getElementById("val_" + k);
    if (sl) sl.value = params[k];
    if (val) val.textContent = Number(params[k]).toFixed(3);
  }

  const sel = document.getElementById("selColorMode");
  if (sel) sel.value = params.colorMode;

  const colorIn = document.getElementById("inSolidColor");
  if (colorIn) colorIn.value = params.solidColor;
}

/**********************************************************************
 * UTILS
 **********************************************************************/
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
