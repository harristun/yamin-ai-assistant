import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
  useAnimations,
  useFBX,
  useTexture,
} from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import modelAsset from "@/assets/yamin_character.fbx.asset.json";
import textureAsset from "@/assets/yamin_texture.png.asset.json";
import idleDwarfAsset from "@/assets/yamin_idle_dwarf.fbx.asset.json";
import idleStandingAsset from "@/assets/yamin_idle_standing.fbx.asset.json";
import type { Breakpoint } from "@/hooks/useBreakpoint";
import { AmbientLight, DirectionalLight, Group, PointLight, Primitive, SpotLight } from "./three-elements";

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
  const idleDwarf = useFBX(idleDwarfAsset.url);
  const idleStanding = useFBX(idleStandingAsset.url);
  const baseColor = useTexture(textureAsset.url);
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    // The FBX embeds its PBR maps in a format the loader cannot decode, so the
    // base colour map is re-applied here from the extracted image asset.
    baseColor.colorSpace = THREE.SRGBColorSpace;
    baseColor.flipY = false;
    baseColor.needsUpdate = true;

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
          color: new THREE.Color("#ffffff"),
          roughness: 0.55,
          metalness: 0.05,
          side: THREE.FrontSide,
        });
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
      const scale = FIGURE_HEIGHT / size.y;
      fbx.scale.setScalar(scale);
      fbx.updateMatrixWorld(true);
      const scaled = new THREE.Box3().setFromObject(fbx);
      const center = scaled.getCenter(new THREE.Vector3());
      fbx.position.set(-center.x, -scaled.min.y, -center.z);
    }
    return fbx;
  }, [fbx, baseColor]);

  // Two idle clips (dwarf idle + standing idle) picked at random and
  // cross-faded, so she never loops the exact same motion for long.
  const clips = useMemo(() => {
    const out: THREE.AnimationClip[] = [];
    const push = (source: THREE.Group, name: string) => {
      const clip = source.animations[0];
      if (!clip) return;
      const copy = clip.clone();
      copy.name = name;
      // Root translation from the source rig would drift the figure; the idle
      // clips are meant to play in place.
      copy.tracks = copy.tracks.filter((track) => !/Hips\.position$/.test(track.name));
      out.push(copy);
    };
    push(idleDwarf, "idle-dwarf");
    push(idleStanding, "idle-standing");
    return out;
  }, [idleDwarf, idleStanding]);

  const { actions, names } = useAnimations(clips, group);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!names.length) return;
    setActive(Math.floor(Math.random() * names.length));
  }, [names]);

  useEffect(() => {
    const name = names[active];
    if (!name) return;
    const action = actions[name];
    if (!action) return;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.6).play();

    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setActive((prev) => (names.length > 1 ? (prev + 1 + Math.floor(Math.random() * (names.length - 1))) % names.length : prev));
        },
        8000 + Math.random() * 6000,
      );
    };
    schedule();

    return () => {
      window.clearTimeout(timer);
      action.fadeOut(0.6);
    };
  }, [actions, names, active]);

  useEffect(() => {
    const name = names[active];
    const action = name ? actions[name] : undefined;
    if (action) action.timeScale = speaking ? 1.15 : listening ? 1.05 : 0.95;
  }, [actions, names, active, speaking, listening]);

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
    <Group ref={group} dispose={null}>
      <Primitive object={model} />
    </Group>
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
      <AmbientLight intensity={0.7} />
      <DirectionalLight
        position={[2.4, 3.6, 3.2]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <SpotLight
        position={[-2.6, 3.2, -1.8]}
        angle={0.8}
        penumbra={1}
        intensity={speaking ? 3.2 : 2.2}
        color="#f0c473"
      />
      <PointLight position={[2.2, 1.4, -2]} intensity={1.1} color="#7fd9b0" />
      <PointLight position={[0, 1.2, 2.4]} intensity={0.7} color="#ffd9a8" />

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
        autoRotate={false}
      />
    </Canvas>
  );
}
