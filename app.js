// 1. Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

// Set the sky (background) color to white
renderer.setClearColor(0xffffff, 1);  // Set clear color to white

document.body.appendChild(renderer.domElement);

// 2. Set up the gun (visible in first-person view)
let gun, bullet;
let isShooting = false;

// Gun geometry (simplified, held by the player)
const gunGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.2);
const gunMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
gun = new THREE.Mesh(gunGeometry, gunMaterial);
gun.position.set(0, -0.5, -1); // Gun in front of the camera (first person)
camera.add(gun); // Attach gun to the camera

// 3. Set up the plane (grey ground)
const planeGeometry = new THREE.PlaneGeometry(100, 100); // Large ground plane
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide }); // Grey material
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
plane.position.y = -2; // Place the plane below the camera
scene.add(plane);

// 4. Set up the wall for collision and damage
const wallGeometry = new THREE.BoxGeometry(5, 5, 1);
const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
const wall = new THREE.Mesh(wallGeometry, wallMaterial);
wall.position.set(0, 0, -10);
scene.add(wall);

// 5. Set up the bullet
const bulletGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

// 6. Setup camera and controls
const controls = new THREE.PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => controls.lock());

// 7. Smoke effect
let smokeParticles = [];

function createSmoke(position) {
  const smokeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
  const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
  smoke.position.set(position.x, position.y, position.z);
  scene.add(smoke);
  smokeParticles.push(smoke);
}

// 8. Shoot function to simulate shooting and collision
function shoot() {
  if (!isShooting) {
    isShooting = true;
    
    // Set bullet position and direction
    bullet.position.set(gun.position.x, gun.position.y + 0.1, gun.position.z);
    bullet.velocity = new THREE.Vector3(0, 0, -1).normalize();

    // Create smoke effect
    createSmoke(gun.position);

    setTimeout(() => isShooting = false, 300); // Bullet cooldown (time between shots)
  }
}

// 9. Bullet update loop
function updateBullet() {
  if (bullet.position.z < -20) {
    bullet.position.set(0, -0.5, -2); // Reset bullet after leaving view
  } else {
    bullet.position.add(bullet.velocity);
    
    // Check collision with the wall
    if (bullet.position.distanceTo(wall.position) < 1) {
      wall.material.color.set(0xFF6347); // Change color on damage (for simplicity)
      bullet.position.set(0, -0.5, -2); // Reset bullet position
    }
  }
}

// 10. Render and animate the scene
function animate() {
  requestAnimationFrame(animate);
  updateBullet();
  renderer.render(scene, camera);
}

// 11. Resize listener for responsiveness
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// 12. Handle mouse movement and shooting
document.addEventListener('click', shoot);

// Start the animation loop
animate();
