import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Maximize2, RotateCcw, ZoomIn, ZoomOut, AlertTriangle, FileDown } from "lucide-react";
import type { Target } from "@workspace/api-client-react";

type VesselTarget = Exclude<Target, "CAD">;
type Props = {
  selected: Target;
  onSelect: (target: Target) => void;
  scores?: Partial<Record<VesselTarget, number>>;
};

const neutralVessel = new THREE.Color("#475569");
const highlightColor = new THREE.Color("#0ea5e9"); // cyan/teal highlight
const lowerScoreColor = new THREE.Color("#0f766e"); // teal
const middleScoreColor = new THREE.Color("#d97706"); // amber
const higherScoreColor = new THREE.Color("#be123c"); // rose/destructive

function probabilityColor(score: number | undefined): THREE.Color {
  if (score == null || !Number.isFinite(score)) return neutralVessel.clone();
  const probability = THREE.MathUtils.clamp(score, 0, 1);
  if (probability <= 0.5) {
    return lowerScoreColor.clone().lerp(middleScoreColor, probability * 2);
  }
  return middleScoreColor.clone().lerp(higherScoreColor, (probability - 0.5) * 2);
}

// Fallback when GLB cannot be loaded, providing the exact manual instructions
function MissingModelOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-[#070b0e] border border-red-900/30 rounded-lg">
      <AlertTriangle size={32} className="text-amber-500 mb-4" />
      <h3 className="text-slate-200 text-lg font-semibold mb-2">Anatomical Model Missing</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-md">
        A genuine medical 3D model is required. Sketchfab and Z-Anatomy require manual login or Blender extraction, which cannot be automated.
      </p>
      <div className="bg-[#111827] text-left p-4 rounded-md border border-slate-800 text-xs text-slate-300 font-mono w-full max-w-lg mb-4">
        1. Download "Realistic Human Heart" from Sketchfab.<br />
        2. Unzip and rename the GLTF/GLB file to <code>coronary-heart.glb</code>.<br />
        3. Place it in <code>artifacts/coronarylens-3d/public/models/</code>.<br />
        4. Name your coronary meshes LAD, LCX, RCA in Blender if not already named.
      </div>
      <a href="https://sketchfab.com/3d-models/3d-digital-model-of-coronary-arteries-cb63e7714a574984835160530957748b" target="_blank" rel="noreferrer" className="button button-primary">
        <FileDown size={14} /> Open Sketchfab
      </a>
    </div>
  );
}

