import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
  /** Vertical focus as a fraction of the figure height (1 = top of head). */
  focus: number;
  /** Camera distance as a multiple of the figure height. */
  distance: number;
};

// Wider, portrait-style framing. Mobile stays pulled back so the face never
// gets magnified past the texture resolution (it would look pixelated).
const FRAMING: Record<Breakpoint, Framing> = {
  mobile: { fov: 30, focus: 0.66, distance: 1.55 },
  tablet: { fov: 31, focus: 0.66, distance: 1.6 },
  desktop: { fov: 32, focus: 0.64, distance: 1.7 },
};

const FIGURE_HEIGHT = 1.7;

function AvatarModel({
  speaking,
  listening,
  framing,
}: {
  speaking: boolean;
  listening: boolean;
  framing: Framing;
}) {
  const fbx = useFBX(modelAsset.url);
  const textures = useTexture([baseColorAsset.url, normalAsset.url]);
  const baseColor = textures[0]!;
  const normal = textures[1]!;
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    // The FBX embeds its PBR maps as WebP, which the FBX loader cannot decode,
    // so the same maps are re-applied here from extracted image assets.
    baseColor.colorSpace = THREE.SRGBColorSpace;
    baseColor.needsUpdate = true;
    normal.colorSpace = THREE.NoColorSpace;
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

  // The rig ships in a T-pose with no clips, so the arms are relaxed here and a
  // hand-authored idle (breathing, sway, head life) keeps Yamin feeling alive.
  const bones = useMemo(() => {
    const find = (name: string) => {
      const bone = model.getObjectByName(name) as THREE.Bone | undefined;
      return bone ? { bone, rest: bone.rotation.clone() } : undefined;
    };
    return {
      leftArm: find("LeftArm"),
      rightArm: find("RightArm"),
      leftForeArm: find("LeftForeArm"),
      rightForeArm: find("RightForeArm"),
      spine: find("Spine"),
      neck: find("Neck"),
      head: find("Head"),
    };
  }, [model]);

  const pose = (
    target: { bone: THREE.Bone; rest: THREE.Euler } | undefined,
    dx: number,
    dy: number,
    dz: number,
  ) => {
    if (!target) return;
    target.bone.rotation.set(
      target.rest.x + dx,
      target.rest.y + dy,
      target.rest.z + dz,
    );
  };

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const breath = Math.sin(t * 1.2) * 0.03;
    const energy = speaking ? 1.6 : listening ? 1.1 : 0.6;

    pose(bones.leftArm, 0, 0, 1.31 + breath);
    pose(bones.rightArm, 0, 0, -1.31 - breath);
    pose(bones.leftForeArm, 0, 0, 0.3 + breath);
    pose(bones.rightForeArm, 0, 0, -0.3 - breath);
    pose(bones.spine, breath * 0.4, Math.sin(t * 0.45) * 0.04 * energy, 0);
    pose(bones.neck, 0, Math.sin(t * 0.7 + 0.6) * 0.06 * energy, 0);
    pose(
      bones.head,
      Math.sin(t * 0.9) * 0.03 * energy,
      Math.sin(t * 0.55) * 0.08 * energy,
      0,
    );
  });


  // Auto-fit: measure the posed rig for a few frames, normalize it to a fixed
  // height standing on the floor, then frame the camera on the requested crop.
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  const passes = useRef(0);

  useEffect(() => {
    passes.current = 0;
  }, [framing]);

  useFrame(() => {
    if (passes.current > 6) return;
    passes.current += 1;
    const root = group.current;
    if (!root) return;

    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) return;

    model.scale.multiplyScalar(FIGURE_HEIGHT / size.y);
    root.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(root);
    const center = scaled.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaled.min.y;

    const focusY = FIGURE_HEIGHT * framing.focus;
    camera.position.set(0, focusY, FIGURE_HEIGHT * framing.distance);
    camera.lookAt(0, focusY, 0);
    if (controls) {
      controls.target.set(0, focusY, 0);
      controls.update();
    }
  });

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
      camera={{
        position: [0, FIGURE_HEIGHT * framing.focus, FIGURE_HEIGHT * framing.distance],
        fov: framing.fov,
        near: 0.1,
        far: 100,
      }}
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

      <AvatarModel speaking={speaking} listening={listening} framing={framing} />

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
