// 3D Ambient WebGL Background Engine using Three.js

(function init3D() {
  const canvas = document.getElementById('bg3d');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 18;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const light1 = new THREE.PointLight(0x3b82f6, 3, 50);
  light1.position.set(10, 10, 10);
  scene.add(light1);

  const light2 = new THREE.PointLight(0x8b5cf6, 3, 50);
  light2.position.set(-10, -10, 5);
  scene.add(light2);

  const light3 = new THREE.PointLight(0x06b6d4, 2, 40);
  light3.position.set(0, 15, -5);
  scene.add(light3);

  // Floating Geometry Group
  const mainGroup = new THREE.Group();
  scene.add(mainGroup);

  // Central 3D Wireframe Icosahedron
  const icoGeo = new THREE.IcosahedronGeometry(4, 1);
  const icoMat = new THREE.MeshPhongMaterial({
    color: 0x60a5fa,
    wireframe: true,
    transparent: true,
    opacity: 0.35,
    shininess: 100
  });
  const icoMesh = new THREE.Mesh(icoGeo, icoMat);
  mainGroup.add(icoMesh);

  // Inner Glossy Core
  const coreGeo = new THREE.IcosahedronGeometry(2, 2);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.5
  });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  mainGroup.add(coreMesh);

  // Floating Orbs / Rings
  const numOrbs = 18;
  const orbs = [];
  const orbGeo = new THREE.SphereGeometry(0.35, 16, 16);

  for (let i = 0; i < numOrbs; i++) {
    const orbMat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? 0x38bdf8 : 0xa78bfa,
      roughness: 0.1,
      metalness: 0.9,
      emissive: i % 2 === 0 ? 0x0284c7 : 0x7c3aed,
      emissiveIntensity: 0.6
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    const radius = 6 + Math.random() * 8;
    const theta = Math.random() * Math.PI * 2;
    const phi = (Math.random() - 0.5) * Math.PI;

    orb.position.set(
      radius * Math.cos(theta) * Math.cos(phi),
      radius * Math.sin(phi),
      radius * Math.sin(theta) * Math.cos(phi)
    );

    orb.userData = {
      speed: 0.005 + Math.random() * 0.01,
      radius,
      angle: theta,
      yOffset: Math.random() * Math.PI * 2
    };

    mainGroup.add(orb);
    orbs.push(orb);
  }

  // Particle Constellation Starfield
  const particleCount = 220;
  const pGeometry = new THREE.BufferGeometry();
  const pPositions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    pPositions[i] = (Math.random() - 0.5) * 60;
    pPositions[i + 1] = (Math.random() - 0.5) * 60;
    pPositions[i + 2] = (Math.random() - 0.5) * 40 - 5;
  }
  pGeometry.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

  const pMaterial = new THREE.PointsMaterial({
    color: 0x93c5fd,
    size: 0.18,
    transparent: true,
    opacity: 0.7
  });
  const particles = new THREE.Points(pGeometry, pMaterial);
  scene.add(particles);

  // Mouse Parallax Interaction
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    mouseY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
  });

  // Animation Loop
  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate main geometry
    icoMesh.rotation.x = elapsedTime * 0.12;
    icoMesh.rotation.y = elapsedTime * 0.18;

    coreMesh.rotation.x = -elapsedTime * 0.15;
    coreMesh.rotation.y = -elapsedTime * 0.22;

    // Orbiting particles
    orbs.forEach((orb) => {
      orb.userData.angle += orb.userData.speed;
      orb.position.x = orb.userData.radius * Math.cos(orb.userData.angle);
      orb.position.z = orb.userData.radius * Math.sin(orb.userData.angle);
      orb.position.y += Math.sin(elapsedTime * 2 + orb.userData.yOffset) * 0.005;
    });

    particles.rotation.y = elapsedTime * 0.02;

    // Smooth Mouse Parallax
    targetX += (mouseX * 2.5 - targetX) * 0.05;
    targetY += (-mouseY * 2.5 - targetY) * 0.05;

    camera.position.x = targetX;
    camera.position.y = targetY;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();

  // Window Resize Listener
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
