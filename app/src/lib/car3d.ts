// Carro em 3D (só no navegador): monta o carro da garagem com three.js e desenha num "estúdio" único
// (um só contexto WebGL pro app inteiro). Cada carrinho do mapa é um <canvas> comum que recebe a imagem
// pronta, sempre do mesmo ângulo que a câmera do mapa está olhando: visto de cima na diagonal, sem achatar.
// A lataria é uma superfície lisa feita das fatias de car3dShape.ts, nas proporções do modelo
// (carModels.ts: Gol quadrado, Opala, Fusca, Onix...), com vidros escuros, faróis, grade e lanternas.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  axles, clearance, halfWidthAt, partAt, section, stations, wheelRadius, wheelZ, type ModelDef, type Part,
} from './car3dShape.ts';
import { resolveModel } from './carModels.ts';
import { buildKitCar, kitFor } from './carKit.ts';

import type { CarSpec } from './car3dTypes.ts';
export type { CarSpec } from './car3dTypes.ts';

export interface View3D {
  rel: number;      // direção do carro em relação à tela (graus, 0 = pra cima, horário)
  pitch: number;    // inclinação do mapa (0 = de cima)
  wheel?: number;   // quanto as rodas giraram (rad)
  bob?: number;     // balanço da carroceria (m)
  lights?: boolean; // faróis acesos (noite)
  zoom?: number;    // 1 = quadro do mapa; >1 aproxima (garagem, galeria)
  elev?: number;    // ângulo fixo da câmera (graus); sem ele segue a inclinação do mapa
}

const NEON: Record<string, number> = { verde: 0xc6ff3d, azul: 0x3fa0ff, roxo: 0xb36bff };
const GLASS: Record<string, string> = { nenhuma: '#2a3646', fume: '#151b24', limo: '#07090c' };
const PART_COLOR: Record<Exclude<Part, 'paint' | 'glass'>, string> = { dark: '#121418', bed: '#1c2027' };
const HALF = 2.85;        // meia largura do quadro em metros (cabe a picape grande)

interface Model {
  group: THREE.Group; wheels: THREE.Object3D[]; body: THREE.Object3D; lights: THREE.Mesh[]; def: ModelDef;
  kit?: { baseY: number; sy: number };   // carro pronto do kit (roda gira no eixo x; carroceria em unidades do kit)
}

