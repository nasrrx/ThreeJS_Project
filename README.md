# Physics Playground – CSCI452 Project Phase 1

## 1. Project Description & Objectives

**Project Title:** Physics Playground – Gravity, Collisions, and Projectile Motion in Three.js

This project is an interactive 3D physics playground built with **Three.js (WebGL)**.  
It demonstrates:

- Basic **3D scene setup** (scene, camera, renderer, lights, geometries).
- **User interaction** with objects via raycasting (mouse picking) and keyboard movement.
- Multiple **physics-related behaviors**: gravity, bouncing, collisions, and projectile motion.
- Different **materials, lighting setups, and textured ground** to represent different planets.

The main goal is to create a **small, self-contained environment** where the user can:

- Click on objects to select them and apply gravity.
- Move the selected object around while respecting simple collision constraints.
- Spawn falling spheres and projectiles with custom speed and angle.
- Switch gravity presets (Earth / Moon / Jupiter) and see how motion changes physically and visually (floor texture).

---

## 2. Physics Use Cases Demonstrated

The scene is designed around **three core physics concepts**:

### 2.1 Gravity & Planetary Gravitation

- The project uses **three gravity presets**: `earth`, `moon`, and `jupiter`, with realistic relative gravitational accelerations.
- When you:
  - Click an object and press **“Simulate Gravity on Last Clicked”**, that object falls under the currently selected gravity preset.
  - Spawn falling spheres / projectiles, they also use the current gravity value.
- The **floor texture** changes based on the gravity preset:
  - Earth gravity → Earth ground texture  
  - Jupiter gravity → Jupiter ground texture  
  - Moon gravity → Moon texture used as a placeholder lunar surface  

This illustrates how **the same object behaves differently under different gravitational fields**.

---

### 2.2 Projectile Motion

- The **Projectile Launcher** section of the UI lets you spawn projectiles with:
  - Initial **speed** (units/second)
  - **Elevation angle** (vertical launch angle in degrees)
  - **Horizontal angle** (yaw in the XZ-plane)
  - Extra vertical acceleration (to tweak or offset gravity)
- The projectile’s motion is computed using:
  - A **velocity vector** with horizontal and vertical components based on the angles.
  - A constant **acceleration vector** combining gravity and any extra acceleration.
- The projectile moves in full 3D (x, y, z) and stops when it hits the ground plane.

This demonstrates classical **2D/3D projectile motion** under gravity, extended to full 3D space with configurable launch parameters.

---

### 2.3 Collisions & Bouncing

- **Single-object gravity simulation**:
  - The last clicked object falls toward the ground.
  - When it reaches the floor (plane), it **bounces** with a reduced velocity (damped bounce).
  - After energy decays below a threshold, it stops bouncing and its normal animation resumes.

- **Dynamic falling spheres**:
  - Spawned spheres fall under gravity and bounce on the floor until they come to rest.

- **WASD movement collision**:
  - When you move the last clicked object with WASD, a simple **sphere-like collision check** prevents it from overlapping other objects (sphere, torus, cube, wall, cone).
  - Collisions are approximated using bounding boxes → converted to a “radius” for each object.

This showcases **basic collision response** (no penetration) and **inelastic bounces** (energy loss on each impact).

---

## 3. Implementation Plan – Sequence of Steps

This section describes the logical sequence that was followed to implement the project.

### Step 1 – Core Three.js Setup

1. Initialize a **Three.js scene** with `scene = new THREE.Scene()`.
2. Create a **PerspectiveCamera** and position it using spherical coordinates (`THREE.Spherical`), looking at a central target.
3. Create a **WebGLRenderer**, enable shadows, resize it to the window, and append it to `document.body`.
4. Add **window resize** handling to keep aspect ratio and renderer size correct.

### Step 2 – Lights, Plane, and Base Objects

1. Add multiple lights:
   - `AmbientLight` for base illumination.
   - `DirectionalLight` for strong lighting and shadows.
   - `PointLight` for local highlights.
