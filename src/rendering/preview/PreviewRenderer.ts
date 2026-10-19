import {
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bounds } from '../../core/math';
import { MATERIALS } from '../../core/scene/materials';
import type { MaterialId } from '../../core/scene/materials';
import type { Scene as TrackScene } from '../../core/scene/scene';
import type { Sample } from '../../core/track/centerline';
import type { TightTurn } from '../../core/track/issues';
import { COLORS } from '../theme';
import type { ViewportSize } from '../plan/projection';

/** Initial orbit: looking from the south-west, 45° above the horizon. */
const VIEW_ANGLE = { yaw: -0.45, elevation: 0.8 };

function rgb([r, g, b]: readonly number[]) {
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

/**
 * WebGL preview of the scene with an orbit camera. It draws on demand: after a
 * new scene, a resize or a camera move, never in a continuous loop.
 */
export class PreviewRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, 1, 0.5, 50000);
  private readonly controls: OrbitControls;
  private readonly content = new Group();
  private readonly materials = new Map<MaterialId, MeshLambertMaterial>();
  private readonly highlight = new LineBasicMaterial({ color: COLORS.danger, depthTest: false });
  private frame: number | null = null;
  private extent = bounds([]);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new Color(COLORS.preview.sky);
    this.scene.add(new HemisphereLight(0xe8f0e0, 0x2c3a2a, 1.4));
    const sun = new DirectionalLight(0xfff6e0, 1.6);
    sun.position.set(-0.6, 1, 0.4);
    this.scene.add(sun, this.content);
    this.controls = new OrbitControls(this.camera, canvas);
    // Stay above the horizon: the terrain has no underside worth seeing.
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    this.controls.addEventListener('change', () => this.requestRender());
  }

  private material(id: MaterialId) {
    let material = this.materials.get(id);
    if (!material) {
      material = new MeshLambertMaterial({ color: rgb(MATERIALS[id].color), side: DoubleSide });
      this.materials.set(id, material);
    }
    return material;
  }

  /** Replaces the displayed scene; tight turns are outlined above the road. */
  setScene(scene: TrackScene, samples: readonly Sample[], tightTurns: readonly TightTurn[]) {
    for (const child of this.content.children)
      if ('geometry' in child) (child as Mesh).geometry.dispose();
    this.content.clear();
    for (const mesh of scene.meshes) {
      if (!mesh.visible) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(mesh.positions, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(mesh.normals, 3));
      geometry.setIndex(mesh.indices);
      this.content.add(new Mesh(geometry, this.material(mesh.material)));
    }
    const segments = new Set(tightTurns.map((turn) => turn.segment));
    const lines: number[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      if (!segments.has(samples[i].segment)) continue;
      const a = samples[i],
        b = samples[i + 1];
      lines.push(a.x, a.y + 0.5, a.z, b.x, b.y + 0.5, b.z);
    }
    if (lines.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(lines, 3));
      this.content.add(new LineSegments(geometry, this.highlight));
    }
    const first = !this.content.userData.framed;
    this.extent = bounds(samples, 60);
    if (first && samples.length > 1) {
      this.content.userData.framed = true;
      this.fit();
    }
    this.requestRender();
  }

  /** Frames the whole track from the initial viewing angle. */
  fit() {
    const box = this.extent;
    const center = new Vector3(
      (box.minX + box.maxX) / 2,
      (box.minY + box.maxY) / 2,
      (box.minZ + box.maxZ) / 2,
    );
    const radius = Math.max(60, box.maxX - box.minX, box.maxZ - box.minZ) * 0.85;
    const offset = new Vector3().setFromSpherical(
      new Spherical(radius, Math.PI / 2 - VIEW_ANGLE.elevation, VIEW_ANGLE.yaw),
    );
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(offset);
    this.controls.update();
    this.requestRender();
  }

  /** Moves the camera towards (factor > 1) or away from its target. */
  zoom(factor: number) {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target).divideScalar(factor);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
    this.requestRender();
  }

  resize({ width, height }: ViewportSize, pixelRatio: number) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private requestRender() {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.controls.dispose();
    for (const child of this.content.children)
      if ('geometry' in child) (child as Mesh).geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.highlight.dispose();
    this.renderer.dispose();
  }
}
