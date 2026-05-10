/**
 * Simulazione 3D Mölkky — partita in solitaria con regole da
 * https://it.wikipedia.org/wiki/M%C3%B6lkky (semplificazioni dove serve).
 *
 * Regole implementate:
 *  - Punteggio: 1 birillo = valore numerico; 2+ birilli = numero di birilli caduti.
 *  - Vince chi raggiunge esattamente 50; superando 50 si torna a 25.
 *  - Dopo ogni tiro i birilli abbattuti si rialzano sul posto (stesso x,z) e restano
 *    colpibili al lancio successivo; il birillo di lancio (mölkky) esce dal campo.
 *  - Tre mancati consecutivi → fine partita.
 *  - Birilli “significativamente inclinati” contano come caduti (regola semplificata).
 */

import * as THREE from "three";

// --- Costanti scena ----------------------------------------------------------

const PIN_HEIGHT = 1.5;
const PIN_RADIUS = 0.28;
const PIN_TOP_SLOPE = 0.6;
/** Distanza dal centro a uno dei due "tappi sferici" della capsula. */
const PIN_HALF_LEN = PIN_HEIGHT / 2 - PIN_RADIUS;
/** Regola stringente originale (~45°). */
const PIN_FALL_THRESHOLD_STRICT = Math.PI / 4;
/** Regola “rilassata” richiesta: inclinazione marcata = caduto.
 *  ~17° (0.30 rad): un pin chiaramente piegato vale come abbattuto, così
 *  i contatti non vengono più “mangiati” da un settle troppo presto.
 */
const PIN_LEAN_THRESHOLD = 0.30;

/** Massa = 1 (relativa). Momento d'inerzia per asse trasversale (cilindro pieno). */
const PIN_MASS = 1;
const PIN_INERTIA_PERP =
  (3 * PIN_RADIUS * PIN_RADIUS + PIN_HEIGHT * PIN_HEIGHT) / 12;
/** Inerzia attorno all'asse longitudinale (rotolare attorno l'asse del pin). */
const PIN_INERTIA_AXIAL = (PIN_RADIUS * PIN_RADIUS) / 2;
/** Coefficienti di restituzione: legno su sabbia/erba = molto basso. */
const RESTITUTION_GROUND = 0.18;
const RESTITUTION_PIN_PIN = 0.32;
const RESTITUTION_MOLKKY_PIN = 0.28;
/** Attrito di Coulomb (limite tangenziale = mu * |Jn|). */
const FRICTION_GROUND = 0.55;
const FRICTION_PIN_PIN = 0.25;
/** Smorzamento angolare in aria. */
const ANGULAR_AIR_DAMP = 1.4;
/** Smorzamento extra (lineare e angolare) quando il pin è basso e quasi a riposo. */
const SETTLE_DAMP = 4.5;
/** Tempo massimo (ms) per concludere un tiro: oltre, forziamo il settling. */
const MAX_THROW_DURATION_MS = 3200;

const MOLKKY_LENGTH = 1.6;
const MOLKKY_RADIUS = 0.27;
const MOLKKY_MASS = 1.4;

const PLAY_AREA = { x: 8, z: 16 };
const GRAVITY = -22;
const GROUND_EPS = 0.008;

const POWER_METER_OMEGA = 3.85;
const AIM_METER_OMEGA = 3.30;
const LOB_METER_OMEGA = 3.25;

/** Bersaglio z-target in funzione della potenza (start = mölkkyHome.z). */
const TARGET_Z_NEAR = -1.0;
const TARGET_Z_FAR = 11.5;
/** Spostamento laterale a aim=±1. */
const TARGET_X_RANGE = 3.6;
/** Apice della parabola: lob 0 = teso e radente, lob 1 = scavalca tutti i birilli. */
const APEX_Y_MIN = 0.45;
const APEX_Y_MAX = 4.0;

const TARGET_SCORE = 50;
const BUST_SCORE = 25;
const MAX_CONSECUTIVE_MISSES = 3;

/** Wikipedia: quarta fila 7, 8, 9 (non 7, 9, 8). */
const PIN_LAYOUT = [
  [1, 2],
  [3, 10, 4],
  [5, 11, 12, 6],
  [7, 8, 9],
];

// --- Helpers fisica --------------------------------------------------------

const _tmp_d1 = new THREE.Vector3();
const _tmp_d2 = new THREE.Vector3();
const _tmp_r = new THREE.Vector3();

/**
 * Trova i punti più vicini tra due segmenti 3D `[p1,p2]` e `[q1,q2]`.
 * Usa l'algoritmo standard di Lumelsky (1985) — robusto su segmenti paralleli
 * e degenerazioni a punto. Scrive i risultati in `outA` e `outB`.
 */