2. Create a **ground plane** using `PlaneGeometry` and `MeshStandardMaterial`, oriented horizontally at `y = 0`.
3. Add main objects:
   - **Bouncing sphere** (`SphereGeometry`)
   - **Spinning torus** (`TorusGeometry`)
   - **Rotating cube** (`BoxGeometry`)
   - **Wall** (thin `BoxGeometry` acting as an obstacle)
   - **Cone** that can switch between opaque and glass-like rendering
4. Add an `AxesHelper` for orientation and push all appropriate meshes into `clickableObjects` for raycasting and collision.

### Step 3 – Camera Orbit & Input Handling

1. Implement **manual orbit controls** using:
   - Mouse drag → update spherical coordinates (`theta` and `phi`).
   - Mouse wheel → zoom in/out by modifying spherical radius.
2. Convert spherical coordinates back into Cartesian position and update camera each frame.
3. Capture **keyboard input (W, A, S, D)** to move the last clicked object relative to camera-forward and camera-right vectors.

### Step 4 – Raycasting & Object Selection

1. Create a `Raycaster` and a normalized device coordinate `Vector2` for the mouse.
2. On `click`:
   - Convert the mouse position to NDC.
   - Use `raycaster.intersectObjects(clickableObjects)` to find the object under the cursor.
   - Set the object’s color to a random color.
   - Store it as `lastClickedObject` and update the “Last clicked” UI label.
3. Reset any ongoing gravity simulation on previously selected objects when a new object is selected.

### Step 5 – Gravity System

1. Define `gravityPresets` for Earth, Moon, and Jupiter.
2. Maintain `currentGravityPreset` and update it when the user changes the dropdown.
3. For **single-object gravity**:
   - When the button is clicked, compute a **floor height** based on the object’s bounding box.
   - Enable gravity for that object:
     - Integrate `velocityY += g * delta` each frame.
     - Integrate position `y += velocityY * delta`.
     - On ground contact, apply bounce with damping.
4. For **spawned falling spheres**, reuse similar vertical gravity integration and bounce logic until they naturally come to rest.

### Step 6 – Projectile Motion

1. Create UI inputs for:
   - Speed
   - Elevation angle
   - Horizontal angle
   - Extra vertical acceleration
2. When “Spawn Projectile” is clicked:
   - Compute an initial velocity vector from the input speed and angles.
   - Combine **planet gravity + extra acceleration** into a single acceleration vector.
   - Use `delta` integration each frame:
     - `v += a * delta`
     - `position += v * delta`
   - Stop the projectile when it reaches ground (y ≤ radius).

### Step 7 – Collision-Aware Movement

1. Implement `getApproxRadius(object)` using the object’s bounding box.
2. In `updateLastClickedMovement(delta)`:
   - Compute the desired displacement based on WASD input and camera orientation.
   - Predict the **new position** for the selected object.
   - For each other object in `clickableObjects`, compute the distance between centers and compare with the sum of approximate radii plus a margin.
   - If too close, **block movement**; otherwise apply the displacement.

### Step 8 – Materials, Glass Effect & Textures

1. Use **MeshStandardMaterial** for most objects to react correctly to lights and shadows.
2. Implement `toggleGlassMode()`:
   - On first activation, switch the cone to a `MeshPhysicalMaterial` (if available) with transparency, transmission, and clearcoat to approximate glass.
   - On second activation, restore the original solid material.
3. Implement `setPlanetFloor(planet)`:
   - Load textures `EarthTexture.png`, `JupiterTexture.jpg`, `MoonTexture.jpg`.
   - Wrap and repeat them to tile across the plane.
   - Update `plane.material.map` and `plane.material.color`.
   - Call `setPlanetFloor("earth")` in `init()` and also whenever gravity preset changes.

### Step 9 – Animation Loop

1. Use `requestAnimationFrame(animate)` for the main render loop.
2. On each frame:
   - Get `delta` time from a `Clock`.
   - Update the bouncing sphere, spinning torus, and rotating cube (if their animations are not paused by gravity).
   - Update gravity simulations (single object and dynamic falling spheres).
   - Update projectile motion.
   - Update movement & collisions for the last clicked object.
   - Render the scene with `renderer.render(scene, camera)`.

