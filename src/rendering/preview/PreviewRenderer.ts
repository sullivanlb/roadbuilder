import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Spherical,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bounds } from '../../core/math';
import type { PlanPoint, Vec3 } from '../../core/math';
import { MATERIALS } from '../../core/scene/materials';
import type { MaterialId } from '../../core/scene/materials';
import type { Scene as TrackScene } from '../../core/scene/scene';
import type { Sample } from '../../core/track/centerline';
import type { TightTurn } from '../../core/track/issues';
import { INACTIVE_LAYER_ALPHA } from '../layers';
import type { LayerId } from '../layers';
import { COLORS } from '../theme';
import { meshLayer } from './overlay';
import type { PreviewOverlay } from './overlay';
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
  /** Selection, stretches and the pointer, drawn over the scene. */
  private readonly overlay = new Group();
  private readonly posts: Mesh[] = [];
  private readonly postGeometry = new CylinderGeometry(1.2, 1.2, 4, 10);
  private readonly cursorMesh = new Mesh(
    new BoxGeometry(1, 0.3, 1.2),
    new MeshBasicMaterial({ color: COLORS.accent }),
  );
  /** One material per scene material, and a see-through one for the layers not edited. */
  private readonly materials = new Map<string, MeshLambertMaterial>();
  private layers: { active: LayerId; hidden: readonly LayerId[] } = { active: 'track', hidden: [] };
  private readonly highlight = new LineBasicMaterial({ color: COLORS.danger, depthTest: false });
  private frame: number | null = null;
  private extent = bounds([]);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new Color(COLORS.preview.sky);
    this.scene.add(new HemisphereLight(0xe8f0e0, 0x2c3a2a, 1.4));
    const sun = new DirectionalLight(0xfff6e0, 1.6);
    sun.position.set(-0.6, 1, 0.4);
    this.cursorMesh.visible = false;
    this.scene.add(sun, this.content, this.overlay, this.cursorMesh);
    this.controls = new OrbitControls(this.camera, canvas);
    // Stay above the horizon: the terrain has no underside worth seeing.
    this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
    this.controls.addEventListener('change', () => this.requestRender());
  }

  private material(id: MaterialId, dimmed = false) {
    const key = `${id}${dimmed ? ':dimmed' : ''}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshLambertMaterial({ color: rgb(MATERIALS[id].color), side: DoubleSide });
      if (dimmed) {
        material.transparent = true;
        material.opacity = INACTIVE_LAYER_ALPHA;
        material.depthWrite = false;
      }
      this.materials.set(key, material);
    }
    return material;
  }

  /** Dims what belongs to the layers not being edited and hides the hidden ones. */
  setLayers(active: LayerId, hidden: readonly LayerId[]) {
    this.layers = { active, hidden };
    for (const child of this.content.children) {
      const layer = child.userData.layer as LayerId | null | undefined;
      if (!layer || !(child instanceof Mesh)) continue;
      child.visible = !hidden.includes(layer);
      child.material = this.material(child.userData.material as MaterialId, layer !== active);
    }
    this.requestRender();
  }

  /** Replaces what is drawn over the scene: highlighted stretches, point posts, the pointer. */
  setOverlay(overlay: PreviewOverlay) {
    for (const child of this.overlay.children) {
      const mesh = child as Mesh;
      if (mesh.geometry !== this.postGeometry) mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.overlay.clear();
    this.posts.length = 0;
    for (const strip of overlay.strips) {
      if (!strip.positions.length) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(strip.positions, 3));
      const material = new MeshBasicMaterial({
        color: strip.color,
        transparent: true,
        opacity: strip.opacity,
        depthWrite: false,
        side: DoubleSide,
      });
      this.overlay.add(new Mesh(geometry, material));
    }
    for (const post of overlay.posts) {
      const mesh = new Mesh(
        this.postGeometry,
        new MeshLambertMaterial({ color: post.selected ? COLORS.accent : COLORS.point.outline }),
      );
      mesh.position.set(post.x, post.y + 2, post.z);
      mesh.userData.point = post.id;
      this.overlay.add(mesh);
      this.posts.push(mesh);
    }
    const cursor = overlay.cursor;
    this.cursorMesh.visible = cursor !== null;
    if (cursor) {
      this.cursorMesh.position.set(cursor.x, cursor.y + 0.3, cursor.z);
      this.cursorMesh.scale.set(2 * cursor.reach, 1, 1);
      this.cursorMesh.rotation.y = Math.atan2(-cursor.nz, cursor.nx);
    }
    this.requestRender();
  }

  /**
   * What lies under a point of the canvas: the place hit on the ground and the
   * control point post, if any. `x` and `y` are in pixels from the canvas corner.
   */
  pick(x: number, y: number): { world: Vec3 | null; pointId: string | null } {
    const size = this.renderer.domElement.getBoundingClientRect();
    const ray = new Raycaster();
    ray.setFromCamera(
      new Vector2((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1),
      this.camera,
    );
    const post = ray.intersectObjects(this.posts, false)[0];
    const ground = ray.intersectObjects(
      this.content.children.filter((child) => child.visible),
      false,
    )[0];
    return {
      world: ground ? { x: ground.point.x, y: ground.point.y, z: ground.point.z } : null,
      pointId: (post?.object.userData.point as string | undefined) ?? null,
    };
  }

  /** Frames a few places, e.g. a corner, from the current viewing direction. */
  framePlaces(points: readonly PlanPoint[]) {
    if (!points.length) return;
    const box = bounds(points, 30);
    const center = new Vector3((box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2);
    center.y = this.controls.target.y;
    const radius = Math.max(60, box.maxX - box.minX, box.maxZ - box.minZ) * 1.1;
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, radius);
    this.controls.update();
    this.requestRender();
  }

  /** Moves the camera so it looks at a place, keeping its distance and direction. */
  centerOn(at: PlanPoint) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.set(at.x, this.controls.target.y, at.z);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.requestRender();
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
      const layer = meshLayer(mesh.name, mesh.kind);
      const shown = new Mesh(
        geometry,
        this.material(mesh.material, layer !== null && layer !== this.layers.active),
      );
      shown.userData = { layer, material: mesh.material };
      shown.visible = !layer || !this.layers.hidden.includes(layer);
      this.content.add(shown);
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
    this.setOverlay({ strips: [], posts: [], cursor: null });
    this.postGeometry.dispose();
    this.cursorMesh.geometry.dispose();
    this.cursorMesh.material.dispose();
    this.highlight.dispose();
    this.renderer.dispose();
  }
}
