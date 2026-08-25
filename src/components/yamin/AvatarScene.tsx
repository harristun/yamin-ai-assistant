import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
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

const FRAMING: Record<Breakpoint, { fov: number; margin: number; height: number }> = {
  mobile: { fov: 30, margin: 1.25, height: 0.45 },
  tablet: { fov: 34, margin: 1.15, height: 0.35 },
  desktop: { fov: 38, margin: 1.05, height: 0.25 },
};

function AvatarModel({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  const fbx = useFBX(modelAsset.url);
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    fbx.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      // Keep the FBX's embedded textures, but upgrade the legacy Phong/Lambert
      // materials to PBR so the avatar reads correctly under studio lighting.
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const upgraded = source.map((mat) => {
        const m = mat as THREE.MeshPhongMaterial & { normalMap?: THREE.Texture };
        if (!m) return mat;
        if ((m as unknown as THREE.MeshStandardMaterial).isMeshStandardMaterial) return mat;

        const map = m.map ?? null;
        if (map) {
          map.colorSpace = THREE.SRGBColorSpace;
          map.needsUpdate = true;
        }
        const normalMap = m.normalMap ?? null;
        if (normalMap) {
          normalMap.colorSpace = THREE.NoColorSpace;
          normalMap.needsUpdate = true;
        }

        const std = new THREE.MeshStandardMaterial({
          name: m.name,
          map,
          normalMap,
          color: map ? new THREE.Color("#ffffff") : new THREE.Color("#eadfd0"),
          roughness: 0.62,
          metalness: 0.04,
          transparent: m.transparent,
          opacity: m.opacity,
          side: m.side,
          skinning: false,
        } as THREE.MeshStandardMaterialParameters);
        if (normalMap) std.normalScale.set(0.9, 0.9);
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? upgraded : upgraded[0]!;
    });
    return fbx;
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
      camera={{ position: [0, 0.4, 4], fov: framing.fov, near: 0.1, far: 200 }}
    >
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.2}
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

      <Bounds key={breakpoint} fit clip observe margin={framing.margin}>
        <Center position={[0, framing.height, 0]} disableY={false}>
          <AvatarModel speaking={speaking} listening={listening} />
        </Center>
      </Bounds>

      <ContactShadows
        position={[0, -1.05, 0]}
        opacity={0.3}
        scale={9}
        blur={2.8}
        far={4}
        color="#5a4222"
      />
      <Environment preset="city" environmentIntensity={0.6} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom={breakpoint !== "mobile"}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.9}
        autoRotate={!listening && !speaking}
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