function closestPointsOnSegments(p1, p2, q1, q2, outA, outB) {
  _tmp_d1.subVectors(p2, p1);
  _tmp_d2.subVectors(q2, q1);
  _tmp_r.subVectors(p1, q1);
  const a = _tmp_d1.lengthSq();
  const e = _tmp_d2.lengthSq();
  const f = _tmp_d2.dot(_tmp_r);
  const eps = 1e-9;
  let s = 0;
  let t = 0;

  if (a <= eps && e <= eps) {
    outA.copy(p1);
    outB.copy(q1);
    return;
  }
  if (a <= eps) {
    s = 0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else {
    const c = _tmp_d1.dot(_tmp_r);
    if (e <= eps) {
      t = 0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else {
      const b = _tmp_d1.dot(_tmp_d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = THREE.MathUtils.clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
      }
    }
  }
  outA.copy(p1).addScaledVector(_tmp_d1, s);
  outB.copy(q1).addScaledVector(_tmp_d2, t);
}

const _capsuleAxis = new THREE.Vector3();
const _capsuleEndA = new THREE.Vector3();
const _capsuleEndB = new THREE.Vector3();

/** Calcola le due estremità della capsula del pin in coordinate world. */
function getPinCapsuleEnds(pin, outTop, outBot) {
  _capsuleAxis.set(0, 1, 0).applyQuaternion(pin.quaternion);
  outTop.copy(pin.position).addScaledVector(_capsuleAxis, PIN_HALF_LEN);
  outBot.copy(pin.position).addScaledVector(_capsuleAxis, -PIN_HALF_LEN);
}

// --- Helpers DOM -------------------------------------------------------------

function hasWebGLSupport() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  } catch (_) {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// --- Texture procedurali -----------------------------------------------------

function createPinNumberTexture(number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#f0d9a8");
  grad.addColorStop(1, "#e0bf80");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(120, 80, 30, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const y = (i / 14) * size + Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + 2, size * 0.6, y - 2, size, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#3a2200";
  ctx.font = "900 165px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(40, 22, 0, 0.35)";
  ctx.shadowBlur = 4;
  ctx.fillText(String(number), size / 2, size / 2 + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createGroundTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#d2a86a");
  grad.addColorStop(1, "#b8884a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = `rgba(80, 50, 20, ${Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Geometrie birillo -------------------------------------------------------

function createPinBodyGeometry(radius, height, slope, segments = 32) {
  const halfH = height / 2;
  const geo = new THREE.CylinderGeometry(radius, radius, height, segments, 1, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      const z = pos.getZ(i);
      pos.setY(i, halfH + slope * z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function createPinTopGeometry(radius, height, slope, segments = 48) {
  const halfH = height / 2;
  const positions = [0, halfH, 0];
  const uvs = [0.5, 0.5];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const x = radius * cosT;
    const z = radius * sinT;
    const y = halfH + slope * z;
    positions.push(x, y, z);
    uvs.push(0.5 - 0.5 * cosT, 0.5 + 0.5 * sinT);
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i + 1, i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createPinBottomGeometry(radius, height, segments = 32) {
  const halfH = height / 2;
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -halfH, 0);
  return geo;
}

function createPin(number) {
  const group = new THREE.Group();
  group.name = `pin-${number}`;

  const sideMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8c98a,
    roughness: 0.75,
    metalness: 0.05,
  });
  const topMaterial = new THREE.MeshStandardMaterial({
    map: createPinNumberTexture(number),
    roughness: 0.55,
    metalness: 0.05,
  });
  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: 0xc69458,
    roughness: 0.9,
  });

  const body = new THREE.Mesh(createPinBodyGeometry(PIN_RADIUS, PIN_HEIGHT, PIN_TOP_SLOPE), sideMaterial);
  body.castShadow = true;
  body.receiveShadow = true;

  const top = new THREE.Mesh(createPinTopGeometry(PIN_RADIUS, PIN_HEIGHT, PIN_TOP_SLOPE), topMaterial);
  top.castShadow = true;
  top.receiveShadow = true;

  const bottom = new THREE.Mesh(createPinBottomGeometry(PIN_RADIUS, PIN_HEIGHT), bottomMaterial);
  bottom.receiveShadow = true;

  group.add(body, top, bottom);
  group.position.y = PIN_HEIGHT / 2;
  group.userData = {
    number,
    home: null,
    resting: false,
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
  };
  return group;
}

function createMolkky() {
  const geo = new THREE.CylinderGeometry(MOLKKY_RADIUS, MOLKKY_RADIUS, MOLKKY_LENGTH, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb27a3c,
    roughness: 0.55,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.x = Math.PI / 2;
  mesh.userData = {
    velocity: new THREE.Vector3(),
    angularVelocity: new THREE.Vector3(),
    inFlight: false,
    settled: true,
  };
  return mesh;
}

// --- Simulatore --------------------------------------------------------------

class MolkkySimulator {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector("[data-role=canvas]");
    this.throwBtn = root.querySelector("[data-role=throw]");
    this.resetBtn = root.querySelector("[data-role=reset]");
    this.resultEl = root.querySelector("[data-role=result]");
    this.hudScore = root.querySelector("[data-role=hud-score]");
    this.hudThrows = root.querySelector("[data-role=hud-throws]");
    this.hudMisses = root.querySelector("[data-role=hud-misses]");
    this.hudMissesWrap = root.querySelector("[data-role=hud-misses-wrap]");
    this.overlay = root.querySelector("[data-role=overlay]");
    this.overlayTitle = root.querySelector("[data-role=overlay-title]");
    this.overlayText = root.querySelector("[data-role=overlay-text]");
    this.overlayStats = root.querySelector("[data-role=overlay-stats]");
    this.overlayAction = root.querySelector("[data-role=overlay-action]");

    this.meterPowerWrap = root.querySelector("[data-role=meter-power-wrap]");
    this.meterAimWrap = root.querySelector("[data-role=meter-aim-wrap]");
    this.meterLobWrap = root.querySelector("[data-role=meter-lob-wrap]");
    this.powerHintEl = root.querySelector("[data-role=meter-power-hint]");
    this.aimHintEl = root.querySelector("[data-role=meter-aim-hint]");
    this.lobHintEl = root.querySelector("[data-role=meter-lob-hint]");

    this.shotPhase = "idle";
    this._lockedPower = 0.7;
    this._lockedAim = 0;
    this._lockedLob = 0.25;
    this._meterRaf = null;

    this.reducedMotion = prefersReducedMotion();
    this.disposed = false;
    this.running = false;
    this.lastTime = performance.now();
    this.pins = [];
    this.molkky = null;

    this.throwInProgress = false;
    this.collisionCooldown = 0;

    /** playing | won_exact | lost_misses */
    this.gamePhase = "playing";

    this.score = 0;
    this.throws = 0;
    this.consecutiveMisses = 0;

    this._setupScene();
    this._buildBoard();
    this._buildAimVisuals();
    this._bindEvents();
    this._observeVisibility();

    this._applyMeterCss(this._lockedPower, 0, this._lockedLob);
    this._updateAimVisuals(this._lockedPower, 0, this._lockedLob);
    this._setAimVisualsVisible(false);
    this._updateHud();
    this._updateShotUi();
    this._render();
    this._start();
  }

  _setupScene() {
    const { width, height } = this.canvas.getBoundingClientRect();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width || 600, height || 400, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefe1c3);
    this.scene.fog = new THREE.Fog(0xefe1c3, 22, 38);

    this.camera = new THREE.PerspectiveCamera(45, (width || 600) / (height || 400), 0.1, 80);
    this.camera.position.set(0, 4.8, -8.5);
    this.camera.lookAt(0, 0.6, 4);

    const ambient = new THREE.AmbientLight(0xfff2d6, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff1c8, 1.0);
    sun.position.set(-6, 12, -4);
    sun.castShadow = true;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -2;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xa9c4ff, 0.25);
    fill.position.set(4, 6, -10);
    this.scene.add(fill);
  }

  _buildBoard() {
    const groundGeo = new THREE.PlaneGeometry(PLAY_AREA.x * 2, PLAY_AREA.z * 2);
    const groundMat = new THREE.MeshStandardMaterial({
      map: createGroundTexture(),
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const pinSpacing = 0.85;
    const startZ = 4;
    PIN_LAYOUT.forEach((row, rowIndex) => {
      const z = startZ + rowIndex * pinSpacing;
      const offset = -((row.length - 1) / 2) * pinSpacing;
      row.forEach((number, colIndex) => {
        const pin = createPin(number);
        const x = offset + colIndex * pinSpacing;
        pin.userData.home = new THREE.Vector3(x, PIN_HEIGHT / 2, z);
        pin.position.copy(pin.userData.home);
        pin.quaternion.identity();
        this.pins.push(pin);
        this.scene.add(pin);
      });
    });

    this.molkky = createMolkky();
    this.molkkyHome = new THREE.Vector3(0, MOLKKY_RADIUS, -5.5);
    this.molkky.position.copy(this.molkkyHome);
    this.scene.add(this.molkky);
  }

  /**
   * Indicatori di mira nella scena 3D:
   *  - aimArrow: linea sul terreno dal mölkky verso il bersaglio (con punta)
   *  - trajectoryLine: curva tratteggiata che mostra la traiettoria balistica prevista
   * Vengono aggiornati realtime mentre oscillano i metri.
   */
  _buildAimVisuals() {
    const arrowMat = new THREE.LineBasicMaterial({
      color: 0xb3380e,
      transparent: true,
      opacity: 0.9,
    });
    const arrowGeo = new THREE.BufferGeometry();
    arrowGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(5 * 3).fill(0), 3),
    );
    this.aimArrow = new THREE.Line(arrowGeo, arrowMat);
    this.aimArrow.frustumCulled = false;
    this.aimArrow.renderOrder = 5;
    this.scene.add(this.aimArrow);

    const TRAJ_POINTS = 40;
    const trajGeo = new THREE.BufferGeometry();
    trajGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(TRAJ_POINTS * 3).fill(0), 3),
    );
    const trajMat = new THREE.LineDashedMaterial({
      color: 0x5b4500,
      dashSize: 0.22,
      gapSize: 0.18,
      transparent: true,
      opacity: 0.85,
    });
    this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
    this.trajectoryLine.frustumCulled = false;
    this.trajectoryLine.renderOrder = 5;
    this.trajectoryPoints = TRAJ_POINTS;
    this.scene.add(this.trajectoryLine);
  }

  _setAimVisualsVisible(visible) {
    if (this.aimArrow) this.aimArrow.visible = visible;
    if (this.trajectoryLine) this.trajectoryLine.visible = visible;
  }

  /**
   * Modello balistico deterministico: dato (power, aim, lob) calcola la velocità
   * iniziale per centrare il bersaglio (targetX, targetZ) con apice a APEX_Y.
   */
  _computeShot(power, aim, lob) {
    const p = THREE.MathUtils.clamp(power, 0, 1);
    const a = THREE.MathUtils.clamp(aim, -1, 1);
    const l = THREE.MathUtils.clamp(lob, 0, 1);

    const start = this.molkkyHome;
    const targetZ = TARGET_Z_NEAR + p * (TARGET_Z_FAR - TARGET_Z_NEAR);
    const targetX = a * TARGET_X_RANGE;
    const apexY = APEX_Y_MIN + l * (APEX_Y_MAX - APEX_Y_MIN);

    const g = Math.abs(GRAVITY);
    const tFlight = 2 * Math.sqrt(2 * Math.max(apexY, 0.05) / g);
    const dz = targetZ - start.z;
    const dx = targetX - start.x;

    const vy = Math.sqrt(2 * apexY * g);
    const vz = dz / tFlight;
    const vx = dx / tFlight;

    return { start, targetX, targetZ, apexY, tFlight, vx, vy, vz };
  }

  _updateAimVisuals(power, aim, lob) {
    if (!this.aimArrow || !this.trajectoryLine) return;

    const shot = this._computeShot(power, aim, lob);
    const { start, targetX, targetZ, vx, vy, vz, tFlight } = shot;

    const arrowY = 0.02;
    const dx = targetX - start.x;
    const dz = targetZ - start.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    const headLen = Math.min(0.55, len * 0.18);
    const headW = headLen * 0.55;
    const tipX = targetX;
    const tipZ = targetZ;
    const baseX = tipX - ux * headLen;
    const baseZ = tipZ - uz * headLen;
    const leftX = baseX + (-uz) * headW;
    const leftZ = baseZ + (ux) * headW;
    const rightX = baseX - (-uz) * headW;
    const rightZ = baseZ - (ux) * headW;

    const arrowPos = this.aimArrow.geometry.attributes.position;
    arrowPos.setXYZ(0, start.x, arrowY, start.z);
    arrowPos.setXYZ(1, tipX, arrowY, tipZ);
    arrowPos.setXYZ(2, leftX, arrowY, leftZ);
    arrowPos.setXYZ(3, tipX, arrowY, tipZ);
    arrowPos.setXYZ(4, rightX, arrowY, rightZ);
    arrowPos.needsUpdate = true;
    this.aimArrow.geometry.computeBoundingSphere();

    const trajPos = this.trajectoryLine.geometry.attributes.position;
    const N = this.trajectoryPoints;
    const g = GRAVITY;
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * tFlight;
      const x = start.x + vx * t;
      const z = start.z + vz * t;
      const y = Math.max(0.02, start.y + vy * t + 0.5 * g * t * t);
      trajPos.setXYZ(i, x, y, z);
    }
    trajPos.needsUpdate = true;
    this.trajectoryLine.geometry.computeBoundingSphere();
    this.trajectoryLine.computeLineDistances();
  }

  _bindEvents() {
    this.throwBtn.addEventListener("click", () => this._onThrowClick());
    this.resetBtn.addEventListener("click", () => this._resetFullGame());
    this.overlayAction?.addEventListener("click", () => this._resetFullGame());

    this._onResize = () => this._handleResize();
    window.addEventListener("resize", this._onResize, { passive: true });

    this._onVisibility = () => {
      if (document.hidden) this._stop();
      else this._start();
    };
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  _observeVisibility() {
    if (!("IntersectionObserver" in window)) return;
    this._io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) this._start();
        else this._stop();
      }
    }, { threshold: 0.1 });
    this._io.observe(this.root);
  }

  _handleResize() {
    if (!this.renderer) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  _start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    this._frameLoop();
  }

  _stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _frameLoop = () => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 1 / 30);
    this.lastTime = now;
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame(this._frameLoop);
  };

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  // --- HUD / overlay ---------------------------------------------------------

  _updateHud() {
    if (this.hudScore) this.hudScore.textContent = String(this.score);
    if (this.hudThrows) this.hudThrows.textContent = String(this.throws);
    if (this.hudMisses) this.hudMisses.textContent = String(this.consecutiveMisses);
    if (this.hudMissesWrap) {
      this.hudMissesWrap.classList.toggle("is-warning", this.consecutiveMisses >= 2);
    }
  }

  _showOverlayWinExact() {
    if (!this.overlay) return;
    this.overlay.hidden = false;
    if (this.overlayTitle) this.overlayTitle.textContent = "Partita vinta!";
    if (this.overlayText) {
      this.overlayText.textContent =
        "Hai appena vinto una partita di Mölkky in solitaria, sei un* grande! 🎯🏆✨";
    }
    if (this.overlayStats) {
      this.overlayStats.textContent = `Tiri totali: ${this.throws}.`;
    }
  }

  _showOverlayLostMisses() {
    if (!this.overlay) return;
    this.overlay.hidden = false;
    if (this.overlayTitle) this.overlayTitle.textContent = "Eliminato!";
    if (this.overlayText) {
      this.overlayText.textContent =
        "Tre lanci consecutivi senza birilli: fine partita (regola ufficiale del Mölkky).";
    }
    if (this.overlayStats) {
      this.overlayStats.textContent = `Punteggio finale: ${this.score}. Tiri: ${this.throws}.`;
    }
  }

  _hideOverlay() {
    if (this.overlay) this.overlay.hidden = true;
  }

  // --- Metri Neo Turf Masters -------------------------------------------------

  _applyMeterCss(powerVal, aimVal, lobVal) {
    const pPct = THREE.MathUtils.clamp(powerVal, 0, 1) * 100;
    const aPct = ((THREE.MathUtils.clamp(aimVal, -1, 1) + 1) / 2) * 100;
    const lPct = THREE.MathUtils.clamp(lobVal ?? 0, 0, 1) * 100;
    this.root.style.setProperty("--molkky-needle-power", `${pPct}%`);
    this.root.style.setProperty("--molkky-needle-aim", `${aPct}%`);
    this.root.style.setProperty("--molkky-needle-lob", `${lPct}%`);
  }

  _powerOscillation(sec) {
    return 0.5 + 0.5 * Math.sin(sec * POWER_METER_OMEGA);
  }
  _aimOscillation(sec) {
    return Math.sin(sec * AIM_METER_OMEGA);
  }
  _lobOscillation(sec) {
    return 0.5 + 0.5 * Math.sin(sec * LOB_METER_OMEGA);
  }

  _startMeterLoop() {
    if (this._meterRaf != null) return;
    const loop = () => {
      if (this.disposed) {
        this._meterRaf = null;
        return;
      }
      const phase = this.shotPhase;
      if (phase !== "power" && phase !== "aim" && phase !== "lob") {
        this._meterRaf = null;
        return;
      }
      const sec = performance.now() / 1000;

      let p = this._lockedPower;
      let a = this._lockedAim;
      let l = this._lockedLob;
      if (phase === "power") {
        p = this._powerOscillation(sec);
        a = 0;
        l = this._lockedLob;
      } else if (phase === "aim") {
        a = this._aimOscillation(sec);
      } else if (phase === "lob") {
        l = this._lobOscillation(sec);
      }
      this._applyMeterCss(p, a, l);
      this._updateAimVisuals(p, a, l);
      this._meterRaf = requestAnimationFrame(loop);
    };
    this._meterRaf = requestAnimationFrame(loop);
  }

  _stopMeterLoop() {
    if (this._meterRaf != null) {
      cancelAnimationFrame(this._meterRaf);
      this._meterRaf = null;
    }
  }

  _updateShotUi() {
    const busy = this.throwInProgress;
    const canPlay = this.gamePhase === "playing";

    this.meterPowerWrap.classList.toggle("is-active", this.shotPhase === "power");
    this.meterAimWrap.classList.toggle("is-active", this.shotPhase === "aim");
    this.meterLobWrap?.classList.toggle("is-active", this.shotPhase === "lob");

    if (!canPlay && !busy) {
      this.throwBtn.disabled = true;
      this.throwBtn.textContent = "Partita terminata";
      return;
    }

    if (busy) {
      this.throwBtn.disabled = true;
      this.throwBtn.textContent = "Lancio…";
      return;
    }

    if (this.shotPhase === "idle") {
      this.throwBtn.disabled = false;
      this.throwBtn.textContent = "Inizia tiro";
      this.powerHintEl.textContent = "Tre tempi: potenza → direzione → palombella.";
      this.aimHintEl.textContent = "—";
      if (this.lobHintEl) this.lobHintEl.textContent = "—";
    } else if (this.shotPhase === "power") {
      this.throwBtn.disabled = false;
      this.throwBtn.textContent = "Ferma potenza";
      this.powerHintEl.textContent = "Ferma l’ago: regola la profondità del tiro.";
      this.aimHintEl.textContent = "—";
      if (this.lobHintEl) this.lobHintEl.textContent = "—";
    } else if (this.shotPhase === "aim") {
      this.throwBtn.disabled = false;
      this.throwBtn.textContent = "Ferma direzione";
      this.powerHintEl.textContent = "Potenza bloccata.";
      this.aimHintEl.textContent = "Ferma l’ago: scegli sinistra o destra.";
      if (this.lobHintEl) this.lobHintEl.textContent = "—";
    } else if (this.shotPhase === "lob") {
      this.throwBtn.disabled = false;
      this.throwBtn.textContent = "Lancia!";
      this.powerHintEl.textContent = "Potenza bloccata.";
      this.aimHintEl.textContent = "Direzione bloccata.";
      if (this.lobHintEl) this.lobHintEl.textContent = "Ferma l’ago: tiro teso o palombella alta.";
    }
  }

  _onThrowClick() {
    if (this.gamePhase !== "playing") return;
    if (this.throwInProgress) return;
    if (!this.molkky.userData.settled || this.molkky.userData.inFlight) return;

    // La sequenza potenza → direzione → palombella è il cuore del gioco:
    // va eseguita sempre, anche con `prefers-reduced-motion` attivo (su mobile
    // è spesso ON per via della Modalità Risparmio Energia). Per l'accessibilità
    // riduciamo l'animazione altrove, non saltiamo il gameplay.

    if (this.shotPhase === "idle") {
      this._lockedPower = 0.7;
      this._lockedAim = 0;
      this._lockedLob = 0.25;
      this.shotPhase = "power";
      this._setAimVisualsVisible(true);
      this._updateAimVisuals(this._lockedPower, this._lockedAim, this._lockedLob);
      this._updateShotUi();
      this._startMeterLoop();
      return;
    }

    if (this.shotPhase === "power") {
      const sec = performance.now() / 1000;
      this._lockedPower = this._powerOscillation(sec);
      this._lockedAim = 0;
      this._applyMeterCss(this._lockedPower, this._lockedAim, this._lockedLob);
      this._updateAimVisuals(this._lockedPower, this._lockedAim, this._lockedLob);
      this.shotPhase = "aim";
      this.meterAimWrap.hidden = false;
      this._updateShotUi();
      return;
    }

    if (this.shotPhase === "aim") {
      const sec = performance.now() / 1000;
      this._lockedAim = this._aimOscillation(sec);
      this._applyMeterCss(this._lockedPower, this._lockedAim, this._lockedLob);
      this._updateAimVisuals(this._lockedPower, this._lockedAim, this._lockedLob);
      this.shotPhase = "lob";
      if (this.meterLobWrap) this.meterLobWrap.hidden = false;
      this._updateShotUi();
      return;
    }

    if (this.shotPhase === "lob") {
      const sec = performance.now() / 1000;
      this._lockedLob = this._lobOscillation(sec);
      this._stopMeterLoop();
      this.shotPhase = "idle";
      if (this.meterLobWrap) this.meterLobWrap.hidden = true;
      this.meterAimWrap.hidden = true;
      this.meterPowerWrap.classList.remove("is-active");
      this.meterAimWrap.classList.remove("is-active");
      this.meterLobWrap?.classList.remove("is-active");
      this._setAimVisualsVisible(false);
      this._updateShotUi();
      this._executeThrow(this._lockedPower, this._lockedAim, this._lockedLob);
    }
  }

  // --- Lancio ----------------------------------------------------------------

  /**
   * Birillo di lancio visibile e pronto alla linea di partenza (ogni tiro usa un “nuovo” lancio).
   */
  _prepareMolkkyForThrow() {
    const m = this.molkky;
    m.visible = true;
    m.position.copy(this.molkkyHome);
    m.rotation.set(Math.PI / 2, 0, 0);
    m.userData.velocity.set(0, 0, 0);
    m.userData.angularVelocity.set(0, 0, 0);
    m.userData.inFlight = false;
    m.userData.settled = true;
  }

  /** Dopo il calcolo del tiro: birilli abbattuti si rialzano sul posto (stessi x,z). */
  _risePinsAfterScoring(pinList) {
    const half = PIN_HEIGHT / 2;
    for (const pin of pinList) {
      pin.quaternion.identity();
      pin.position.y = half;
      pin.position.x = THREE.MathUtils.clamp(pin.position.x, -PLAY_AREA.x + PIN_RADIUS, PLAY_AREA.x - PIN_RADIUS);
      if (pin.position.z > PLAY_AREA.z - PIN_RADIUS) {
        pin.position.z = PLAY_AREA.z - PIN_RADIUS;
      }
      pin.userData.velocity.set(0, 0, 0);
      pin.userData.angularVelocity.set(0, 0, 0);
      pin.userData.resting = true;
    }
  }

  /** Il mölkky usato per il tiro esce dal campo fino al lancio successivo. */
  _stashMolkkyAfterThrow() {
    const m = this.molkky;
    m.visible = false;
    m.userData.velocity.set(0, 0, 0);
    m.userData.angularVelocity.set(0, 0, 0);
    m.userData.inFlight = false;
    m.userData.settled = true;
  }

  _executeThrow(power, aim, lob) {
    const shot = this._computeShot(power, aim, lob);

    this._prepareMolkkyForThrow();

    for (const pin of this.pins) {
      pin.userData.wasInPlayThisShot = !this._isPinDown(pin);
    }

    const m = this.molkky;
    m.userData.velocity.set(shot.vx, shot.vy, shot.vz);
    const horizSpeed = Math.hypot(shot.vx, shot.vz);
    m.userData.angularVelocity.set(horizSpeed * 0.55, 0, shot.vx * 0.6);
    m.userData.inFlight = true;
    m.userData.settled = false;

    this.throwInProgress = true;
    this._throwStartedAt = performance.now();
    this.throws += 1;
    this._updateHud();
    this.resultEl.textContent = "Lancio in corso…";
    this._updateShotUi();
  }

  /** Forza l'arresto immediato di tutti i corpi (timeout o reduced motion). */
  _forceSettleAll() {
    for (const p of this.pins) {
      p.userData.velocity.set(0, 0, 0);
      p.userData.angularVelocity.set(0, 0, 0);
      p.userData.resting = true;
    }
    this.molkky.userData.velocity.set(0, 0, 0);
    this.molkky.userData.angularVelocity.set(0, 0, 0);
    this.molkky.userData.inFlight = false;
    this.molkky.userData.settled = true;
  }

  _simulateInstant() {
    let steps = 0;
    const maxSteps = 600;
    while (steps < maxSteps && !this._isThrowSettled()) {
      this._physicsStep(1 / 60);
      steps++;
    }

    if (!this._isThrowSettled()) {
      for (const p of this.pins) {
        p.userData.velocity.set(0, 0, 0);
        p.userData.angularVelocity.set(0, 0, 0);
      }
    }

    this.throwInProgress = false;
    this._finalizeThrowScoring();
    this._updateShotUi();
    this._render();
  }

  // --- Fisica -----------------------------------------------------------------

  _physicsStep(dt) {
    this._updateMolkky(dt);
    this._updatePins(dt);
    this._resolvePinPinCollisions();
    if (this.collisionCooldown > 0) this.collisionCooldown -= dt;
  }

  _update(dt) {
    this._physicsStep(dt);

    if (this.throwInProgress) {
      const elapsed = performance.now() - (this._throwStartedAt || 0);
      const settled = this._isThrowSettled();
      const timedOut = elapsed > MAX_THROW_DURATION_MS;
      if (settled || timedOut) {
        if (!settled) this._forceSettleAll();
        this.throwInProgress = false;
        this._finalizeThrowScoring();
        this._updateShotUi();
      }
    }
  }

  _updateMolkky(dt) {
    const m = this.molkky;
    if (!m.visible) return;
    const ud = m.userData;
    if (ud.settled) return;

    if (ud.inFlight) {
      ud.velocity.y += GRAVITY * dt;
    }

    m.position.addScaledVector(ud.velocity, dt);
    m.rotation.x += ud.angularVelocity.x * dt;
    m.rotation.y += ud.angularVelocity.y * dt;
    m.rotation.z += ud.angularVelocity.z * dt;

    if (m.position.y < MOLKKY_RADIUS + GROUND_EPS) {
      m.position.y = MOLKKY_RADIUS + GROUND_EPS;
      if (ud.velocity.y < 0) {
        ud.velocity.y = -ud.velocity.y * 0.22;
      }
      ud.velocity.x *= 0.72;
      ud.velocity.z *= 0.72;
      ud.angularVelocity.multiplyScalar(0.48);
      if (ud.velocity.length() < 0.55) {
        ud.velocity.set(0, 0, 0);
        ud.angularVelocity.set(0, 0, 0);
        ud.inFlight = false;
        ud.settled = true;
      }
    }

    if (!ud.inFlight && m.position.y <= MOLKKY_RADIUS + GROUND_EPS * 2) {
      const decay = Math.exp(-3 * dt);
      ud.velocity.x *= decay;
      ud.velocity.z *= decay;
      ud.angularVelocity.multiplyScalar(decay);
      if (ud.velocity.lengthSq() < 0.03) {
        ud.velocity.set(0, 0, 0);
        ud.angularVelocity.set(0, 0, 0);
        ud.settled = true;
      }
    }

    m.position.x = THREE.MathUtils.clamp(m.position.x, -PLAY_AREA.x + MOLKKY_RADIUS, PLAY_AREA.x - MOLKKY_RADIUS);
    if (m.position.z > PLAY_AREA.z - MOLKKY_RADIUS) {
      m.position.z = PLAY_AREA.z - MOLKKY_RADIUS;
      ud.velocity.z *= -0.35;
    }

    if (this.collisionCooldown <= 0) this._checkPinCollisions();
  }

  _checkPinCollisions() {
    const m = this.molkky;
    if (!m.visible) return;
    const ud = m.userData;
    if (ud.settled) return;

    const collisionRadius = MOLKKY_RADIUS + PIN_RADIUS;
    const sqRadius = collisionRadius * collisionRadius;

    const segA = new THREE.Vector3();
    const segB = new THREE.Vector3();
    const closestM = new THREE.Vector3();
    const closestP = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (const pin of this.pins) {
      getPinCapsuleEnds(pin, segA, segB);
      const mA = m.position.clone().add(new THREE.Vector3(0, 0, 0));
      const mB = m.position.clone();
      closestPointsOnSegments(mA, mB, segA, segB, closestM, closestP);
      const diff = closestP.clone().sub(closestM);
      const d2 = diff.lengthSq();
      if (d2 >= sqRadius || d2 < 1e-8) continue;

      const dist = Math.sqrt(d2);
      n.copy(diff).divideScalar(dist);

      const overlap = collisionRadius - dist;
      pin.position.addScaledVector(n, overlap * (MOLKKY_MASS / (MOLKKY_MASS + PIN_MASS)));
      m.position.addScaledVector(n, -overlap * (PIN_MASS / (MOLKKY_MASS + PIN_MASS)));

      const rPin = closestP.clone().sub(pin.position);
      const vPinAt = pin.userData.velocity.clone()
        .add(new THREE.Vector3().crossVectors(pin.userData.angularVelocity, rPin));
      const vMolAt = ud.velocity.clone();
      const rel = vMolAt.clone().sub(vPinAt);
      const vn = rel.dot(n);
      if (vn > 0) continue;

      const rxn = new THREE.Vector3().crossVectors(rPin, n);
      const denom =
        1 / MOLKKY_MASS +
        1 / PIN_MASS +
        rxn.lengthSq() / PIN_INERTIA_PERP;
      const Jn = -(1 + RESTITUTION_MOLKKY_PIN) * vn / denom;
      const impulse = n.clone().multiplyScalar(Jn);

      ud.velocity.addScaledVector(impulse, 1 / MOLKKY_MASS);
      pin.userData.velocity.addScaledVector(impulse, -1 / PIN_MASS);
      pin.userData.angularVelocity.add(
        new THREE.Vector3().crossVectors(rPin, impulse).multiplyScalar(-1 / PIN_INERTIA_PERP),
      );

      // Tip-assist: se il birillo è ancora dritto (o quasi) e viene toccato,
      // diamo un piccolo impulso angolare extra attorno all'asse orizzontale
      // perpendicolare alla direzione d'urto. Così “toccato = inclinato”
      // diventa la norma anche per contatti morbidi.
      const pinUp = new THREE.Vector3(0, 1, 0).applyQuaternion(pin.quaternion);
      if (pinUp.y > 0.92) {
        const tipAxis = new THREE.Vector3().crossVectors(pinUp, n);
        const tipMag = tipAxis.length();
        if (tipMag > 1e-6) {
          tipAxis.divideScalar(tipMag);
          const boost = Math.min(Math.abs(Jn) * 1.4, 6.0);
          pin.userData.angularVelocity.addScaledVector(tipAxis, boost);
        }
      }

      pin.userData.resting = false;
      this.collisionCooldown = 0.02;
    }
  }

  /**
   * Knock manuale (fallback / reduced-motion): somma un impulso al pin nel
   * punto di contatto stimato a metà cilindro, con torque coerente.
   */
  _knockPin(pin, impulse) {
    const ud = pin.userData;
    ud.resting = false;

    const top = new THREE.Vector3();
    const bot = new THREE.Vector3();
    getPinCapsuleEnds(pin, top, bot);
    const contactY = THREE.MathUtils.clamp(
      pin.position.y + (Math.random() * 0.4 - 0.2) * PIN_HALF_LEN,
      PIN_RADIUS,
      PIN_HEIGHT - PIN_RADIUS,
    );
    const horiz = new THREE.Vector3(impulse.x, 0, impulse.z);
    if (horiz.lengthSq() < 1e-6) horiz.set(0, 0, 1);
    horiz.normalize();
    const contact = new THREE.Vector3(
      pin.position.x - horiz.x * PIN_RADIUS,
      contactY,
      pin.position.z - horiz.z * PIN_RADIUS,
    );
    const r = contact.clone().sub(pin.position);

    ud.velocity.addScaledVector(impulse, 1 / PIN_MASS);
    ud.angularVelocity.add(
      new THREE.Vector3().crossVectors(r, impulse).multiplyScalar(1 / PIN_INERTIA_PERP),
    );
  }

  /**
   * Risoluzione pin↔pin con capsule: distanza segmento-segmento + impulso
   * normale con momento d'inerzia, così un pin lungo a terra ne sposta
   * davvero un altro (e non solo il "centro").
   */
  _resolvePinPinCollisions() {
    const minDist = PIN_RADIUS * 2;
    const minSq = minDist * minDist;
    const aTop = new THREE.Vector3();
    const aBot = new THREE.Vector3();
    const bTop = new THREE.Vector3();
    const bBot = new THREE.Vector3();
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    const n = new THREE.Vector3();

    for (let i = 0; i < this.pins.length; i++) {
      const a = this.pins[i];
      getPinCapsuleEnds(a, aTop, aBot);
      for (let j = i + 1; j < this.pins.length; j++) {
        const b = this.pins[j];
        getPinCapsuleEnds(b, bTop, bBot);

        closestPointsOnSegments(aBot, aTop, bBot, bTop, pa, pb);
        const diff = pb.clone().sub(pa);
        const d2 = diff.lengthSq();
        if (d2 >= minSq || d2 < 1e-10) continue;

        const dist = Math.sqrt(d2);
        n.copy(diff).divideScalar(dist);
        const overlap = minDist - dist;

        a.position.addScaledVector(n, -overlap * 0.5);
        b.position.addScaledVector(n, overlap * 0.5);

        const rA = pa.clone().sub(a.position);
        const rB = pb.clone().sub(b.position);

        const vA = a.userData.velocity.clone()
          .add(new THREE.Vector3().crossVectors(a.userData.angularVelocity, rA));
        const vB = b.userData.velocity.clone()
          .add(new THREE.Vector3().crossVectors(b.userData.angularVelocity, rB));
        const rel = vB.clone().sub(vA);
        const vn = rel.dot(n);
        if (vn > 0) continue;

        const rAxn = new THREE.Vector3().crossVectors(rA, n);
        const rBxn = new THREE.Vector3().crossVectors(rB, n);
        const denom =
          2 / PIN_MASS +
          (rAxn.lengthSq() + rBxn.lengthSq()) / PIN_INERTIA_PERP;
        const Jn = -(1 + RESTITUTION_PIN_PIN) * vn / denom;
        const impulse = n.clone().multiplyScalar(Jn);

        a.userData.velocity.addScaledVector(impulse, -1 / PIN_MASS);
        b.userData.velocity.addScaledVector(impulse, 1 / PIN_MASS);
        a.userData.angularVelocity.add(
          new THREE.Vector3().crossVectors(rA, impulse).multiplyScalar(-1 / PIN_INERTIA_PERP),
        );
        b.userData.angularVelocity.add(
          new THREE.Vector3().crossVectors(rB, impulse).multiplyScalar(1 / PIN_INERTIA_PERP),
        );

        const vTan = rel.clone().addScaledVector(n, -vn);
        const vTanMag = vTan.length();
        if (vTanMag > 1e-4) {
          const t = vTan.divideScalar(vTanMag);
          const rAxt = new THREE.Vector3().crossVectors(rA, t);
          const rBxt = new THREE.Vector3().crossVectors(rB, t);
          const denomT =
            2 / PIN_MASS +
            (rAxt.lengthSq() + rBxt.lengthSq()) / PIN_INERTIA_PERP;
          let Jt = -vTanMag / denomT;
          const Jmax = FRICTION_PIN_PIN * Math.abs(Jn);
          Jt = THREE.MathUtils.clamp(Jt, -Jmax, Jmax);
          const impT = t.multiplyScalar(Jt);
          a.userData.velocity.addScaledVector(impT, -1 / PIN_MASS);
          b.userData.velocity.addScaledVector(impT, 1 / PIN_MASS);
          a.userData.angularVelocity.add(
            new THREE.Vector3().crossVectors(rA, impT).multiplyScalar(-1 / PIN_INERTIA_PERP),
          );
          b.userData.angularVelocity.add(
            new THREE.Vector3().crossVectors(rB, impT).multiplyScalar(1 / PIN_INERTIA_PERP),
          );
        }

        a.userData.resting = false;
        b.userData.resting = false;
      }
    }
  }

  /**
   * Integrazione del birillo come capsula:
   *  - integrazione semi-implicita di velocità + posizione
   *  - rotazione attorno asse istantaneo dell'angular velocity
   *  - contatto col terreno calcolato sull'estremità più bassa, con
   *    impulso normale + frizione di Coulomb e torque coerente
   */
  _updatePins(dt) {
    const top = new THREE.Vector3();
    const bot = new THREE.Vector3();
    const n = new THREE.Vector3(0, 1, 0);

    for (const pin of this.pins) {
      const ud = pin.userData;

      ud.velocity.y += GRAVITY * dt;
      pin.position.addScaledVector(ud.velocity, dt);

      const angle = ud.angularVelocity.length() * dt;
      if (angle > 1e-6) {
        const axis = ud.angularVelocity.clone().normalize();
        pin.rotateOnWorldAxis(axis, angle);
      }
      ud.angularVelocity.multiplyScalar(Math.exp(-ANGULAR_AIR_DAMP * dt));

      getPinCapsuleEnds(pin, top, bot);
      const lowest = top.y < bot.y ? top : bot;
      const groundY = PIN_RADIUS + GROUND_EPS;

      if (lowest.y < groundY) {
        const lift = groundY - lowest.y;
        pin.position.y += lift;
        lowest.y += lift;

        const r = new THREE.Vector3(
          lowest.x - pin.position.x,
          -pin.position.y,
          lowest.z - pin.position.z,
        );

        const vAt = ud.velocity.clone()
          .add(new THREE.Vector3().crossVectors(ud.angularVelocity, r));
        const vn = vAt.dot(n);

        if (vn < 0) {
          const rxn = new THREE.Vector3().crossVectors(r, n);
          const denom = 1 / PIN_MASS + rxn.lengthSq() / PIN_INERTIA_PERP;
          const Jn = -(1 + RESTITUTION_GROUND) * vn / denom;
          const impulseN = n.clone().multiplyScalar(Jn);

          ud.velocity.addScaledVector(impulseN, 1 / PIN_MASS);
          ud.angularVelocity.add(
            new THREE.Vector3().crossVectors(r, impulseN).multiplyScalar(1 / PIN_INERTIA_PERP),
          );

          const vAt2 = ud.velocity.clone()
            .add(new THREE.Vector3().crossVectors(ud.angularVelocity, r));
          const vTan = new THREE.Vector3(vAt2.x, 0, vAt2.z);
          const vTanMag = vTan.length();
          if (vTanMag > 1e-4) {
            const t = vTan.divideScalar(vTanMag);
            const rxt = new THREE.Vector3().crossVectors(r, t);
            const denomT = 1 / PIN_MASS + rxt.lengthSq() / PIN_INERTIA_PERP;
            let Jt = vTanMag / denomT;
            const Jmax = FRICTION_GROUND * Math.abs(Jn);
            if (Jt > Jmax) Jt = Jmax;
            const impulseT = t.multiplyScalar(-Jt);
            ud.velocity.addScaledVector(impulseT, 1 / PIN_MASS);
            ud.angularVelocity.add(
              new THREE.Vector3().crossVectors(r, impulseT).multiplyScalar(1 / PIN_INERTIA_PERP),
            );
          }
        }
      }

      pin.position.x = THREE.MathUtils.clamp(pin.position.x, -PLAY_AREA.x + PIN_RADIUS, PLAY_AREA.x - PIN_RADIUS);
      if (pin.position.z > PLAY_AREA.z - PIN_RADIUS) {
        pin.position.z = PLAY_AREA.z - PIN_RADIUS;
        if (ud.velocity.z > 0) ud.velocity.z = -ud.velocity.z * 0.4;
      }
      if (pin.position.z < -PLAY_AREA.z + PIN_RADIUS) {
        pin.position.z = -PLAY_AREA.z + PIN_RADIUS;
        if (ud.velocity.z < 0) ud.velocity.z = -ud.velocity.z * 0.4;
      }

      const isLow =
        Math.min(top.y, bot.y) <= groundY + 0.02 ||
        pin.position.y <= groundY + 0.02;

      // Damping aggressivo quando il pin è basso e quasi a riposo: chiude
      // rapidamente le piccole oscillazioni residue dopo un urto.
      if (isLow) {
        const linSq = ud.velocity.lengthSq();
        const angSq = ud.angularVelocity.lengthSq();
        if (linSq < 1.5 * 1.5 && angSq < 6) {
          const k = Math.exp(-SETTLE_DAMP * dt);
          ud.velocity.multiplyScalar(k);
          ud.angularVelocity.multiplyScalar(k);
        }
      }

      const slow =
        ud.velocity.lengthSq() < 0.06 &&
        ud.angularVelocity.lengthSq() < 0.12;
      if (slow && isLow) {
        ud.velocity.set(0, 0, 0);
        ud.angularVelocity.set(0, 0, 0);
        ud.resting = true;
      } else {
        ud.resting = false;
      }
    }
  }

  _isThrowSettled() {
    if (!this.molkky.visible || !this.molkky.userData.settled) return false;
    for (const p of this.pins) {
      if (p.userData.velocity.lengthSq() > 0.08) return false;
      if (p.userData.angularVelocity.lengthSq() > 0.16) return false;
    }
    return true;
  }

  /**
   * Birillo “caduto” se inclinato oltre soglia rilassata (richiesta utente).
   */
  _isPinDown(pin) {
    const upLocal = new THREE.Vector3(0, 1, 0);
    const upWorld = upLocal.clone().applyQuaternion(pin.quaternion);
    const tilt = Math.acos(THREE.MathUtils.clamp(upWorld.y, -1, 1));
    return tilt > PIN_LEAN_THRESHOLD;
  }

  // --- Punteggio --------------------------------------------------------------

  _finalizeThrowScoring() {
    const newlyDown = this.pins.filter(
      p => p.userData.wasInPlayThisShot && this._isPinDown(p),
    );

    try {
      let roundPoints = 0;
      let msg;

      if (newlyDown.length === 0) {
        roundPoints = 0;
        this.consecutiveMisses += 1;
        msg = `Mancato. (${this.consecutiveMisses}/${MAX_CONSECUTIVE_MISSES} consecutivi)`;
      } else {
        this.consecutiveMisses = 0;
        if (newlyDown.length === 1) {
          roundPoints = newlyDown[0].userData.number;
          msg = `Birillo ${roundPoints}! +${roundPoints} punti.`;
        } else {
          roundPoints = newlyDown.length;
          msg = `${newlyDown.length} birilli! +${roundPoints} punti.`;
        }
      }

      const prevScore = this.score;
      const nextScoreIfApplied = prevScore + roundPoints;

      if (roundPoints > 0 && nextScoreIfApplied > TARGET_SCORE) {
        this.score = BUST_SCORE;
        this.resultEl.textContent = `${msg} Superati i 50 punti: il punteggio torna a ${BUST_SCORE} (regolamento Mölkky).`;
        this._updateHud();
        return;
      }

      this.score = nextScoreIfApplied;
      this._updateHud();

      if (this.score === TARGET_SCORE && roundPoints > 0) {
        this.resultEl.textContent = `${msg} Hai raggiunto esattamente 50 punti!`;
        this._showOverlayWinExact();
        this.gamePhase = "won_exact";
        return;
      }

      if (this.consecutiveMisses >= MAX_CONSECUTIVE_MISSES) {
        this.resultEl.textContent = `${msg} Partita finita.`;
        this._showOverlayLostMisses();
        this.gamePhase = "lost_misses";
        return;
      }

      this.resultEl.textContent = `${msg} Totale: ${this.score}.`;
    } finally {
      this._risePinsAfterScoring(newlyDown);
      this._stashMolkkyAfterThrow();
    }
  }

  // --- Reset -----------------------------------------------------------------

  _resetFullGame() {
    this._hideOverlay();
    this._stopMeterLoop();
    this.shotPhase = "idle";
    if (this.meterAimWrap) this.meterAimWrap.hidden = true;
    if (this.meterLobWrap) this.meterLobWrap.hidden = true;
    this.meterPowerWrap?.classList.remove("is-active");
    this.meterAimWrap?.classList.remove("is-active");
    this.meterLobWrap?.classList.remove("is-active");
    this._lockedPower = 0.7;
    this._lockedAim = 0;
    this._lockedLob = 0.25;
    this._applyMeterCss(this._lockedPower, this._lockedAim, this._lockedLob);
    this._setAimVisualsVisible(false);

    this.gamePhase = "playing";
    this.score = 0;
    this.throws = 0;
    this.consecutiveMisses = 0;
    this.throwInProgress = false;

    for (const pin of this.pins) {
      const ud = pin.userData;
      pin.position.copy(ud.home);
      pin.quaternion.identity();
      ud.velocity.set(0, 0, 0);
      ud.angularVelocity.set(0, 0, 0);
      ud.resting = false;
    }

    this._prepareMolkkyForThrow();

    this.resultEl.textContent = "Nuova partita: pronto al primo lancio.";
    this._updateHud();
    this._updateShotUi();
    this._render();
  }

  destroy() {
    this.disposed = true;
    this._stopMeterLoop();
    this._stop();
    window.removeEventListener("resize", this._onResize);
    document.removeEventListener("visibilitychange", this._onVisibility);
    if (this._io) this._io.disconnect();
    this.renderer?.dispose();
    this.scene?.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }
}

// --- Bootstrap ---------------------------------------------------------------

function showFallback(root) {
  root.classList.add("molkky-simulator--fallback");
}

function init() {
  const root = document.querySelector("[data-component=molkky-throw-simulator]");
  if (!root) return;

  if (!hasWebGLSupport()) {
    showFallback(root);
    return;
  }

  try {
    new MolkkySimulator(root);
  } catch (err) {
    console.error("[molkky-throw-simulator]", err);
    showFallback(root);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