---

## 4. File Descriptions

### `index.html`

- Minimal HTML file that:
  - Sets up the page `<head>` and `<body>`.
  - Loads `main.js` as a module.
- The WebGL canvas is created by `main.js` and **appended to the body**.

Typical structure:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Physics Playground</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script type="module" src="main.js"></script>
  </head>
  <body></body>
</html>
```

### `main.js`

- The main JavaScript module that contains:
  - Scene, camera, renderer initialization.
  - Lighting, ground plane, and geometry creation.
  - UI creation (buttons, dropdowns, labels).
  - Raycasting logic for selecting objects.
  - Gravity simulation, falling spheres and projectile logic.
  - WASD movement with collision.
  - Floor texture switching based on gravity preset.
  - Animation/render loop.

### `EarthTexture.png`

- Image file used as the **ground texture when gravity preset is Earth**.
- Applied to the plane via `setPlanetFloor("earth")`.

### `JupiterTexture.jpg`

- Image file used as the **ground texture when gravity preset is Jupiter**.

### `MoonTexture.jpg`

- Image file used as the **ground texture when gravity preset is Moon** (placeholder lunar surface) or directly via `setPlanetFloor("Moon")` if extended later.

### `README.md`

- This documentation file.
- Explains:
  - Project purpose and physics concepts.
  - Implementation steps.
  - How to run and extend the project.
  - How it satisfies the CSCI452 Phase 1 guidelines.

---

## 5. Project Setup & Running Instructions

### 5.1 Requirements

- A **modern web browser** that supports ES modules and WebGL (e.g. Chrome, Firefox, Edge).
- An **internet connection** (for loading Three.js from the CDN):
  ```js
  import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.117.1/build/three.module.js";
  ```
- A simple **HTTP server** (recommended) instead of opening the HTML file directly, to avoid CORS issues with modules and textures.

### 5.2 Folder Structure

Place files like this:

```text
project-root/
  index.html
  main.js
  EarthTexture.png
  JupiterTexture.jpg
  MoonTexture.jpg
  README.md
```

If you prefer a `textures/` folder, update `setPlanetFloor()` paths accordingly.

### 5.3 Running the Project

You have several options:

#### Option A – VS Code Live Server (Recommended)

1. Open the project folder in **Visual Studio Code**.
2. Install the **“Live Server”** extension (if not already installed).
3. Right-click `index.html` → **“Open with Live Server”**.
4. Your default browser will open the scene at a URL like `http://127.0.0.1:5500/`.

#### Option B – Python Simple HTTP Server

From the project root:

```bash
# Python 3
python -m http.server 8000
```

Then open in your browser:

```
http://localhost:8000/index.html
```

#### Option C – Any Other Static Server

Use any local static server (Node `http-server`, XAMPP, etc.) and point it to the project root.

---

## 6. Controls & Interactions

### Camera

- **Left mouse drag** – orbit around the scene.
- **Mouse wheel** – zoom in/out.
- Camera orbit is implemented manually using `THREE.Spherical`.

### Object Selection & Movement

- **Click** any object (sphere, torus, cube, wall, cone) to:
  - Change its color randomly.
  - Set it as the **“Last clicked”** object.
- **W / A / S / D** – move the last clicked object on the ground plane:
  - Movement is relative to the camera’s forward/right directions.
  - Simple collision prevents objects from overlapping.

### Gravity Tools (UI Panel)

- **Preset dropdown**: Earth / Moon / Jupiter
  - Changes `currentGravityPreset`.
  - Changes the ground texture to match the selected body (Earth / Jupiter / Moon-as-Moon).
- **Simulate Gravity on Last Clicked**:
  - Applies gravity to the currently selected object.
  - Object falls, bounces, and then stops; its original animation resumes.

### Projectile Launcher (UI Panel)