export default function CoronaryScene({ selected, onSelect, scores }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const renderRequestRef = useRef<(() => void) | null>(null);
  
  const vesselMaterialsRef = useRef(new Map<VesselTarget, THREE.MeshPhysicalMaterial>());
  const onSelectRef = useRef(onSelect);
  const [modelError, setModelError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setModelError(true);
      return;
    }

    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 15);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(targetRef.current);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 30;
    controlsRef.current = controls;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);

    // Natural, restrained lighting
    scene.add(new THREE.AmbientLight("#0f172a", 1.5));
    
    // Key light (warm)
    const keyLight = new THREE.DirectionalLight("#fffbeb", 2.0);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);
    
    // Fill light (cool)
    const fillLight = new THREE.DirectionalLight("#e2e8f0", 1.0);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);
    
    // Rim light (sharp)
    const rimLight = new THREE.SpotLight("#ffffff", 3.0);
    rimLight.position.set(0, 5, -10);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    let disposed = false;
    let requestRender: () => void = () => undefined;
    let animationFrame = 0;

    const render = () => {
      if (disposed) return;
      controls.update();
      renderer.render(scene, camera);
      animationFrame = 0;
      if (controls.enabled && controls.autoRotate) requestRender();
    };

    requestRender = () => {
      if (!disposed && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    renderRequestRef.current = requestRender;

    // Load Model
    const loader = new GLTFLoader();
    loader.load(
      import.meta.env.BASE_URL + "models/coronary-heart.glb",
      (gltf) => {
        if (disposed) return;
        setLoading(false);
        const model = gltf.scene;

        // Position & Scale normalization (approximate depending on downloaded asset)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 10 / maxDim;
        model.scale.set(scale, scale, scale);
        
        model.position.sub(center.multiplyScalar(scale));
        scene.add(model);

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name.toUpperCase();
            
            // Create procedural organic meat/fat texture
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#5a0f14"; // deep red base
              ctx.fillRect(0, 0, 512, 512);
              for (let i = 0; i < 15000; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                if (Math.random() > 0.85) { // fatty tissue
                  ctx.fillStyle = `rgba(220, 200, 140, ${Math.random() * 0.3})`;
                  ctx.beginPath();
                  ctx.arc(x, y, Math.random() * 15 + 2, 0, Math.PI * 2);
                  ctx.fill();
                } else { // muscle fibers
                  ctx.strokeStyle = `rgba(140, 10, 20, ${Math.random() * 0.4})`;
                  ctx.lineWidth = Math.random() * 3 + 1;
                  ctx.beginPath();
                  ctx.moveTo(x, y);
                  ctx.lineTo(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 60);
                  ctx.stroke();
                }
              }
            }
            const albMap = new THREE.CanvasTexture(canvas);
            albMap.wrapS = THREE.RepeatWrapping;
            albMap.wrapT = THREE.RepeatWrapping;
            albMap.repeat.set(2, 2);

            const baseMaterial = new THREE.MeshPhysicalMaterial({
              color: "#ffffff",
              map: albMap,
              roughness: 0.3,
              metalness: 0.05,
              clearcoat: 0.8,
              clearcoatRoughness: 0.2,
              sheen: 0.5,
              sheenColor: new THREE.Color("#4a0000") // slight velvet/flesh rim
            });

            if (name.includes("LAD") || name.includes("LCX") || name.includes("RCA")) {
              const target = name.includes("LAD") ? "LAD" : name.includes("LCX") ? "LCX" : "RCA";
              child.userData.target = target;
              
              // Vessels have slightly different color but still realistic
              const vesselMat = new THREE.MeshPhysicalMaterial({
                color: neutralVessel.clone(),
                roughness: 0.3,
                metalness: 0.1,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1,
              });
              child.material = vesselMat;
              vesselMaterialsRef.current.set(target, vesselMat);
            } else {
              // Main heart body
              if (child.material && (child.material as THREE.MeshStandardMaterial).map) {
                const orig = child.material as THREE.MeshStandardMaterial;
                baseMaterial.map = orig.map; // use actual UV map if exists, otherwise it will use canvas map seamlessly mapped but UVs might be messy (trimesh icosphere has weird default UVs unless spherical mapping)
              }
              child.material = baseMaterial;
            }
          }
        });
        requestRender();
      },
      undefined,
      (error) => {
        console.error("Error loading model:", error);
        if (!disposed) {
          setLoading(false);
          setModelError(true);
        }
      }
    );

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      requestRender();
    });
    resizeObserver.observe(host);

    controls.addEventListener("change", requestRender);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPosition: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPosition = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownPosition) return;
      const dist = Math.hypot(e.clientX - pointerDownPosition.x, e.clientY - pointerDownPosition.y);
      if (dist > 5) return; // it was a drag, not a click
      
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;
      
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      for (const hit of intersects) {
        const tgt = hit.object.userData?.target;
        if (tgt) {
          onSelectRef.current(tgt as Target);
          break;
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      controls.dispose();
      resizeObserver.disconnect();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, []);

  // Update materials when selection or scores change
  useEffect(() => {
    vesselMaterialsRef.current.forEach((material, target) => {
      const active = selected === target;
      const mappedColor = probabilityColor(scores?.[target]);
      
      // If inactive, desaturate slightly. If active, glow.
      material.color.copy(active ? mappedColor : mappedColor.clone().lerp(neutralVessel, 0.4));
      material.emissive.copy(active ? mappedColor : new THREE.Color(0x000000));
      material.emissiveIntensity = active ? 0.3 : 0.0;
    });
    renderRequestRef.current?.();
  }, [selected, scores]);

  const rotate = (angle: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const offset = cameraRef.current.position.clone().sub(targetRef.current);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    cameraRef.current.position.copy(targetRef.current).add(offset);
    controlsRef.current.update();
  };

  const zoom = (factor: number) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const offset = cameraRef.current.position.clone().sub(targetRef.current).multiplyScalar(factor);
    cameraRef.current.position.copy(targetRef.current).add(offset);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {modelError && <MissingModelOverlay />}
      {loading && !modelError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070b0e] z-10">
          <div className="flex flex-col items-center gap-3">
            <span className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-mono">Loading Anatomy</span>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} 
        aria-label="3D Interactive Anatomy Viewer" 
      />

      {(!modelError && !loading) && (
        <>
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
            <button onClick={() => rotate(0.3)} className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded p-2 transition-colors">
              <RotateCcw size={16} className="rotate-180" />
            </button>
            <button onClick={() => rotate(-0.3)} className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded p-2 transition-colors">
              <RotateCcw size={16} />
            </button>
            <button onClick={() => zoom(0.8)} className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded p-2 transition-colors mt-2">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => zoom(1.2)} className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded p-2 transition-colors">
              <ZoomOut size={16} />
            </button>
            <button onClick={() => controlsRef.current?.reset()} className="bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded p-2 transition-colors mt-2">
              <Maximize2 size={16} />
            </button>
          </div>
          
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-[#0f161b]/90 backdrop-blur border border-[#1e293b] rounded-lg p-3 text-xs flex gap-2">
              <div className="text-slate-400 mr-2 uppercase tracking-wide font-mono text-[10px]">Model Output</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#0f766e]"></span> <span className="text-slate-300">Lower</span></div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#d97706]"></span></div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#be123c]"></span> <span className="text-slate-300">Higher</span></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
