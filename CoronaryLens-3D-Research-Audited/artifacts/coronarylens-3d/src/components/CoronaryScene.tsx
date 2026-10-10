import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { Target } from "@workspace/api-client-react";

type VesselTarget = Exclude<Target, "CAD">;
type Props = {
  selected: Target;
  onSelect: (target: Target) => void;
  /** Model-reported positive-class probability outputs; not calibrated clinical risk. */
  scores?: Partial<Record<VesselTarget, number>>;
};

const neutralVessel = "#8d9b95";
const lowerScoreColor = new THREE.Color("#4f9b9a");
const middleScoreColor = new THREE.Color("#e0b257");
const higherScoreColor = new THREE.Color("#c5525e");

function probabilityColor(score: number | undefined): THREE.Color {
  if (score == null || !Number.isFinite(score)) return new THREE.Color(neutralVessel);
  const probability = THREE.MathUtils.clamp(score, 0, 1);
  if (probability <= 0.5) {
    return lowerScoreColor.clone().lerp(middleScoreColor, probability * 2);
  }
  return middleScoreColor.clone().lerp(higherScoreColor, (probability - 0.5) * 2);
}

function probabilityColorCss(score: number | undefined): string {
  return probabilityColor(score).getStyle(THREE.SRGBColorSpace);
}

type SceneControls = {
  controls: OrbitControls;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
};

function point(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z);
}

function tube(
  points: THREE.Vector3[],
  radius: number,
  color: THREE.ColorRepresentation,
  opacity = 1,
) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 48, radius, 10, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.04,
    transparent: opacity < 1,
    opacity,
  });
  return new THREE.Mesh(geometry, material);
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function makeHeart(vesselMaterials: Map<Exclude<Target, "CAD">, THREE.MeshStandardMaterial>): THREE.Group {
  const group = new THREE.Group();
  const outline = new THREE.Shape();
  outline.moveTo(0, -1.12);
  outline.bezierCurveTo(-0.24, -0.91, -1.03, -0.42, -1.13, 0.23);
  outline.bezierCurveTo(-1.23, 0.79, -0.91, 1.09, -0.52, 1.08);
  outline.bezierCurveTo(-0.27, 1.08, -0.08, 0.92, 0, 0.73);
  outline.bezierCurveTo(0.17, 1.03, 0.42, 1.13, 0.67, 1.03);
  outline.bezierCurveTo(1.08, 0.88, 1.2, 0.33, 1.04, -0.11);
  outline.bezierCurveTo(0.83, -0.65, 0.23, -0.98, 0, -1.12);

  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: 0.56,
    bevelEnabled: true,
    bevelSegments: 7,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.16,
    curveSegments: 22,
  });
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      color: "#c98776",
      roughness: 0.59,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
    }),
  );
  surface.position.z = -0.28;
  group.add(surface);

  const chamberMaterial = new THREE.MeshStandardMaterial({
    color: "#d99e8e",
    roughness: 0.62,
  });
  const leftAtrium = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 28, 22),
    chamberMaterial,
  );
  leftAtrium.scale.set(0.88, 1.12, 0.68);
  leftAtrium.position.set(-0.43, 0.68, 0.03);
  group.add(leftAtrium);
  const rightAtrium = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 28, 22),
    chamberMaterial.clone(),
  );
  rightAtrium.scale.set(0.9, 1.1, 0.68);
  rightAtrium.position.set(0.39, 0.69, 0.03);
  group.add(rightAtrium);

  group.add(
    tube(
      [
        point(-0.16, 0.76, 0.13),
        point(-0.24, 1.23, 0.12),
        point(-0.14, 1.65, 0.09),
        point(0.26, 1.73, 0.06),
        point(0.43, 1.48, 0.06),
        point(0.3, 1.2, 0.06),
      ],
      0.13,
      "#bd7969",
    ),
  );
  group.add(
    tube(
      [
        point(-0.22, 1.13, 0.06),
        point(-0.49, 1.42, 0.03),
        point(-0.62, 1.59, 0.02),
      ],
      0.065,
      "#bd7969",
    ),
  );
  group.add(
    tube(
      [
        point(0.28, 1.18, 0.05),
        point(0.52, 1.43, 0.01),
        point(0.63, 1.6, 0),
      ],
      0.061,
      "#bd7969",
    ),
  );

  const surfacePaths: Record<Exclude<Target, "CAD">, THREE.Vector3[]> = {
    LAD: [
      point(0, 0.7, 0.38),
      point(0.06, 0.54, 0.48),
      point(0.1, 0.26, 0.52),
      point(0.06, -0.05, 0.49),
      point(0.1, -0.38, 0.43),
      point(0.05, -0.68, 0.35),
      point(0.12, -0.94, 0.24),
    ],
    LCX: [
      point(-0.04, 0.68, 0.41),
      point(-0.24, 0.67, 0.47),
      point(-0.48, 0.55, 0.49),
      point(-0.72, 0.39, 0.44),
      point(-0.9, 0.16, 0.34),
      point(-0.91, -0.05, 0.29),
    ],
    RCA: [
      point(0.1, 0.64, 0.43),
      point(0.34, 0.58, 0.47),
      point(0.57, 0.39, 0.46),
      point(0.76, 0.13, 0.39),
      point(0.79, -0.17, 0.32),
      point(0.68, -0.44, 0.3),
      point(0.44, -0.6, 0.29),
    ],
  };

  for (const target of ["LAD", "LCX", "RCA"] as const) {
    const vessel = tube(surfacePaths[target], 0.039, "#78877f", 0.78);
    vessel.userData.target = target;
    vesselMaterials.set(
      target,
      vessel.material as THREE.MeshStandardMaterial,
    );
    group.add(vessel);
  }

  return group;
}

