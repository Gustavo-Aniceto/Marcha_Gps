// Carros 3D prontos do "Car Kit" da Kenney (licença CC0: uso livre, inclusive comercial; ficam em
// public/models/car). Cada tipo de carroceria usa um modelo; a cor da lataria e o vidro (fumê/limo)
// são trocados direto na textura, e o tamanho segue as medidas do modelo da garagem (Gol, Opala...).
// Só no navegador. Enquanto o arquivo baixa, o car3d.ts desenha o carro "feito à mão" de antes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelDef } from './car3dShape.ts';

const BASE_URL = '/models/car/';
export const KIT_FILE: Record<string, string> = {
  hatch: 'hatchback-sports', seda: 'sedan', perua: 'suv-luxury', picape: 'truck', picape_grande: 'truck',
  suv: 'suv', esportivo: 'sedan-sports', van: 'van',
};

// células da textura (16 colunas x 4 linhas, 32x128 px numa imagem 512x512)
const CELL_W = 32, CELL_H = 128;
const NEUTRAL = new Set(['7,2', '5,2', '1,3']); // fundo/para-choque, grade/luzes, vidro
const GLASS_CELL = '1,3';

interface Kit { scene: THREE.Group; paintCell: string; image: HTMLImageElement | ImageBitmap; length: number; width: number; height: number }
const kits = new Map<string, Kit | 'loading' | 'failed'>();
let loader: GLTFLoader | null = null;

/** Já está pronto pra usar? Se não estiver, começa a baixar e chama onReady quando terminar. */
export function kitFor(body: string, onReady: () => void): Kit | null {
  const file = KIT_FILE[body] ?? KIT_FILE.hatch;
  const k = kits.get(file);
  if (k && k !== 'loading' && k !== 'failed') return k;
  if (!k) {
    kits.set(file, 'loading');
    loader ??= new GLTFLoader();
    loader.load(`${BASE_URL}${file}.glb`, (gltf) => {
      const scene = gltf.scene;
      const body = scene.getObjectByName('body') as THREE.Mesh | undefined;
      const mat = (body?.material ?? null) as THREE.MeshStandardMaterial | null;
      const image = mat?.map?.image as HTMLImageElement | ImageBitmap | undefined;
      if (!body || !image) { kits.set(file, 'failed'); return; }
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      kits.set(file, { scene, paintCell: paintCellOf(body), image, length: size.z, width: size.x, height: size.y });
      onReady();
    }, undefined, () => kits.set(file, 'failed'));
  }
  return null;
}

/** A célula da textura que mais aparece na lataria (tirando fundo, grade e vidro) é a cor do carro. */
function paintCellOf(mesh: THREE.Mesh): string {
  const g = mesh.geometry as THREE.BufferGeometry;
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv'), idx = g.getIndex();
  if (!pos || !uv) return '13,1';
  const area = new Map<string, number>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const ar = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
    const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3, v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3;
    const key = `${Math.floor((u * 512) / CELL_W)},${Math.floor((v * 512) / CELL_H)}`;
    if (!NEUTRAL.has(key)) area.set(key, (area.get(key) ?? 0) + ar);
  }
  let best = '13,1', max = -1;
  for (const [k, v] of area) if (v > max) { max = v; best = k; }
  return best;
}

const GLASS_TINT: Record<string, [number, number, number] | null> = {
  nenhuma: null, fume: [52, 62, 80], limo: [14, 16, 22],
};

/** Textura com a cor do carro e o vidro pedidos (mantém o degradê de luz de cada célula). */
function paintTexture(kit: Kit, color: string, tint: string | null | undefined): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(kit.image as CanvasImageSource, 0, 0, 512, 512);
  const want = new THREE.Color(color);
  const recolor = (cell: string, rgb: [number, number, number]) => {
    const [cx, cy] = cell.split(',').map(Number);
    const img = ctx.getImageData(cx * CELL_W, cy * CELL_H, CELL_W, CELL_H);
    const d = img.data;
    let top = 1;
    for (let i = 0; i < d.length; i += 4) top = Math.max(top, 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    for (let i = 0; i < d.length; i += 4) {
      const k = Math.min(1.08, (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / top); // luz do degradê
      d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k); d[i + 2] = Math.min(255, rgb[2] * k);
    }
    ctx.putImageData(img, cx * CELL_W, cy * CELL_H);
  };
  recolor(kit.paintCell, [want.r * 255, want.g * 255, want.b * 255]);
  const g = GLASS_TINT[tint ?? 'nenhuma'];
  if (g) recolor(GLASS_CELL, g);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;   // igual à textura do glTF
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

export interface KitBuild { root: THREE.Group; wheels: THREE.Object3D[]; body: THREE.Object3D; baseY: number; sy: number }

/**
 * Monta o carro do kit no tamanho do modelo da garagem (metros), com a frente pra +x (igual ao resto do car3d).
 * Rebaixado: a carroceria desce até o pneu; cambagem inclina as rodas.
 */
export function buildKitCar(kit: Kit, def: ModelDef, opts: {
  color: string; tint?: string | null; rideHeightCm?: number | null; camber?: number | null; env: THREE.Texture | null;
}): KitBuild {
  const scene = kit.scene.clone(true);
  const tex = paintTexture(kit, opts.color, opts.tint);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.15, envMap: opts.env, envMapIntensity: 0.5 });
  scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = mat; } });

  // tamanho: comprimento do modelo da garagem; largura e altura acompanham (com limite pra não deformar)
  const s = def.L / kit.length;
  const sx = s * Math.min(1.12, Math.max(0.9, def.W / (kit.width * s)));
  const sy = s * Math.min(1.12, Math.max(0.88, (def.roofY + 0.2) / (kit.height * s)));
  scene.scale.set(sx, sy, s);

  const body = scene.getObjectByName('body')!;
  const baseY = body.position.y;
  // rebaixado: cada cm abaixo de 15 desce a carroceria (no máximo até encostar no pneu)
  const drop = Math.max(0, 15 - (opts.rideHeightCm ?? 15)) / 100 / sy;
  body.position.y = Math.max(baseY * 0.35, baseY - drop);

  const wheels: THREE.Object3D[] = [];
  const camber = ((opts.camber ?? 0) * Math.PI) / 180;
  scene.traverse((o) => {
    if (!/^wheel-(front|back)-(left|right)$/.test(o.name)) return;
    // a roda gira num "pivô" pra cambagem não brigar com o giro
    const pivot = new THREE.Group();
    pivot.position.copy(o.position);
    o.parent!.add(pivot);
    o.position.set(0, 0, 0);
    pivot.add(o);
    pivot.rotation.z = (o.name.endsWith('left') ? 1 : -1) * camber; // topo da roda pra dentro
    wheels.push(o);
  });

  const root = new THREE.Group();
  scene.rotation.y = Math.PI / 2; // frente do kit (+z) vira +x
  root.add(scene);
  return { root, wheels, body, baseY: body.position.y, sy };
}
