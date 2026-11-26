// Carro em 3D (só no navegador): monta o modelo do carro da garagem com three.js e desenha
// num "estúdio" único (um só contexto WebGL pro app inteiro). Cada carrinho do mapa é um <canvas>
// comum que recebe a imagem pronta, sempre do mesmo ângulo que a câmera do mapa está olhando.
// Assim o carro nunca fica achatado quando o mapa inclina: ele é visto de cima na diagonal, de verdade.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { archSpan, clearance, profileFor, silhouette, wheelRadius, wheelZ, type Profile3D } from './car3dShape.ts';

import type { CarSpec } from './car3dTypes.ts';
export type { CarSpec } from './car3dTypes.ts';

export interface View3D {
  rel: number;      // direção do carro em relação à tela (graus, 0 = pra cima, horário)
  pitch: number;    // inclinação do mapa (0 = de cima)
  wheel?: number;   // quanto as rodas giraram (rad)
  bob?: number;     // balanço da carroceria (m)
  lights?: boolean; // faróis acesos (noite)
}

const NEON: Record<string, number> = { verde: 0xc6ff3d, azul: 0x3fa0ff, roxo: 0xb36bff };
const GLASS: Record<string, { color: number; opacity: number }> = {
  nenhuma: { color: 0x2b3a4c, opacity: 0.82 }, fume: { color: 0x10151c, opacity: 0.9 }, limo: { color: 0x040506, opacity: 0.97 },
};
const SIZE = 256;         // pixels do quadro onde o carro é desenhado
const HALF = 2.85;        // meia largura do quadro em metros (cabe a picape grande)

interface Model { group: THREE.Group; wheels: THREE.Object3D[]; body: THREE.Object3D; lights: THREE.Mesh[]; p: Profile3D }

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

