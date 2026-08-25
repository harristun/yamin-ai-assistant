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
    const clone = fbx.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? 1.7 / size.y : 1;
    clone.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(clone);
    clone.position.y -= scaled.min.y;
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
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
