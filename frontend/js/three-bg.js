/**
 * three-bg.js — Three.js Animated Ocean Background
 * ══════════════════════════════════════════════════
 * Creates:
 *   1. Floating particle system (plankton / bubbles)
 *   2. Swimming fish silhouettes
 *   3. Subtle depth-of-field fog
 *
 * Performance: ~80 particles + 6 fish ≈ very lightweight
 */

(function () {
  "use strict";

  // ── Wait for THREE.js to be available ───────────────────────
  if (typeof THREE === "undefined") {
    console.warn("[three-bg] THREE.js not loaded — skipping background.");
    return;
  }

  const canvas = document.getElementById("threeCanvas");
  if (!canvas) return;

  // ── Renderer ────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,    // keep perf lean
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  // ── Scene & Camera ──────────────────────────────────────────
  const scene  = new THREE.Scene();
  scene.fog    = new THREE.FogExp2(0x000c1a, 0.045);

  const camera = new THREE.PerspectiveCamera(
    65, window.innerWidth / window.innerHeight, 0.1, 80
  );
  camera.position.set(0, 0, 6);

  // ── Lighting ────────────────────────────────────────────────
  const ambLight = new THREE.AmbientLight(0x002244, 2);
  scene.add(ambLight);

  const ptLight = new THREE.PointLight(0x00d4ff, 3, 20);
  ptLight.position.set(-4, 3, 4);
  scene.add(ptLight);

  // ── Particles (plankton / bubbles) ──────────────────────────
  const PARTICLE_COUNT = 90;
  const pPositions = new Float32Array(PARTICLE_COUNT * 3);
  const pVelocities = [];    // y-velocity per particle

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pPositions[i * 3]     = (Math.random() - 0.5) * 26;   // x
    pPositions[i * 3 + 1] = (Math.random() - 0.5) * 16;   // y
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;   // z
    pVelocities.push(0.004 + Math.random() * 0.008);
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));

  const pMat = new THREE.PointsMaterial({
    color: 0x00d4ff,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  // ── Fish silhouette factory ──────────────────────────────────
  function createFishMesh(accentColor) {
    const group = new THREE.Group();

    // --- Body (streamlined teardrop) ---
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(0, 0);
    bodyShape.bezierCurveTo( 0.2, 0.28,  1.0, 0.30,  1.6,  0);
    bodyShape.bezierCurveTo( 1.0, -0.30, 0.2, -0.28, 0,    0);

    const bodyGeo = new THREE.ShapeGeometry(bodyShape, 20);
    const bodyMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // --- Tail fin ---
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0,     0);
    tailShape.lineTo(-0.42, 0.22);
    tailShape.lineTo(-0.38, 0);
    tailShape.lineTo(-0.42, -0.22);
    tailShape.closePath();

    const tailGeo = new THREE.ShapeGeometry(tailShape, 6);
    const tail    = new THREE.Mesh(tailGeo, bodyMat.clone());
    group.add(tail);

    // --- Dorsal fin ---
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0.4, 0);
    dorsalShape.quadraticCurveTo(0.6, 0.28, 1.0, 0.12);
    dorsalShape.lineTo(0.4, 0);
    const dorsalGeo = new THREE.ShapeGeometry(dorsalShape, 8);
    const dorsal    = new THREE.Mesh(dorsalGeo, bodyMat.clone());
    group.add(dorsal);

    // --- Eye ---
    const eyeGeo = new THREE.CircleGeometry(0.04, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const eye    = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(1.3, 0.06, 0.01);
    group.add(eye);

    return group;
  }

  // ── Spawn fish ───────────────────────────────────────────────
  const FISH_COLORS = [0x00d4ff, 0x7b2fff, 0x00ffc8, 0x0090cc, 0x5b20cc];
  const FISH_COUNT  = 6;
  const fishes = [];

  for (let i = 0; i < FISH_COUNT; i++) {
    const color = FISH_COLORS[i % FISH_COLORS.length];
    const fish  = createFishMesh(color);

    // Spread fish across the scene depth & height
    const startX = -18 - Math.random() * 10;
    const startY = (Math.random() - 0.5) * 8;
    const startZ = -2 - Math.random() * 4;

    fish.position.set(startX, startY, startZ);

    const sc = 0.6 + Math.random() * 1.0;
    fish.scale.setScalar(sc);

    fish.userData = {
      speed:        0.012 + Math.random() * 0.018,
      wobbleOffset: Math.random() * Math.PI * 2,
      wobbleSpeed:  0.025 + Math.random() * 0.025,
      wobbleAmp:    0.006 + Math.random() * 0.008,
      startY,
      resetX:       -22,
      spawnX:       18 + Math.random() * 8,
      flip:         Math.random() > 0.5,  // some swim left
    };

    if (fish.userData.flip) {
      fish.rotation.y  = Math.PI;
      fish.userData.speed *= -1;
      fish.position.x  = 18 + Math.random() * 10;
    }

    scene.add(fish);
    fishes.push(fish);
  }

  // ── Mouse parallax ──────────────────────────────────────────
  const mouse = { x: 0, y: 0 };
  document.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ── Clock ───────────────────────────────────────────────────
  const clock = new THREE.Clock();

  // ── Animate ─────────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // -- Bubble particles rise slowly --
    const pos = pGeo.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3 + 1] += pVelocities[i];
      if (pos[i * 3 + 1] > 9) {
        pos[i * 3 + 1] = -9;
        pos[i * 3]     = (Math.random() - 0.5) * 26;
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    // Gentle particle rotation
    particles.rotation.y  = t * 0.015;
    particles.rotation.x  = Math.sin(t * 0.08) * 0.04;

    // -- Fish swim --
    fishes.forEach((fish) => {
      const ud = fish.userData;
      fish.position.x += ud.speed;

      // Vertical wobble
      ud.wobbleOffset += ud.wobbleSpeed;
      fish.position.y  = ud.startY + Math.sin(ud.wobbleOffset) * 0.4;

      // Gentle body tilt with wobble
      fish.rotation.z  = Math.sin(ud.wobbleOffset) * 0.04;

      // Tail wag — rotate last child slightly
      if (fish.children.length > 0) {
        fish.children[0].rotation.z = Math.sin(ud.wobbleOffset * 2) * 0.06;
      }

      // Reset when off screen
      if (!ud.flip && fish.position.x > 22) {
        fish.position.x  = ud.resetX;
        ud.startY        = (Math.random() - 0.5) * 8;
        fish.position.y  = ud.startY;
      }
      if (ud.flip && fish.position.x < -22) {
        fish.position.x  = ud.spawnX;
        ud.startY        = (Math.random() - 0.5) * 8;
        fish.position.y  = ud.startY;
      }
    });

    // -- Subtle camera parallax --
    camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.y * 0.2 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // -- Point light drift --
    ptLight.position.x = Math.sin(t * 0.3) * 5;
    ptLight.position.y = Math.cos(t * 0.2) * 3;

    renderer.render(scene, camera);
  }

  animate();

  // ── Resize ──────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Handle missing video gracefully ─────────────────────────
  const video = document.getElementById("bgVideo");
  if (video) {
    video.addEventListener("error", () => {
      video.style.display = "none";
      console.info("[AquaDetect] Ocean video not found — Three.js bg active.");
    });
  }

})();