function radial(color: string, inner: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color); grad.addColorStop(inner, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// Cada fatia tem 7 pontos-chave por lado; entre eles entram pontos de uma curva suave (Catmull-Rom),
// então as quinas viram cantos arredondados e a luz corre pela lataria em vez de "facetar".
const SUB = 3;

function refine(half: [number, number][]): [number, number][] {
  const n = half.length;
  // pontos fantasmas: embaixo continua reto; em cima espelha (teto liso no meio)
  const at = (i: number): [number, number] => {
    if (i < 0) return [2 * half[0][0] - half[1][0], 2 * half[0][1] - half[1][1]];
    if (i >= n) { const m = half[2 * (n - 1) - i]; return [-m[0], m[1]]; }
    return half[i];
  };
  const out: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([Math.max(0, f(p0[0], p1[0], p2[0], p3[0])), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(half[n - 1]);
  return out;
}

/** Lataria lisa: liga as fatias e pinta cada faixa (lataria, vidro, fundo, caçamba). */
function bodyGeometry(def: ModelDef, wheelCenterY: number, archR: number, colors: Record<Part, THREE.Color>): THREE.BufferGeometry {
  const st = stations(def, wheelCenterY, archR);
  const H = 6 * SUB + 1;          // pontos de um lado (do fundo até o meio do teto)
  const R = 2 * H - 1;            // anel inteiro
  const ringOf = (i: number) => {
    const half = refine(section(st[i], def.boxy));
    // lado +z de baixo pra cima, depois o lado -z de cima pra baixo (o meio do teto não repete)
    return [...half.map(([z, y]) => [st[i].x, y, z]), ...half.slice(0, H - 1).reverse().map(([z, y]) => [st[i].x, y, -z])];
  };
  const pos: number[] = [];
  for (let i = 0; i < st.length; i++) for (const p of ringOf(i)) pos.push(p[0], p[1], p[2]);
  const idx: number[] = [];
  for (let i = 0; i < st.length - 1; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * R + j, b = i * R + ((j + 1) % R), c = (i + 1) * R + j, d = (i + 1) * R + ((j + 1) % R);
      idx.push(a, c, b, b, c, d);
    }
  }
  // normais lisas calculadas na malha ligada; depois cada triângulo recebe a cor da sua faixa
  const smooth = new THREE.BufferGeometry();
  smooth.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  smooth.setIndex(idx);
  smooth.computeVertexNormals();
  const nrm = smooth.getAttribute('normal') as THREE.BufferAttribute;

  const P: number[] = [], N: number[] = [], C: number[] = [];
  const tmp = new THREE.Color();
  const put = (v: number, col: THREE.Color, part: Part, n?: [number, number, number]) => {
    const y = pos[v * 3 + 1];
    P.push(pos[v * 3], y, pos[v * 3 + 2]);
    if (n) N.push(n[0], n[1], n[2]); else N.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
    // a parte de baixo da lataria fica um pouco mais escura (sombra de contato): dá volume
    const ao = part === 'paint' ? 0.62 + 0.38 * Math.min(1, Math.max(0, (y - 0.05) / 0.55)) : 1;
    tmp.copy(col).multiplyScalar(ao);
    C.push(tmp.r, tmp.g, tmp.b);
  };
  const bandOf = (j: number) => (j === R - 1 ? -1 : j < H - 1 ? Math.floor(j / SUB) : Math.floor((R - 2 - j) / SUB));
  for (let i = 0; i < st.length - 1; i++) {
    const xm = (st[i].x + st[i + 1].x) / 2;
    const sm = st[Math.abs(st[i].x - xm) < Math.abs(st[i + 1].x - xm) ? i : i + 1];
    for (let j = 0; j < R; j++) {
      const k = bandOf(j);
      const part: Part = k < 0 ? 'dark' : partAt(def, xm, k, sm);
      const col = colors[part];
      const a = i * R + j, b = i * R + ((j + 1) % R), c = (i + 1) * R + j, d = (i + 1) * R + ((j + 1) % R);
      for (const v of [a, c, b, b, c, d]) put(v, col, part);
    }
  }
  // tampas da frente e de trás (planas)
  for (const [i, sx] of [[st.length - 1, 1], [0, -1]] as const) {
    const base = i * R;
    let cy = 0;
    for (let j = 0; j < R; j++) cy += pos[(base + j) * 3 + 1];
    cy /= R;
    const center = pos.length / 3;
    pos.push(st[i].x, cy, 0);
    for (let j = 0; j < R; j++) {
      const a = base + j, b = base + ((j + 1) % R);
      // visto de fora o anel corre no sentido horário na frente: inverte pra ficar de frente pra câmera
      const tri = sx > 0 ? [center, b, a] : [center, a, b];
      for (const v of tri) put(v, colors.paint, 'paint', [sx, 0, 0]);
    }
  }
  smooth.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return g;
}

/** Peça plana virada pra frente (+x) ou pra trás (-x). */
function facePlate(w: number, h: number, mat: THREE.Material, x: number, y: number, z: number, front: boolean, round = false) {
  const geo = round ? new THREE.CircleGeometry(Math.min(w, h) / 2, 20) : new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(geo, mat);
  m.rotation.y = front ? Math.PI / 2 : -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}

function buildCar(spec: CarSpec, env: THREE.Texture | null): Model {
  const def = resolveModel({ body: spec.body, make: spec.make, model: spec.model, version: spec.version, year: spec.year }).def;
  const rw = wheelRadius(spec.rim);
  const gc = clearance(def, spec.rideHeight);
  const wcy = rw - gc;            // centro da roda em relação ao fundo da carroceria
  const archR = rw + 0.03;
  const h = def.L / 2;

  const colors: Record<Part, THREE.Color> = {
    paint: new THREE.Color(spec.color ?? '#B9C0CB'),
    glass: new THREE.Color(GLASS[spec.tint ?? 'nenhuma'] ?? GLASS.nenhuma),
    dark: new THREE.Color(PART_COLOR.dark),
    bed: new THREE.Color(PART_COLOR.bed),
  };
  const paintMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, metalness: 0.2, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05,
    envMap: env, envMapIntensity: 0.9,
  });
  const solidPaint = new THREE.MeshPhysicalMaterial({
    color: colors.paint, metalness: 0.15, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07, envMap: env, envMapIntensity: 0.6,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.65 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd4da, metalness: 0.95, roughness: 0.2, envMap: env });
  const plate = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });

  const body = new THREE.Group();
  body.add(new THREE.Mesh(bodyGeometry(def, wcy, archR, colors), paintMat));
  body.position.y = gc;

  // ---- frente: faróis no estilo do modelo, grade e para-choque ----
  const lights: THREE.Mesh[] = [];
  const head = new THREE.MeshStandardMaterial({ color: 0xf6f3ea, emissive: 0xfff4d6, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x8a0f14, emissive: 0xff1a1a, emissiveIntensity: 0.5, roughness: 0.3 });
  const wF = halfWidthAt(def, h - 0.001), wR = halfWidthAt(def, -h + 0.001);
  const fx = h + 0.004, rx = -h - 0.004;
  const ly = def.noseY - (def.lights === 'slim' ? 0.08 : 0.12);
  const lw = def.lights === 'slim' ? 0.3 : def.lights === 'big' ? 0.3 : def.lights === 'round' ? 0.17 : 0.26;
  const lh = def.lights === 'slim' ? 0.06 : def.lights === 'big' ? 0.15 : def.lights === 'round' ? 0.17 : 0.11;
  const lz = wF - lw / 2 - 0.05;
  for (const s of [1, -1]) {
    const hl = facePlate(lw, lh, head, fx, ly, s * lz, true, def.lights === 'round');
    lights.push(hl); body.add(hl);
  }
  const grilleW = Math.max(0.2, 2 * (lz - lw / 2) - 0.06);
  body.add(facePlate(grilleW, def.lights === 'slim' ? 0.1 : lh * 0.9, dark, fx, ly - (def.lights === 'slim' ? 0.1 : 0), 0, true));
  body.add(facePlate(2 * wF * 0.96, 0.1, dark, fx + 0.001, 0.2, 0, true));
  body.add(facePlate(0.32, 0.08, plate, fx + 0.002, 0.27, 0, true));
  if (def.boxy > 0.8) body.add(facePlate(2 * wF * 0.9, 0.025, chrome, fx + 0.001, 0.27 + 0.06, 0, true)); // friso cromado dos antigos

  // ---- traseira: lanternas, para-choque e placa ----
  const ty = def.tailY - (def.tail === 'tall' ? 0.2 : 0.14);
  for (const s of [1, -1]) {
    const tl = def.tail === 'tall' ? facePlate(0.13, 0.26, tail, rx, ty, s * (wR - 0.1), false)
      : def.tail === 'round' ? facePlate(0.14, 0.14, tail, rx, ty, s * (wR - 0.16), false, true)
      : facePlate(0.42, 0.1, tail, rx, ty, s * (wR - 0.26), false);
    lights.push(tl); body.add(tl);
  }
  body.add(facePlate(2 * wR * 0.96, 0.1, dark, rx - 0.001, 0.2, 0, false));
  body.add(facePlate(0.32, 0.1, plate, rx - 0.002, Math.min(ty - 0.16, 0.42), 0, false));

  // ---- retrovisores, rack do SUV, aerofólio ----
  const mirrorX = def.cowlX - 0.12;
  const beltAtMirror = def.hoodY + 0.06;
  for (const s of [1, -1]) {
    const side = halfWidthAt(def, mirrorX);
    body.add(box(0.05, 0.03, 0.08, dark, mirrorX + 0.02, beltAtMirror + 0.03, s * (side + 0.02)));       // haste
    body.add(box(0.12, 0.08, 0.1, solidPaint, mirrorX, beltAtMirror + 0.06, s * (side + 0.08)));        // capa
  }
  if (def.body === 'suv') {
    for (const s of [1, -1]) body.add(box(Math.abs(def.roofFX - def.roofRX) - 0.2, 0.04, 0.04, dark,
      (def.roofFX + def.roofRX) / 2, def.roofY + 0.03, s * (def.W / 2) * def.tumble * 0.85));
  }
  if (spec.spoiler && def.bedX == null && def.body !== 'van') {
    const onRoof = def.body === 'hatch' || def.body === 'perua' || def.body === 'suv';
    const wingX = onRoof ? def.roofRX - 0.02 : -h + 0.16;
    const wingY = onRoof ? def.roofY + 0.03 : def.tailY + 0.15;
    body.add(box(0.24, 0.03, (onRoof ? def.W * def.tumble : def.W) - 0.14, solidPaint, wingX, wingY, 0));
    if (!onRoof) for (const s of [1, -1]) body.add(box(0.06, 0.13, 0.04, dark, wingX + 0.02, def.tailY + 0.08, s * (def.W / 2 - 0.35)));
  }

  // ---- rodas: pneu, roda e raios; giram em volta do eixo ----
  const tire = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.92 });
  const tireGeo = new THREE.CylinderGeometry(rw, rw, 0.24, 36);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(rw * 0.7, rw * 0.7, 0.246, 32);
  rimGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(rw * 0.16, rw * 0.16, 0.252, 12);
  hubGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(rw * 1.3, 0.05, 0.25);
  const wheels: THREE.Object3D[] = [];
  const camber = ((spec.camber ?? 0) * Math.PI) / 180;
  const wz = wheelZ(def, spec.wheelPosition);
  const group = new THREE.Group();
  const { front, rear } = axles(def);
  for (const x of [front, rear]) {
    for (const s of [1, -1]) {
      const holder = new THREE.Group();
      holder.position.set(x, rw, s * wz);
      holder.rotation.x = s * camber; // topo da roda pra dentro
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tire));
      spin.add(new THREE.Mesh(rimGeo, chrome));
      spin.add(new THREE.Mesh(hubGeo, dark));
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(spokeGeo, dark);
        sp.rotation.z = (i * Math.PI) / 5;
        spin.add(sp);
      }
      holder.add(spin);
      wheels.push(spin);
      group.add(holder);
    }
  }

  addGround(group, def, spec);
  group.add(body);
  return { group, wheels, body, lights, def };
}

