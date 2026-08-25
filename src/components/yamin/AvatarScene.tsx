import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useAnimations,
  useFBX,
  useTexture,
} from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import modelAsset from "@/assets/yamin.fbx.asset.json";
import baseColorAsset from "@/assets/yamin_basecolor.webp.asset.json";
import normalAsset from "@/assets/yamin_normal.webp.asset.json";
import type { Breakpoint } from "@/hooks/useBreakpoint";

type Framing = {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
};

// Portrait-style framing on small screens, more of the figure as space grows.
const FRAMING: Record<Breakpoint, Framing> = {
  mobile: { fov: 30, position: [0, 1.5, 1.5], target: [0, 1.42, 0] },
  tablet: { fov: 32, position: [0, 1.4, 2.1], target: [0, 1.3, 0] },
  desktop: { fov: 34, position: [0, 1.35, 2.7], target: [0, 1.15, 0] },
};

function AvatarModel({ speaking, listening }: { speaking: boolean; listening: boolean }) {
  const fbx = useFBX(modelAsset.url);
  const textures = useTexture([baseColorAsset.url, normalAsset.url]);
  const baseColor = textures[0]!;
  const normal = textures[1]!;
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    // The FBX embeds its PBR maps as WebP, which the FBX loader cannot decode,
    // so the same maps are re-applied here from extracted image assets.
    baseColor.colorSpace = THREE.SRGBColorSpace;
    baseColor.flipY = false;
    baseColor.needsUpdate = true;
    normal.colorSpace = THREE.NoColorSpace;
    normal.flipY = false;
    normal.needsUpdate = true;

    fbx.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const upgraded = source.map((mat) => {
        const m = mat as THREE.MeshPhongMaterial;
        const std = new THREE.MeshStandardMaterial({
          name: m?.name ?? "yamin-skin",
          map: baseColor,
          normalMap: normal,

          color: new THREE.Color("#ffffff"),
          roughness: 0.55,
          metalness: 0.05,
          side: THREE.FrontSide,
        });
        std.normalScale.set(0.85, 0.85);
        return std;
      });
      mesh.material = Array.isArray(mesh.material) ? upgraded : upgraded[0]!;
    });
    // Normalize the rig: FBX exports arrive in centimetre scale, so rescale to
    // a 1.7 unit tall figure standing on the origin regardless of source units.
    fbx.scale.setScalar(1);
    fbx.position.set(0, 0, 0);
    fbx.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 0) {
      const scale = 1.7 / size.y;
      fbx.scale.setScalar(scale);
      fbx.updateMatrixWorld(true);
      const scaled = new THREE.Box3().setFromObject(fbx);
      const center = scaled.getCenter(new THREE.Vector3());
      fbx.position.set(-center.x, -scaled.min.y, -center.z);
    }
    return fbx;
  }, [fbx, baseColor, normal]);

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
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[2.4, 3.6, 3.2]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <spotLight
        position={[-2.6, 3.2, -1.8]}
        angle={0.8}
        penumbra={1}
        intensity={speaking ? 3.2 : 2.2}
        color="#f0c473"
      />
      <pointLight position={[2.2, 1.4, -2]} intensity={1.1} color="#7fd9b0" />
      <pointLight position={[0, 1.2, 2.4]} intensity={0.7} color="#ffd9a8" />

      <AvatarModel speaking={speaking} listening={listening} />

      <ContactShadows
        position={[0, 0.005, 0]}
        opacity={0.35}
        scale={6}
        blur={2.6}
        far={2.5}
        color="#5a4222"
      />
      <Environment preset="city" environmentIntensity={0.7} />
      <OrbitControls
        makeDefault
        target={framing.target}
        enablePan={false}
        enableZoom={breakpoint !== "mobile"}
        minDistance={0.9}
        maxDistance={4.5}
        minPolarAngle={Math.PI / 3.6}
        maxPolarAngle={Math.PI / 1.95}
        autoRotate={!listening && !speaking}
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );

}