/** Vidro plano entre dois pontos do perfil (para-brisa ou vidro de trás), um pouco acima da lataria. */
function slopedGlass(a: [number, number], b: [number, number], width: number, mat: THREE.Material, lift: number): THREE.Mesh {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;           // perpendicular ao segmento
  if (ny < 0) { nx = -nx; ny = -ny; }          // a que aponta pra cima (pra fora do carro)
  const inset = 0.06;                          // não encosta nas colunas
  const ax = a[0] + dx * inset + nx * lift, ay = a[1] + dy * inset + ny * lift;
  const bx = b[0] - dx * inset + nx * lift, by = b[1] - dy * inset + ny * lift;
  const w = width / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    ax, ay, -w, bx, by, -w, bx, by, w, ax, ay, w,
  ], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function buildCar(spec: CarSpec, env: THREE.Texture | null): Model {
  const p = profileFor(spec.body);
  const rw = wheelRadius(spec.rim);
  const gc = clearance(p, spec.rideHeight);
  const wcy = rw - gc; // centro da roda em relação ao fundo da carroceria
  const archR = rw + 0.035;
  const bevel = 0.05;

  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(spec.color ?? '#B9C0CB'), metalness: 0.12, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1,
    envMap: env, envMapIntensity: 0.55,
  });
  const g = GLASS[spec.tint ?? 'nenhuma'] ?? GLASS.nenhuma;
  const glass = new THREE.MeshPhysicalMaterial({
    color: g.color, metalness: 0.2, roughness: 0.04, transparent: true, opacity: g.opacity, envMap: env, envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.7 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.2 });

  // contorno de lado com os arcos das rodas recortados embaixo
  const shape = new THREE.Shape();
  const top = silhouette(p);
  const h = p.L / 2;
  shape.moveTo(-h + 0.15, 0);
  const arches = [p.rearAxle, p.frontAxle].map((x) => ({ x, span: archSpan(x, wcy, archR) }));
  for (const a of arches) {
    if (!a.span) continue;
    const [right, left] = a.span;
    shape.lineTo(left, 0);
    // da esquerda, por cima, até a direita (sentido horário)
    const beta = Math.atan2(wcy, right - a.x);
    shape.absarc(a.x, wcy, archR, Math.PI + beta, -beta, true);
    shape.lineTo(right, 0);
  }
  shape.lineTo(h - 0.15, 0);
  for (const [x, y] of top) shape.lineTo(x, y);
  shape.lineTo(-h + 0.15, 0);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: p.W - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  });
  bodyGeo.translate(0, 0, -(p.W - bevel * 2) / 2);
  const bodyMesh = new THREE.Mesh(bodyGeo, paint);

  const body = new THREE.Group();
  body.add(bodyMesh);
  body.position.y = gc;

  // vidros: para-brisa, traseiro e laterais
  const roofFront: [number, number] = [p.roofFrontX, p.roofY], cowl: [number, number] = [p.cowlX, p.cowlY];
  body.add(slopedGlass(cowl, roofFront, p.W * 0.8, glass, bevel + 0.012));
  const rearTop: [number, number] = [p.roofRearX, p.roofY];
  const rearBase: [number, number] = p.bedEndX != null ? [p.rearGlassX, p.roofY - 0.36] : [p.rearGlassX, p.tailY + 0.02];
  if (p.bedEndX == null && Math.abs(rearTop[0] - rearBase[0]) + Math.abs(rearTop[1] - rearBase[1]) > 0.15) {
    body.add(slopedGlass(rearBase, rearTop, p.W * 0.76, glass, bevel + 0.012));
  }
  const belt = Math.max(p.cowlY, p.bedEndX != null ? p.roofY - 0.42 : p.tailY) + 0.05;
  const side = new THREE.Shape();
  const rx = p.bedEndX != null ? p.rearGlassX + 0.06 : p.rearGlassX + 0.16;
  side.moveTo(rx, belt);
  side.lineTo(p.roofRearX + (p.bedEndX != null ? 0.06 : 0.12), p.roofY - 0.06);
  side.lineTo(p.roofFrontX - 0.05, p.roofY - 0.06);
  side.lineTo(p.cowlX - 0.16, belt);
  side.lineTo(rx, belt);
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(side), glass);
    m.position.z = s * (p.W / 2 + 0.004);
    body.add(m);
  }

  // detalhes: grade, para-choques, retrovisores, maçanetas da caçamba
  body.add(box(0.06, 0.16, p.W * 0.5, trim, h + 0.01, p.noseTopY - 0.32, 0));
  body.add(box(0.12, 0.1, p.W - 0.02, dark, h - 0.02, 0.16, 0));
  body.add(box(0.12, 0.1, p.W - 0.02, dark, -h + 0.02, 0.16, 0));
  for (const s of [1, -1]) body.add(box(0.14, 0.09, 0.14, paint, p.cowlX - 0.12, p.cowlY + 0.08, s * (p.W / 2 + 0.07)));
  if (p.bedEndX != null) {
    body.add(box(Math.abs(p.bedEndX - (-h)) - 0.18, 0.012, p.W - 0.26, dark, (p.bedEndX + -h) / 2, p.tailY + bevel + 0.004, 0));
  }
  if (spec.body === 'suv') {
    for (const s of [1, -1]) body.add(box(Math.abs(p.roofFrontX - p.roofRearX) - 0.2, 0.05, 0.05, trim,
      (p.roofFrontX + p.roofRearX) / 2, p.roofY + bevel + 0.04, s * (p.W / 2 - 0.22)));
  }
  if (spec.spoiler && p.bedEndX == null && spec.body !== 'van') {
    const wingX = spec.body === 'hatch' || spec.body === 'perua' || spec.body === 'suv' ? p.roofRearX + 0.02 : -h + 0.18;
    const wingY = spec.body === 'hatch' || spec.body === 'perua' || spec.body === 'suv' ? p.roofY + bevel + 0.02 : p.tailY + 0.16;
    body.add(box(0.26, 0.035, p.W - 0.12, paint, wingX, wingY, 0));
    if (!(spec.body === 'hatch' || spec.body === 'perua' || spec.body === 'suv')) {
      for (const s of [1, -1]) body.add(box(0.06, 0.13, 0.04, trim, wingX + 0.02, p.tailY + 0.08, s * (p.W / 2 - 0.35)));
    }
  }

  // faróis e lanternas
  const lights: THREE.Mesh[] = [];
  const head = new THREE.MeshStandardMaterial({ color: 0xf4f1e6, emissive: 0xfff4d6, emissiveIntensity: 0.35, roughness: 0.2 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x8a0f14, emissive: 0xff1a1a, emissiveIntensity: 0.5, roughness: 0.3 });
  for (const s of [1, -1]) {
    const hl = box(0.05, 0.1, 0.3, head, h + 0.02, p.noseTopY - 0.14, s * (p.W / 2 - 0.26));
    const tl = box(0.05, 0.1, 0.32, tail, -h - 0.02, p.tailY - 0.16, s * (p.W / 2 - 0.24));
    lights.push(hl, tl); body.add(hl, tl);
  }

  // rodas: pneu, roda e raios; giram em volta do eixo
  const tire = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9dde3, metalness: 0.9, roughness: 0.25, envMap: env });
  const tireGeo = new THREE.CylinderGeometry(rw, rw, 0.22, 28);
  tireGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(rw * 0.64, rw * 0.64, 0.226, 24);
  rimGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(rw * 1.2, 0.05, 0.23);
  const wheels: THREE.Object3D[] = [];
  const camber = ((spec.camber ?? 0) * Math.PI) / 180;
  const wz = wheelZ(p, spec.wheelPosition);
  const group = new THREE.Group();
  for (const x of [p.frontAxle, p.rearAxle]) {
    for (const s of [1, -1]) {
      const holder = new THREE.Group();
      holder.position.set(x, rw, s * wz);
      holder.rotation.x = s * camber; // topo da roda pra dentro
      const spin = new THREE.Group();
      spin.add(new THREE.Mesh(tireGeo, tire));
      spin.add(new THREE.Mesh(rimGeo, rimMat));
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(spokeGeo, trim);
        sp.rotation.z = (i * Math.PI) / 5;
        spin.add(sp);
      }
      holder.add(spin);
      wheels.push(spin);
      group.add(holder);
    }
  }

  // sombra macia no chão, neon embaixo e (no seu carro) o anel azul
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(p.L * 1.18, p.W * 1.5),
    new THREE.MeshBasicMaterial({ map: radial('rgba(0,0,0,0.55)', 0.45), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004;
  group.add(shadow);
  if (spec.neon && NEON[spec.neon]) {
    const c = new THREE.Color(NEON[spec.neon]);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(p.L * 1.35, p.W * 2.0),
      new THREE.MeshBasicMaterial({ map: radial(`#${c.getHexString()}`, 0.3), transparent: true, opacity: 0.85,
                                    blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.008;
    group.add(glow);
  }
  if (spec.me) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(p.L * 0.6, p.L * 0.64, 64),
      new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006;
    group.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.L * 0.6, 64),
      new THREE.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.12, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.005;
    group.add(disc);
  }

  group.add(body);
  return { group, wheels, body, lights, p };
}

export function specKey(s: CarSpec): string {
  return [s.color, s.body, s.tint, s.spoiler ? 1 : 0, s.neon, s.rim, s.rideHeight, s.camber, s.wheelPosition, s.me ? 1 : 0].join('|');
}

class Studio {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 100);
  env: THREE.Texture | null = null;
  models = new Map<string, Model>();
  current: Model | null = null;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(SIZE, SIZE, false);
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
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x303640, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-3, 8, 4);
    this.scene.add(sun);
  }

  private model(spec: CarSpec): Model {
    const key = specKey(spec);
    let m = this.models.get(key);
    if (!m) {
      if (this.models.size > 40) { for (const v of this.models.values()) dispose(v.group); this.models.clear(); }
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
    // frente do carro (x+) virada pra direção "rel" na tela
    m.group.rotation.y = ((90 - v.rel) * Math.PI) / 180;
    for (const w of m.wheels) w.rotation.z = -(v.wheel ?? 0);
    m.body.position.y = clearance(m.p, spec.rideHeight) + (v.bob ?? 0);
    for (const l of m.lights) (l.material as THREE.MeshStandardMaterial).emissiveIntensity = v.lights ? 1.6 : 0.4;

    // câmera: de cima quando o mapa está reto; inclina junto com o mapa (mas sempre um pouco na diagonal)
    // sempre um pouco na diagonal (visão de cima inclinada, como nos apps de GPS), mesmo com o mapa reto;
    // quanto mais o mapa inclina, mais de lado o carro aparece
    const elev = (Math.min(62, Math.max(34, 62 - v.pitch * 0.5)) * Math.PI) / 180;
    const d = 20;
    this.camera.position.set(0, Math.sin(elev) * d + 0.5, Math.cos(elev) * d);
    this.camera.up.set(0, Math.cos(elev), -Math.sin(elev));
    this.camera.lookAt(0, 0.5, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);

    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(this.renderer.domElement, 0, 0, target.width, target.height);
  }
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