/** Sombra macia no chão, neon embaixo e (no seu carro) o anel azul. */
function addGround(group: THREE.Group, def: ModelDef, spec: CarSpec) {
  // ---- sombra macia no chão, neon embaixo e (no seu carro) o anel azul ----
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(def.L * 1.16, def.W * 1.45),
    new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.6)', 0.5), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004;
  group.add(shadow);
  // sombra escura bem embaixo (contato com o chão): o carro "pousa" no mapa
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(def.L * 0.98, def.W * 0.98),
    new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.75)', 0.62), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.005;
  group.add(contact);
  if (spec.neon && NEON[spec.neon]) {
    const c = new THREE.Color(NEON[spec.neon]);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(def.L * 1.35, def.W * 2.0),
      new THREE.MeshBasicMaterial({ map: radial(`#${c.getHexString()}`, 0.3), transparent: true, opacity: 0.85,
                                    blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.008;
    group.add(glow);
  }
  if (spec.me) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(def.L * 0.6, def.L * 0.64, 64),
      new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
    group.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(def.L * 0.6, 64),
      new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.12, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005;
    group.add(disc);
  }
}

/** Carro pronto do kit (se já baixou); senão null e o desenho feito à mão segura até chegar. */
function buildFromKit(spec: CarSpec, env: THREE.Texture | null, onReady: () => void): Model | null {
  const def = resolveModel({ body: spec.body, make: spec.make, model: spec.model, version: spec.version, year: spec.year }).def;
  const kit = kitFor(def.body, onReady);
  if (!kit) return null;
  const k = buildKitCar(kit, def, { color: spec.color ?? '#B9C0CB', tint: spec.tint, rideHeightCm: spec.rideHeight, camber: spec.camber, env });
  const group = new THREE.Group();
  addGround(group, def, spec);
  group.add(k.root);
  return { group, wheels: k.wheels, body: k.body, lights: [], def, kit: { baseY: k.baseY, sy: k.sy } };
}

