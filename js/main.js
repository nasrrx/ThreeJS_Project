// js/main.js
// NOTE: No imports here. THREE is global from the script tags in index.html.

/**********************************************************************
 * GLOBALS – CORE THREE OBJECTS
 **********************************************************************/
let scene, camera, renderer;
let controls;
let raycaster, pointer;
const clickableObjects = [];

let bouncingSphere;
let spinningTorus;
let rotatingCube;

const clock = new THREE.Clock();

/**********************************************************************
 * ENTRY POINT
 **********************************************************************/
init();
animate();

/**********************************************************************
 * INIT – Setup scene, camera, lights, objects, controls, raycasting
 **********************************************************************/
function init() {
  /*********** SCENE ***********/
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);

  /*********** CAMERA ***********/
  const aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
  camera.position.set(8, 6, 10);
  camera.lookAt(0, 1, 0);

  /*********** RENDERER ***********/
  const canvas = document.getElementById("app");
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /*********** LIGHTING ***********/
  const ambientLight = new THREE.AmbientLight(0x404040, 0.9);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 10, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x88c0ff, 0.8, 15, 2);
  pointLight.position.set(-5, 4, -3);
  scene.add(pointLight);

  /*********** GROUND PLANE (TEXTURED) ***********/
  const textureLoader = new THREE.TextureLoader();

  // Optional: Put an image at textures/ground_diffuse.jpg
  let groundTexture = textureLoader.load(
    "./textures/ground_diffuse.jpg",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      tex.anisotropy = 4;
    },
    undefined,
    () => {
      // If texture fails to load, set to null -> material will just use color
      groundTexture = null;
    }
  );

  const groundMaterial = new THREE.MeshStandardMaterial({
    map: groundTexture || null,
    roughness: 0.8,
    metalness: 0.1,
    color: 0x202020,
  });

  const groundGeometry = new THREE.PlaneGeometry(30, 30);
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  /*********** COLOR PALETTE ***********/
  const COLORS = {
    accentOrange: 0xffb347,
    accentBlue: 0x4ea9ff,
    accentGreen: 0x7ccf7f,
    accentPink: 0xff6fa4,
    cubeBase: 0x223049,
    wall: 0x2b2f3a,
  };

  /*********** ROTATING CUBE (MeshPhongMaterial) ***********/
  const cubeGeometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const cubeMaterial = new THREE.MeshPhongMaterial({
    color: COLORS.cubeBase,
    shininess: 80,
    specular: new THREE.Color(0xffffff),
  });
  rotatingCube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  rotatingCube.position.set(-3, 1, 0);
  rotatingCube.castShadow = true;
  rotatingCube.receiveShadow = true;
  scene.add(rotatingCube);
  clickableObjects.push(rotatingCube);

  /*********** BOUNCING SPHERE (MeshLambertMaterial) ***********/
  const sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);
  const sphereMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.accentBlue,
  });
  bouncingSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  bouncingSphere.position.set(0, 1, 0);
  bouncingSphere.castShadow = true;
  bouncingSphere.receiveShadow = true;
  scene.add(bouncingSphere);
  clickableObjects.push(bouncingSphere);

  /*********** SPINNING TORUS (MeshStandardMaterial) ***********/
  const torusGeometry = new THREE.TorusGeometry(1, 0.25, 16, 100);
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.accentOrange,
    roughness: 0.3,
    metalness: 0.7,
  });
  spinningTorus = new THREE.Mesh(torusGeometry, torusMaterial);
  spinningTorus.position.set(3, 1.5, 0);
  spinningTorus.castShadow = true;
  spinningTorus.receiveShadow = true;
  scene.add(spinningTorus);
  clickableObjects.push(spinningTorus);

  /*********** WALL (Collision Concept) ***********/
  const wallGeometry = new THREE.BoxGeometry(0.3, 2.5, 6);
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: COLORS.wall,
    roughness: 0.9,
    metalness: 0.0,
  });
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.position.set(0, 1.25, -4);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
  clickableObjects.push(wall);

  /*********** ENERGY CONE ***********/
  const coneGeometry = new THREE.ConeGeometry(0.7, 1.6, 32);
  const coneMaterial = new THREE.MeshLambertMaterial({
    color: COLORS.accentPink,
    emissive: new THREE.Color(0x2b001f),
  });
  const energyCone = new THREE.Mesh(coneGeometry, coneMaterial);
  energyCone.position.set(-1.5, 0.8, 3);
  energyCone.castShadow = true;
  energyCone.receiveShadow = true;
  scene.add(energyCone);
  clickableObjects.push(energyCone);

  /*********** ORBIT CONTROLS ***********/
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.target.set(0, 1, 0);
  controls.update();

  /*********** RAYCASTING ***********/
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  window.addEventListener("pointerdown", onPointerDown);

  /*********** RESIZE ***********/
  window.addEventListener("resize", onWindowResize);
}

/**********************************************************************
 * RESIZE HANDLER
 **********************************************************************/
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

/**********************************************************************
 * POINTER DOWN – RAYCAST CLICK
 **********************************************************************/
function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(clickableObjects, false);

  if (intersects.length > 0) {
    const hit = intersects[0].object;
    hit.material.color.setHex(Math.random() * 0xffffff);
  }
}

/**********************************************************************
 * ANIMATION LOOP
 **********************************************************************/
function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();

  // Bouncing sphere: simple periodic motion
  if (bouncingSphere) {
    const amplitude = 0.6;
    const baseline = 1.0;
    const frequency = 1.5;
    bouncingSphere.position.y =
      baseline + Math.abs(Math.sin(elapsed * frequency)) * amplitude;
  }

  // Spinning torus
  if (spinningTorus) {
    spinningTorus.rotation.x += 0.01;
    spinningTorus.rotation.y += 0.02;
  }

  // Rotating cube
  if (rotatingCube) {
    rotatingCube.rotation.y += 0.015;
    rotatingCube.rotation.x += 0.005;
  }

  // Smooth camera movement
  controls.update();

  renderer.render(scene, camera);
}
