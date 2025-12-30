# Wave Lab — Mathematical & Physical Explanation

This document explains **all mathematical and physical concepts** used in the Wave Lab project.
It focuses on **wave physics and visualization**, not rendering or UI code.

---

## 1. Core Wave Equation

A traveling wave is described by:

```
y(x, t) = A · sin(kx + ωt)
```

Where:
- **A (Amplitude)** — maximum displacement
- **k (Spatial frequency)** — how fast the wave oscillates in space
- **ω (Angular frequency)** — how fast the wave oscillates in time

---

## 2. Amplitude

Amplitude controls the **maximum vertical displacement** from equilibrium.

- Higher amplitude → more energy
- Lower amplitude → calmer wave
- Amplitude does **not** affect speed or wavelength

In the code, amplitude multiplies the sine function directly.

---

## 3. Frequency

Frequency determines **how many oscillations appear per unit distance**.

- Higher frequency → shorter wavelength
- Lower frequency → longer wavelength

Mathematically:
```
λ = 2π / k
```

---

## 4. Wave Speed

Wave speed controls **how fast the phase travels over time**.

- This is **phase velocity**
- It does **not** move objects, only the oscillation pattern

---

## 5. Standing Waves

Standing waves are produced by:

```
y(x,t) = A · sin(kx) · sin(ωt)
```

Properties:
- Fixed nodes (zero movement)
- Energy oscillates locally
- Common in strings and pipes

---

## 6. Wave Interference (Wave B)

When two waves overlap, their displacements add:

```
y_total = y₁ + y₂
```

This causes:
- Constructive interference (amplitudes add)
- Destructive interference (amplitudes cancel)

Wave B introduces a second sine term with slightly different parameters.

---

## 7. Beats

Beats occur when two frequencies are close:

```
f_beat = |f₁ - f₂|
```

This produces slow amplitude modulation visible as pulsing.

---

## 8. Impulse Physics

Click impulses simulate a localized disturbance.

Implemented using a **spring-damper model**:
- Spring pulls displacement back to zero
- Damping removes energy over time

This approximates real-world ripples.

---

## 9. Damping

Damping reduces oscillation over time:

```
v = v · (1 - damping)
```

Effects:
- Prevents infinite oscillation
- Models friction / energy loss

---

## 10. Color Mapping

Wave data is mapped to color for visualization:

### Height-based
- Blue → White → Red
- Shows displacement

### Velocity-based
- Green → Yellow → Red
- Shows motion intensity

This converts numeric data into visual intuition.

---

## 11. Camera Mathematics

The camera uses spherical coordinates:

```
x = cos(yaw) · cos(pitch) · r
y = sin(pitch) · r
z = sin(yaw) · cos(pitch) · r
```

Converted to Cartesian space each frame.

---

## 12. Clamping

Clamping limits values:

```
clamp(v, min, max)
```

Used to:
- Prevent numerical instability
- Avoid extreme camera or wave values

---

## Summary

Wave Lab demonstrates:
- Classical wave equations
- Superposition and interference
- Standing wave physics
- Energy dissipation
- Visual mapping of physical quantities

This makes it both **educational** and **interactive**.