export function specKey(s: CarSpec): string {
  const m = resolveModel({ body: s.body, make: s.make, model: s.model, version: s.version, year: s.year }).id;
  return [m, s.color, s.body, s.tint, s.spoiler ? 1 : 0, s.neon, s.rim, s.rideHeight, s.camber, s.wheelPosition, s.me ? 1 : 0].join('|');
}

class Studio {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
  env: THREE.Texture | null = null;
  models = new Map<string, Model>();
  current: Model | null = null;
  size = 0;
  /** muda quando um carro do kit termina de baixar (quem desenha compara pra redesenhar) */
  rev = 0;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.resize(256);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // sem ACES: ele lava as cores fortes (verde-limão virava amarelo claro)
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    } catch { this.env = null; }
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3038, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-4, 9, 5);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbcd4ff, 0.45);  // luz de recorte atrás: destaca a silhueta
    rim.position.set(4, 3, -6);
    this.scene.add(rim);
  }

  /** Desenha na resolução do lugar onde o carro aparece (no mapa é pequeno; na garagem, grande e nítido). */
  private resize(px: number) {
    const s = Math.min(640, Math.max(128, Math.ceil(px / 64) * 64));
    if (s === this.size) return;
    this.size = s;
    this.renderer.setSize(s, s, false);
  }

  private model(spec: CarSpec): Model {
    const key = specKey(spec);
    let m = this.models.get(key);
    if (!m || !m.kit) {
      const fromKit = buildFromKit(spec, this.env, () => { this.rev++; });
      if (fromKit) {
        if (m) { if (this.current === m) { this.scene.remove(m.group); this.current = null; } disposeModel(m); }
        m = fromKit;
        this.models.set(key, m);
      }
    }
    if (!m) {
      if (this.models.size > 40) {
        for (const v of this.models.values()) disposeModel(v);
        this.models.clear();
        if (this.current) { this.scene.remove(this.current.group); this.current = null; }
      }
      m = buildCar(spec, this.env);
      this.models.set(key, m);
    }
    return m;
  }

  /** Desenha o carro no canvas de destino (já com o tamanho certo em pixels). */
  draw(target: HTMLCanvasElement, spec: CarSpec, v: View3D) {
    const m = this.model(spec);
    if (this.current !== m) {
      if (this.current) this.scene.remove(this.current.group);
      this.scene.add(m.group);
      this.current = m;
    }
    this.resize(Math.max(target.width, target.height));
    // frente do carro (x+) virada pra direção "rel" na tela
    m.group.rotation.y = ((90 - v.rel) * Math.PI) / 180;
    if (m.kit) {
      for (const w of m.wheels) w.rotation.x = v.wheel ?? 0;
      m.body.position.y = m.kit.baseY + (v.bob ?? 0) / m.kit.sy;
    } else {
      for (const w of m.wheels) w.rotation.z = -(v.wheel ?? 0);
      m.body.position.y = clearance(m.def, spec.rideHeight) + (v.bob ?? 0);
    }
    for (const l of m.lights) (l.material as THREE.MeshStandardMaterial).emissiveIntensity = v.lights ? 1.6 : 0.4;

    // sempre um pouco na diagonal (visão de cima inclinada, como nos apps de GPS), mesmo com o mapa reto;
    // quanto mais o mapa inclina, mais de lado o carro aparece
    const elev = ((v.elev ?? Math.min(62, Math.max(34, 62 - v.pitch * 0.5))) * Math.PI) / 180;
    const half = HALF / Math.max(0.5, v.zoom ?? 1);
    this.camera.left = -half; this.camera.right = half; this.camera.top = half; this.camera.bottom = -half;
    const d = 20;
    this.camera.position.set(0, Math.sin(elev) * d + 0.5, Math.cos(elev) * d);
    this.camera.up.set(0, Math.cos(elev), -Math.sin(elev));
    this.camera.lookAt(0, 0.5, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.imageSmoothingQuality = 'high';
    // o estúdio desenha quadrado; destino mais largo que alto pega a faixa do meio (sem esticar o carro)
    const S = this.renderer.domElement.width;
    const ar = target.width / target.height;
    const sw = ar >= 1 ? S : S * ar, sh = ar >= 1 ? S / ar : S;
    ctx.drawImage(this.renderer.domElement, (S - sw) / 2, (S - sh) / 2, sw, sh, 0, 0, target.width, target.height);
  }
}

/** Libera da memória. Carro do kit divide a malha com o original baixado: só a textura pintada sai. */
function disposeModel(m: Model) {
  if (!m.kit) { dispose(m.group); return; }
  m.group.traverse((x) => {
    const mat = (x as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (mat) { mat.map?.dispose(); mat.dispose(); }
  });
}

function dispose(o: THREE.Object3D) {
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((mm) => mm.dispose());
  });
}

let studio: Studio | null | undefined;
/** O estúdio único do app (ou null se o aparelho não tiver WebGL: aí o carro volta pro desenho 2D). */
export function getStudio(): Studio | null {
  if (studio !== undefined) return studio;
  try { studio = new Studio(); } catch { studio = null; }
  return studio;
}

/** Fração do quadro que o carro ocupa (pra calcular o tamanho do canvas). */
export const FRAME_METERS = HALF * 2;