- **Speed** – initial speed of the projectile.
- **Elev Angle (°)** – launch angle above the horizontal.
- **Horiz Angle (°)** – direction in the XZ plane.
- **Extra Acc Y** – add/subtract vertical acceleration on top of gravity.
- **Spawn Projectile** – creates a projectile (small sphere) from:
  - The last clicked object’s position (if any), or
  - A default position near the origin.
- **Clear Projectiles** – removes all spawned projectiles from the scene.

### Spawn Objects (UI Panel)

- **Spawn Falling Sphere** – spawns a small sphere at random X/Z and height; it:
  - Falls under the current gravity preset.
  - Bounces until it comes to rest.

### Animation Speed (UI Panel)

- **Target** – Sphere / Torus / Cube / All
- **Multiplier** – scales the object’s animation speed (bounce frequency or rotation speed).
- **Apply** – updates the speedFactors for the selected target(s).

### Visual Effects (UI Panel)

- **Toggle Glass Mode (Cone)**:
  - Switches the cone between:
    - Solid colored material (standard).
    - Glass-like physical material (transparent, refractive-like).

### Selected Object Info (UI Panel)

- Shows the **name of the last clicked object** (Sphere, Torus, Cube, Wall, Cone).

---

## 7. How This Meets the CSCI452 Phase 1 Requirements

### Technical & Structural Requirements

1. **Scene Initialization**  
   - `scene`, `camera`, `renderer` correctly created in `init()` and rendered in `animate()`.

2. **Rendering Loop**  
   - `animate()` uses `requestAnimationFrame` and updates all animations and physics.

3. **Basic Interactivity**  
   - Mouse click selection (raycasting).
   - Camera orbit with mouse drag & wheel zoom.
   - WASD movement for last clicked object.

4. **Geometry**  
   - At least four distinct geometries:
     - `PlaneGeometry` (ground)
     - `SphereGeometry` (bouncing sphere + projectiles + falling spheres)
     - `TorusGeometry` (donut)
     - `BoxGeometry` (cube + wall)
     - `ConeGeometry` (energy cone)

5. **Lighting**  
   - Multiple light types:
     - `AmbientLight`
     - `DirectionalLight`
     - `PointLight`
   - Shadows enabled on the renderer, lights, and objects where appropriate.

6. **Code Structure & Comments**  
   - Clear separation into:
     - Initialization (`init`, `createUI`, camera setup)
     - Input handlers (mouse, keyboard)
     - Physics (gravity, projectiles, movement)
     - Rendering (`animate`)
   - Functions and globals named meaningfully (e.g., `spawnProjectile`, `setPlanetFloor`, `updateLastClickedMovement`).

7. **Raycasting / Interaction**  
   - `Raycaster` used in `onClick()` to detect clicked objects.
   - Interaction:
     - Color change on click.
     - Selection of object for movement and gravity.
     - Collision-aware movement with WASD.

---

### Visual & Creative Requirements

1. **Material Variety**  
   - Uses:
     - `MeshStandardMaterial` (on main objects & ground).
     - `MeshPhysicalMaterial` (for glass cone, when enabled).
   - Different visual properties (metalness, roughness, transparency) demonstrated.

2. **Color Palette**  
   - Cohesive palette:
     - Warm orange torus
     - Cool blue sphere
     - Pink cone
     - Darker wall & base plane
   - Colors specified as hex codes (e.g., `0xffb347`, `0x4ea9ff`).

3. **Texture Mapping**  
   - Ground plane uses external textures:
     - `EarthTexture.png`
     - `JupiterTexture.jpg`
     - `MoonTexture.jpg`
   - Loaded at runtime and tiled using `RepeatWrapping`.

4. **Continuous Animation**  
   - Sphere: continuous bouncing.
   - Torus: continuous spinning.
   - Cube: continuous rotation.
   - All animations run in the main render loop and can be slowed/sped up by the user.

5. **Scene Theme**  
   - Theme: **“Physics Playground on Planetary Surfaces”**
     - Central platform with abstract geometric objects.
     - Different planets represented via ground textures and gravity presets.
     - Projectiles and falling spheres showcase behavior under different gravities.