function FallbackAnatomy({
  selected,
  onSelect,
  scores,
}: Props) {
  const paths: Record<Exclude<Target, "CAD">, string> = {
    LAD: "M140 110 C142 138 139 160 143 185 C146 210 141 234 147 257",
    LCX: "M139 108 C123 113 105 120 91 133 C80 143 71 148 61 151",
    RCA: "M143 109 C161 114 178 125 186 140 C194 156 190 175 183 192 C177 207 170 218 167 231",
  };
  return (
    <div className="scene-fallback" role="img" aria-label="Two-dimensional schematic of coronary branches; patient-specific anatomy is not shown.">
      <svg viewBox="0 0 280 290" aria-hidden="true">
        <path d="M140 258 C122 238 91 214 83 181 C74 146 91 117 113 113 C126 111 135 120 141 132 C152 112 174 108 188 122 C209 143 201 177 187 202 C174 228 155 246 140 258Z" fill="#e2cec5" stroke="#c3a99d" strokeWidth="2" />
        {(["LAD", "LCX", "RCA"] as const).map((target) => (
          <g key={target}>
            <path
              d={paths[target]}
              fill="none"
              stroke={probabilityColorCss(scores?.[target])}
              strokeWidth={selected === target ? 6 : 4}
              strokeLinecap="round"
            />
            <text
              x={target === "LAD" ? 152 : target === "LCX" ? 55 : 190}
              y={target === "LAD" ? 264 : target === "LCX" ? 155 : 238}
              fill="#52645c"
              fontSize="10"
              fontFamily="monospace"
            >
              {target}
            </text>
          </g>
        ))}
      </svg>
      <span>WebGL unavailable · 2D schematic fallback</span>
      <div className="scene-fallback-actions">
        {(["LAD", "LCX", "RCA"] as const).map((target) => (
          <button
            key={target}
            type="button"
            aria-pressed={selected === target}
            onClick={() => onSelect(target)}
          >
            {target}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CoronaryScene({ selected, onSelect, scores }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<SceneControls | null>(null);
  const renderRequestRef = useRef<(() => void) | null>(null);
  const vesselMaterialsRef = useRef(new Map<Exclude<Target, "CAD">, THREE.MeshStandardMaterial>());
  const onSelectRef = useRef(onSelect);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFallback(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f0f3ed");
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);
    camera.position.set(0, 0.14, 6.7);
    const target = new THREE.Vector3(0, 0.22, 0);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 3.8;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.83;
    controlsRef.current = { controls, camera, target };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "coronary-scene-canvas";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive three-dimensional schematic of the heart and coronary arteries. Drag to rotate, use the wheel or pinch to zoom. No patient-specific anatomy is shown.",
    );
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#ffffff", "#9baba1", 2));
    const keyLight = new THREE.DirectionalLight("#fff9ef", 2.1);
    keyLight.position.set(-3, 5, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight("#d9e9e0", 1.2);
    fillLight.position.set(4, -1, 3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight("#c5d5cf", 1.3);
    rimLight.position.set(1, 2, -4);
    scene.add(rimLight);

    const model = makeHeart(vesselMaterialsRef.current);
    scene.add(model);

    let requestRender: () => void = () => undefined;
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      requestRender();
    });
    resizeObserver.observe(host);
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width || 600, height || 445, false);

    let animationFrame = 0;
    let disposed = false;
    const render = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      animationFrame = 0;
      if (controls.enabled && controls.autoRotate) requestRender();
    };
    requestRender = () => {
      if (!disposed && animationFrame === 0) animationFrame = window.requestAnimationFrame(render);
    };
    renderRequestRef.current = requestRender;
    controls.addEventListener("change", requestRender);
    renderer.domElement.addEventListener("pointermove", requestRender);
    requestRender();

    const raycaster = new THREE.Raycaster();
    raycaster.params.Mesh = { threshold: 0.12 };
    const pointer = new THREE.Vector2();
    let pointerDown: { x: number; y: number } | undefined;
    const onPointerDown = (event: PointerEvent) => {
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const selectable = model.children.filter((child) => child.userData.target);
      const hit = raycaster.intersectObjects(selectable, false)[0];
      if (hit?.object.userData.target) {
        onSelectRef.current(hit.object.userData.target as Target);
      }
      pointerDown = undefined;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      controls.removeEventListener("change", requestRender);
      renderer.domElement.removeEventListener("pointermove", requestRender);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      controlsRef.current = null;
      renderRequestRef.current = null;
      vesselMaterialsRef.current.clear();
      disposeTree(model);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    vesselMaterialsRef.current.forEach((material, target) => {
      const active = selected === target;
      const mappedColor = probabilityColor(scores?.[target]);
      material.color.copy(mappedColor);
      material.opacity = scores?.[target] == null ? 0.58 : (active ? 1 : 0.9);
      material.emissive.copy(active ? mappedColor : new THREE.Color("#000000"));
      material.emissiveIntensity = active && scores?.[target] != null ? 0.12 : 0;
    });
    renderRequestRef.current?.();
  }, [selected, scores]);

  const rotate = (angle: number) => {
    const refs = controlsRef.current;
    if (!refs) return;
    const offset = refs.camera.position.clone().sub(refs.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    refs.camera.position.copy(refs.target).add(offset);
    refs.controls.update();
  };

  const zoom = (amount: number) => {
    const refs = controlsRef.current;
    if (!refs) return;
    const offset = refs.camera.position.clone().sub(refs.target).multiplyScalar(amount);
    refs.camera.position.copy(refs.target).add(offset);
    refs.controls.update();
  };

  return (
    <div className="coronary-scene-wrap">
      <div ref={containerRef} className="coronary-scene" data-testid="coronary-3d-scene">
        {fallback ? <FallbackAnatomy selected={selected} onSelect={onSelect} scores={scores} /> : null}
      </div>
      {!fallback ? (
        <div className="scene-controls" role="group" aria-label="3D anatomy controls">
          <button type="button" aria-label="Rotate anatomy left" title="Rotate left" onClick={() => rotate(-0.27)} data-testid="button-rotate-left">
            <RotateCcw size={14} />
          </button>
          <button type="button" aria-label="Rotate anatomy right" title="Rotate right" onClick={() => rotate(0.27)} data-testid="button-rotate-right">
            <RotateCcw size={14} className="scene-rotate-right" />
          </button>
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(0.86)} data-testid="button-zoom-in">
            <ZoomIn size={14} />
          </button>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1.16)} data-testid="button-zoom-out">
            <ZoomOut size={14} />
          </button>
          <button type="button" aria-label="Reset anatomy view" title="Reset view" onClick={() => controlsRef.current?.controls.reset()} data-testid="button-reset-3d">
            <Maximize2 size={13} />
          </button>
        </div>
      ) : null}
      <div className="scene-gesture-hint">Drag to rotate · scroll or pinch to zoom</div>
    </div>
  );
}
