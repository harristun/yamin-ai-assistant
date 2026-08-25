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
import idleLongAsset from "@/assets/yamin_idle_long.fbx.asset.json";
import idleActiveAsset from "@/assets/yamin_idle_active.fbx.asset.json";
import type { Breakpoint } from "@/hooks/useBreakpoint";
import {
  AmbientLight,
  DirectionalLight,
  Group,
  PointLight,
  Primitive,
  SpotLight,
  stripDataProps,
} from "./three-elements";

const SafeContactShadows = stripDataProps(ContactShadows as any, "ContactShadows");
const SafeEnvironment = stripDataProps(Environment as any, "Environment");
const SafeOrbitControls = stripDataProps(OrbitControls as any, "OrbitControls");

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
  const idleLong = useFBX(idleLongAsset.url);
  const baseColor = useTexture(textureAsset.url);
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    // The FBX embeds its PBR maps in a format the loader cannot decode, so the
    // base colour map is re-applied here from the extracted image asset.
    baseColor.colorSpace = THREE.SRGBColorSpace;
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
          map: m?.map ?? baseColor,
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

  // Idle library. `idle-long` is the resting base loop (loaded up front); the
  // variation clips stream in one at a time afterwards — each FBX is ~12 MB and
  // requesting them all in parallel made the browser abort the downloads.
  const extraClips = useStreamedClips();
  const clips = useMemo(() => {
    const out: THREE.AnimationClip[] = [];
    const clip = idleLong.animations[0];
    if (clip) {
      const copy = clip.clone();
      copy.name = "idle-long";
      copy.tracks = copy.tracks.filter((track) => !/Hips\.position$/.test(track.name));
      out.push(copy);
    }
    return [...out, ...extraClips];
  }, [idleLong, extraClips]);

  const { actions, names } = useAnimations(clips, group);
  const [active, setActive] = useState("idle-long");

  // Base loop starts as soon as the clips are ready.
  useEffect(() => {
    if (names.length) setActive(names.includes("idle-long") ? "idle-long" : names[0]!);
  }, [names]);

  // Crossfade between whichever variation is selected.
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const action = actions[active];
    if (!action) return;
    const from = previous.current ? actions[previous.current] : undefined;
    action.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).fadeIn(0.9).play();
    if (from && from !== action) from.crossFadeTo(action, 0.9, true);
    previous.current = active;
  }, [actions, active]);

  // After 5s of no interaction she starts wandering through the idle
  // variations, each one held for roughly its own length before the next
  // random pick. Any interaction pulls her back to the base loop.
  useEffect(() => {
    if (names.length < 2) return;
    let idleTimer = 0;
    let cycleTimer = 0;

    const cycle = () => {
      setActive((prev) => {
        const pool = names.filter((n) => n !== prev);
        return pool[Math.floor(Math.random() * pool.length)] ?? prev;
      });
      cycleTimer = window.setTimeout(cycle, 9000 + Math.random() * 7000);
    };

    const arm = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(cycleTimer);
      idleTimer = window.setTimeout(cycle, 5000);
    };

    const wake = () => {
      setActive(names.includes("idle-long") ? "idle-long" : names[0]!);
      arm();
    };

    arm();
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
    ];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(cycleTimer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [names]);

  // Talking / listening keeps her on the responsive loop and slightly livelier.
  useEffect(() => {
    if (!names.length) return;
    if (speaking || listening) {
      setActive(names.includes("idle-active") ? "idle-active" : names[0]!);
    }
  }, [names, speaking, listening]);

  useEffect(() => {
    const action = actions[active];
    if (action) action.timeScale = speaking ? 1.12 : listening ? 1.04 : 0.94;
  }, [actions, active, speaking, listening]);

  // Facial life: blink + smile through morph targets when the mesh ships them,
  // plus subtle head micro-motion so she keeps engaging with the viewer.
  const faces = useMemo(() => {
    const found: { mesh: THREE.Mesh; blink: number[]; smile: number[] }[] = [];
    model.traverse((child) => {
      const mesh = child as THREE.Mesh;
      const dict = mesh.morphTargetDictionary;
      if (!mesh.isMesh || !dict) return;
      const pick = (re: RegExp) =>
        Object.keys(dict)
          .filter((k) => re.test(k))
          .map((k) => dict[k]!);
      const blink = pick(/blink|eyeclos|eye_close/i);
      const smile = pick(/smile|mouthsmile|happy/i);
      if (blink.length || smile.length) found.push({ mesh, blink, smile });
    });
    return found;
  }, [model]);

  const head = useMemo(() => {
    let bone: THREE.Object3D | null = null;
    model.traverse((child) => {
      if (!bone && /(^|:|_)Head$/i.test(child.name)) bone = child;
    });
    return bone as THREE.Object3D | null;
  }, [model]);

  const face = useRef({ nextBlink: 1.5, blink: 0, smile: 0, nextSmile: 3, smileHold: 0 });

  useFrame((state, delta) => {
    const f = face.current;
    const t = state.clock.elapsedTime;

    // Blink: quick double-lid close at random intervals.
    f.nextBlink -= delta;
    if (f.nextBlink <= 0) {
      f.blink = 1;
      f.nextBlink = 2.4 + Math.random() * 4.2;
    }
    f.blink = Math.max(0, f.blink - delta * 7);

    // Smile: warm expression that fades in and lingers, more often while she
    // is speaking or listening to the user.
    f.nextSmile -= delta;
    if (f.nextSmile <= 0) {
      f.smileHold = 1.6 + Math.random() * 2.4;
      f.nextSmile = (speaking || listening ? 4 : 7) + Math.random() * 6;
    }
    f.smileHold = Math.max(0, f.smileHold - delta);
    const smileTarget = f.smileHold > 0 ? (speaking ? 0.85 : 0.6) : 0.12;
    f.smile += (smileTarget - f.smile) * Math.min(1, delta * 3);

    const blinkValue = Math.sin(Math.min(1, f.blink) * Math.PI);
    for (const entry of faces) {
      const influences = entry.mesh.morphTargetInfluences;
      if (!influences) continue;
      for (const i of entry.blink) influences[i] = blinkValue;
      for (const i of entry.smile) influences[i] = f.smile;
    }

    // Head micro-motion layered on top of the baked clip.
    if (head) {
      head.rotation.y += Math.sin(t * 0.45) * 0.035;
      head.rotation.x += Math.sin(t * 0.7 + 1.1) * 0.02 - f.smile * 0.015;
      head.rotation.z += Math.sin(t * 0.33 + 2.2) * 0.018;
    }
  }, 1);


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

      <SafeContactShadows
        position={[0, 0.005, 0]}
        opacity={0.35}
        scale={6}
        blur={2.6}
        far={2.5}
        color="#5a4222"
      />
      <SafeEnvironment preset="city" environmentIntensity={0.7} />
      <SafeOrbitControls
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
