// fps.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js";

/**
 * Creates an FPS mode (separate scene group) with:
 * - Pointer lock mouse look
 * - WASD movement (camera)
 * - Left click to shoot
 * - Simple rigid-body targets that get impulse on hit
 *
 * Usage:
 *   const fps = createFPSMode({ scene, renderer, camera });
 *   fps.setActive(true/false);
 *   fps.update(dt);
 *   fps.dispose();
 */
export function createFPSMode({ scene, renderer, camera }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- internal state ----
  let active = false;
  let isPointerLocked = false;

  let yaw = 0;
  let pitch = 0;

  const move = { w: false, a: false, s: false, d: false };
  const moveSpeed = 6;

  const bullets = [];     // { mesh, vel, radius, life }
  const rigidBodies = []; // { mesh, vel, radius, mass }

  // ---- world ----
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x202026 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  group.add(floor);

  // simple “range” targets
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const box = new THREE.Mesh(boxGeo, mat);
    box.castShadow = true;
    box.position.set((Math.random() - 0.5) * 18, 1 + Math.random() * 2, -8 - Math.random() * 22);
    group.add(box);

    rigidBodies.push({
      mesh: box,
      vel: new THREE.Vector3(),
      radius: 0.75,
      mass: 2
    });
  }

  // ---- helpers ----
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function getForwardOnXZ() {
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() > 0) f.normalize();
    return f;
  }

  function getRightOnXZ() {
    const f = getForwardOnXZ();
    return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(-1);
  }

  function shoot() {
    const bulletRadius = 0.12;
    const geo = new THREE.SphereGeometry(bulletRadius, 12, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffdd88 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    mesh.position.copy(camera.position).add(dir.clone().multiplyScalar(0.8));
    group.add(mesh);

    const speed = 22;
    bullets.push({
      mesh,
      vel: dir.multiplyScalar(speed),
      radius: bulletRadius,
      life: 2.0 // seconds
    });
  }

  function tryHitRigidBodies(bullet) {
    // simple sphere vs sphere approximation
    for (const rb of rigidBodies) {
      const pB = bullet.mesh.position;
      const pR = rb.mesh.position;
      const r = bullet.radius + rb.radius;

      if (pB.distanceToSquared(pR) <= r * r) {
        // impulse in bullet direction
        const impulse = bullet.vel.clone().normalize().multiplyScalar(6);
        rb.vel.add(impulse.divideScalar(rb.mass));

        // remove bullet
        bullet.life = -1;
        group.remove(bullet.mesh);
        return true;
      }
    }
    return false;
  }

  // ---- input handlers ----
  function onPointerLockChange() {
    isPointerLocked = (document.pointerLockElement === renderer.domElement);
  }

  function onMouseMove(e) {
    if (!active || !isPointerLocked) return;

    const sensitivity = 0.002;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;

    const limit = Math.PI / 2 - 0.01;
    pitch = clamp(pitch, -limit, limit);
  }

  function onMouseDown(e) {
    if (!active) return;
    if (e.button !== 0) return;

    if (!isPointerLocked) {
      renderer.domElement.requestPointerLock();
      return;
    }
    shoot();
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.code === "KeyW") move.w = true;
    if (e.code === "KeyA") move.a = true;
    if (e.code === "KeyS") move.s = true;
    if (e.code === "KeyD") move.d = true;

    // Esc releases pointer lock naturally; no need to handle
  }

  function onKeyUp(e) {
    if (!active) return;
    if (e.code === "KeyW") move.w = false;
    if (e.code === "KeyA") move.a = false;
    if (e.code === "KeyS") move.s = false;
    if (e.code === "KeyD") move.d = false;
  }

  // Register listeners once (we gate by `active`)
  document.addEventListener("pointerlockchange", onPointerLockChange);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---- public API ----
  function setActive(v) {
    active = !!v;
    group.visible = active;

    // Optional: when leaving FPS, exit pointer lock
    if (!active && document.pointerLockElement === renderer.domElement) {
      document.exitPointerLock();
    }

    // When entering FPS, align yaw/pitch to current camera direction
    if (active) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      // yaw from x/z, pitch from y
      yaw = Math.atan2(-dir.x, -dir.z);
      pitch = Math.asin(dir.y);
    }
  }

  function update(dt) {
    if (!active) return;

    // Apply look
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    // Move camera with WASD on XZ
    const f = getForwardOnXZ();
    const r = getRightOnXZ();

    const v = new THREE.Vector3();
    if (move.w) v.add(f);
    if (move.s) v.sub(f);
    if (move.d) v.add(r);
    if (move.a) v.sub(r);

    if (v.lengthSq() > 0) {
      v.normalize().multiplyScalar(moveSpeed * dt);
      camera.position.add(v);
    }

    // Keep camera above floor a bit
    if (camera.position.y < 1.6) camera.position.y = 1.6;

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      if (b.life <= 0) {
        group.remove(b.mesh);
        bullets.splice(i, 1);
        continue;
      }

      b.mesh.position.add(b.vel.clone().multiplyScalar(dt));

      // Hit check
      if (tryHitRigidBodies(b)) {
        bullets.splice(i, 1);
        continue;
      }
    }

    // Update rigid bodies (very lightweight “physics”)
    const gravity = -9.8;
    for (const rb of rigidBodies) {
      rb.vel.y += gravity * dt;
      rb.mesh.position.add(rb.vel.clone().multiplyScalar(dt));

      // floor collision
      const floorY = 0.5; // half box height
      if (rb.mesh.position.y < floorY) {
        rb.mesh.position.y = floorY;
        if (rb.vel.y < 0) rb.vel.y *= -0.35; // bounce damping
        rb.vel.x *= 0.92; // friction-ish
        rb.vel.z *= 0.92;
      }

      // air drag
      rb.vel.multiplyScalar(0.995);
    }
  }

  function dispose() {
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);

    scene.remove(group);
  }

  return { group, setActive, update, dispose };
}
