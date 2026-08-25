import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useAnimations,
  useFBX,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import modelAsset from "@/assets/yamin.fbx.asset.json";
import type { Breakpoint } from "@/hooks/useBreakpoint";

type Framing = { position: [number, number, number]; target: [number, number, number]; fov: number };

const FRAMING: Record<Breakpoint, Framing> = {
  mobile: { position: [0, 1.55, 2.1], target: [0, 1.45, 0], fov: 30 },
  tablet: { position: [0, 1.4, 2.9], target: [0, 1.25, 0], fov: 34 },
  desktop: { position: [0.35, 1.3, 3.6], target: [0, 1.05, 0], fov: 38 },
};

function AvatarModel({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  const fbx = useFBX(modelAsset.url);
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const root = fbx;
    root.position.set(0, 0, 0);
    root.scale.setScalar(1);
    root.updateMatrixWorld(true);

    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const scale = size.y > 0 ? 1.7 / size.y : 1;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.material = mats.map((mat) => {
        const src = mat as THREE.MeshStandardMaterial & { map?: THREE.Texture | null };
        if (src?.map) {
          src.needsUpdate = true;
          return src;
        }
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color("#efe3d2"),
          roughness: 0.62,
          metalness: 0.06,
        });
      }) as unknown as THREE.Material;
      if (Array.isArray(mesh.material) && mesh.material.length === 1) {
        mesh.material = mesh.material[0]!;
      }
    });
    return root;
  }, [fbx]);

  const { actions, names } = useAnimations(fbx.animations, group);

  useEffect(() => {
    const first = names[0];
    if (!first) return;
    const action = actions[first];
    action?.reset().fadeIn(0.4).play();
    return () => {
      action?.fadeOut(0.3);
    };
  }, [actions, names]);

  useEffect(() => {
    const first = names[0];
    const action = first ? actions[first] : undefined;
    if (action) action.timeScale = speaking ? 1.25 : listening ? 1.05 : 0.85;
  }, [actions, names, speaking, listening]);

  return (
    <group ref={group} dispose={null}>
      <primitive object={model} />
    </group>
  );
}

export default function AvatarScene({
  breakpoint,
  speaking,
  listening,
}: {
  breakpoint: Breakpoint;
  speaking: boolean;
  listening: boolean;
}) {
  const framing = FRAMING[breakpoint];

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: framing.position, fov: framing.fov, near: 0.1, far: 100 }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <spotLight
        position={[-3.2, 3.4, -2.4]}
        angle={0.7}
        penumbra={1}
        intensity={speaking ? 2.6 : 1.8}
        color="#f0c473"
      />
      <pointLight position={[2.6, 1.2, -2.2]} intensity={0.9} color="#7fd9b0" />
      <AvatarModel speaking={speaking} listening={listening} />
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.35}
        scale={7}
        blur={2.6}
        far={3}
        color="#5a4222"
      />
      <Environment preset="city" environmentIntensity={0.55} />
      <OrbitControls
        makeDefault
        target={framing.target}
        enablePan={false}
        enableZoom={breakpoint !== "mobile"}
        minDistance={1.4}
        maxDistance={5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.9}
        autoRotate={!listening && !speaking}
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
