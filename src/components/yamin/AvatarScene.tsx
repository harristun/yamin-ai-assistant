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

import modelAsset from "@/assets/yamin_face.fbx.asset.json";
import textureAsset from "@/assets/yamin_texture.png.asset.json";
import idleDwarfAsset from "@/assets/yamin_idle_dwarf.fbx.asset.json";
import idleStandingAsset from "@/assets/yamin_idle_standing.fbx.asset.json";
import idleLongAsset from "@/assets/yamin_idle_long.fbx.asset.json";
import idleActiveAsset from "@/assets/yamin_idle_active.fbx.asset.json";
import talking1Asset from "@/assets/yamin_talking1.fbx.asset.json";
import talking2Asset from "@/assets/yamin_talking2.fbx.asset.json";
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
  mobile: { fov: 30, focus: 0.55, distance: 2.0 },
  tablet: { fov: 31, focus: 0.55, distance: 2.05 },
  desktop: { fov: 32, focus: 0.54, distance: 2.15 },

};

const FIGURE_HEIGHT = 1.7;

const IDLE_CLIPS = [
  { url: idleLongAsset.url, name: "idle-long" },
  { url: talking1Asset.url, name: "talk-1" },
  { url: talking2Asset.url, name: "talk-2" },
  { url: idleActiveAsset.url, name: "idle-active" },
  { url: idleDwarfAsset.url, name: "idle-dwarf" },
  { url: idleStandingAsset.url, name: "idle-standing" },
];

const TALK_NAMES = ["talk-1", "talk-2"];
const isIdleName = (name: string) => name.startsWith("idle-");

/**
 * Loads every animation FBX one after another instead of making any animation
 * a blocking Suspense dependency. Each file is ~12 MB, and transient CDN or
 * browser failures must never take down the avatar canvas.
 */
function useStreamedClips() {
  const [clips, setClips] = useState<THREE.AnimationClip[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { FBXLoader } = await import("three-stdlib");
      const loader = new FBXLoader();
      for (const entry of IDLE_CLIPS) {
        for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
          try {
            const group = (await loader.loadAsync(entry.url)) as THREE.Group;
            const clip = group.animations[0];
            if (clip && !cancelled) {
              const copy = clip.clone();
              copy.name = entry.name;
              copy.tracks = copy.tracks.filter(
                (track) => !/Hips\.position$/.test(track.name),
              );
              setClips((prev) =>
                prev.some((c) => c.name === copy.name) ? prev : [...prev, copy],
              );
            }
            break;
          } catch {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 900 * 2 ** attempt));
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return clips;
}

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
          // The FBX's embedded texture path cannot be fetched (cross-origin
          // redirect), so always use the extracted colour map asset.
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


  // The model renders immediately in its bind pose; all idles stream in
  // sequentially. A failed animation request therefore degrades gracefully
  // rather than rejecting Suspense and blanking the entire page.
  const clips = useStreamedClips();

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
    if (names.filter(isIdleName).length < 2 || speaking) return;
    let idleTimer = 0;
    let cycleTimer = 0;

    const cycle = () => {
      setActive((prev) => {
        const pool = names.filter((n) => n !== prev && isIdleName(n));
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
  }, [names, speaking]);

  // While she speaks she cycles the two talking takes. Each take is swapped a
  // little before it ends and crossfaded, so the loop never reads as a loop.
  useEffect(() => {
    if (!names.length) return;
    const talks = names.filter((n) => TALK_NAMES.includes(n));

    if (!speaking) {
      if (listening) setActive(names.includes("idle-active") ? "idle-active" : names[0]!);
      else setActive(names.includes("idle-long") ? "idle-long" : names[0]!);
      return;
    }
    if (!talks.length) {
      setActive(names.includes("idle-active") ? "idle-active" : names[0]!);
      return;
    }

    let timer = 0;
    const next = () => {
      let picked = "";
      setActive((prev) => {
        const pool = talks.filter((n) => n !== prev);
        picked = pool[Math.floor(Math.random() * pool.length)] ?? talks[0]!;
        return picked;
      });
      const duration = actions[picked]?.getClip().duration ?? 3;
      // Re-enter the other take slightly early and from a random offset.
      timer = window.setTimeout(next, Math.max(1400, (duration - 0.8) * 1000));
    };
    next();
    return () => window.clearTimeout(timer);
  }, [actions, names, speaking, listening]);

  useEffect(() => {
    const action = actions[active];
    if (action) action.timeScale = speaking ? 1.12 : listening ? 1.04 : 0.94;
  }, [actions, active, speaking, listening]);

  // Facial life: blink + smile through morph targets when the mesh ships them.
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

  // This rig carries Rigify-style face bones (lid.T/B, lip.T/B, cheek, brow),
  // so blink + smile are driven directly on the bones. Rest transforms are
  // captured once and every frame writes rest + delta so the baked body clips
  // are never fought over.
  // Bone local axes are arbitrary in this export, so every expression offset is
  // authored in world space (up / outwards) and converted into the bone's parent
  // space once. `unit` converts metres into that parent space.
  type FaceBone = {
    bone: THREE.Object3D;
    restPos: THREE.Vector3;
    /** World "up" expressed in the bone's parent space, unit length. */
    up: THREE.Vector3;
    /** World "outwards from the face centre", unit length. */
    out: THREE.Vector3;
    /** Metres -> parent-space length. */
    unit: number;
  };

  const faceRig = useMemo(() => {
    const lidTop: FaceBone[] = [];
    const lidBottom: FaceBone[] = [];
    const lipCorner: FaceBone[] = [];
    const lipLower: FaceBone[] = [];
    const lipUpper: FaceBone[] = [];
    const jaw: FaceBone[] = [];
    // Keep expressions scoped tightly to eyelids and mouth corners. Moving
    // cheek/brow helper bones on this rig also pulls the nose/eye socket area,
    // which creates the occasional warped face seen during idle crossfades.

    model.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();

    const make = (child: THREE.Object3D, side: number): FaceBone => {
      const parent = child.parent ?? child;
      parent.matrixWorld.decompose(p, q, s);
      const inv = q.clone().invert();
      const scale = Math.max((s.x + s.y + s.z) / 3, 1e-6);
      return {
        bone: child,
        restPos: child.position.clone(),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(inv).normalize(),
        out: new THREE.Vector3(side, 0, 0).applyQuaternion(inv).normalize(),
        unit: 1 / scale,
      };
    };

    model.traverse((child) => {
      const n = child.name;
      // The FBX export strips the dots from Rigify names: lid.T.L.002 -> lidTL002
      const side = /^[a-z]+[TB]?L\d*$/i.test(n) ? 1 : -1;
      if (/^lidT[LR]\d*$/i.test(n)) lidTop.push(make(child, side));
      else if (/^lidB[LR]\d*$/i.test(n)) lidBottom.push(make(child, side));
      else if (/^lip[TB][LR]001$/i.test(n)) lipCorner.push(make(child, side));
      else if (/^lipB[LR]$/i.test(n)) lipLower.push(make(child, side));
      else if (/^lipT[LR]$/i.test(n)) lipUpper.push(make(child, side));
      else if (/^jaw(?:\d*|Master)?$/i.test(n)) jaw.push(make(child, side));
    });

    return { lidTop, lidBottom, lipCorner, lipLower, lipUpper, jaw };
  }, [model]);

  // The exported character carries two upper-body chains: the baked idles drive
  // Hips -> Spine -> neck -> Head, while the facial bones live under a separate
  // spine004 -> spine005 -> spine006 -> face chain. Without this retarget, the
  // face bones hold the head area in its rest pose and make the head look pinned.
  const faceFollower = useMemo(() => {
    const faceRoot = model.getObjectByName("spine004");
    const head = model.getObjectByName("Head");
    if (!faceRoot || !head) return null;

    model.updateMatrixWorld(true);
    return {
      faceRoot,
      head,
      offset: head.matrixWorld.clone().invert().multiply(faceRoot.matrixWorld),
      desiredWorld: new THREE.Matrix4(),
      localMatrix: new THREE.Matrix4(),
      parentWorldInverse: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    };
  }, [model]);

  const face = useRef({
    nextBlink: 1.5,
    blink: 0,
    smile: 0,
    nextSmile: 3,
    smileHold: 0,
    mouth: 0,
    phase: 0,
  });


  useFrame((_state, delta) => {
    const f = face.current;

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
      f.smileHold = 2.2 + Math.random() * 2.6;
      f.nextSmile = (speaking || listening ? 3.5 : 6) + Math.random() * 5;
    }
    f.smileHold = Math.max(0, f.smileHold - delta);
    const smileTarget = f.smileHold > 0 ? (speaking ? 0.78 : 0.62) : 0.08;
    f.smile += (smileTarget - f.smile) * Math.min(1, delta * 3);

    const blinkValue = Math.sin(Math.min(1, f.blink) * Math.PI);
    for (const entry of faces) {
      const influences = entry.mesh.morphTargetInfluences;
      if (!influences) continue;
      for (const i of entry.blink) influences[i] = blinkValue;
      for (const i of entry.smile) influences[i] = f.smile;
    }

    if (faceFollower) {
      model.updateMatrixWorld(true);
      faceFollower.desiredWorld.multiplyMatrices(
        faceFollower.head.matrixWorld,
        faceFollower.offset,
      );
      const parent = faceFollower.faceRoot.parent;
      if (parent) {
        faceFollower.parentWorldInverse.copy(parent.matrixWorld).invert();
        faceFollower.localMatrix.multiplyMatrices(
          faceFollower.parentWorldInverse,
          faceFollower.desiredWorld,
        );
      } else {
        faceFollower.localMatrix.copy(faceFollower.desiredWorld);
      }
      faceFollower.localMatrix.decompose(
        faceFollower.position,
        faceFollower.quaternion,
        faceFollower.scale,
      );
      faceFollower.faceRoot.position.copy(faceFollower.position);
      faceFollower.faceRoot.quaternion.copy(faceFollower.quaternion);
      faceFollower.faceRoot.scale.copy(faceFollower.scale);
      faceFollower.faceRoot.updateMatrixWorld(true);
    }

    // Bone-driven face: lids slide shut, lip corners and cheeks lift. Offsets are
    // metres in world space, converted per bone into its parent space.
    // Only face bones are touched — the head bone itself is left entirely to the
    // baked body clips so her head keeps moving with the original animation.
    const shift = (e: FaceBone, upM: number, outM: number) => {
      e.bone.position
        .copy(e.restPos)
        .addScaledVector(e.up, upM * e.unit)
        .addScaledVector(e.out, outM * e.unit);
    };

    const lidClose = blinkValue;
    // Smile can warm the eyes, but keep squint very small to avoid nose/eye warping.
    const lidSquint = f.smile * 0.08;
    for (const e of faceRig.lidTop) shift(e, -0.007 * lidClose - 0.0012 * lidSquint, 0);
    for (const e of faceRig.lidBottom) shift(e, 0.0032 * lidClose, 0);

    for (const e of faceRig.lipCorner) shift(e, 0.017 * f.smile, 0.009 * f.smile);

    // Lip sync: while she speaks the mouth opens on a syllable-rate envelope.
    f.phase += delta;
    const envelope = speaking
      ? Math.max(
          0,
          0.55 +
            0.45 * Math.sin(f.phase * 11.3) * Math.sin(f.phase * 3.1 + 1.2) +
            0.14 * Math.sin(f.phase * 19.7),
        )
      : 0;
    f.mouth += (Math.min(1, envelope) - f.mouth) * Math.min(1, delta * 16);
    const open = f.mouth;
    for (const e of faceRig.jaw) shift(e, -0.011 * open, 0);
    for (const e of faceRig.lipLower) shift(e, -0.006 * open, 0);
    for (const e of faceRig.lipUpper) shift(e, 0.002 * open, 0);
  });





  // The model is normalized once above. Only update the camera here; repeatedly
  // measuring an animated SkinnedMesh and multiplying its scale can collapse
  // or fling it out of frame as the skeleton updates.
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as
    | { target: THREE.Vector3; update: () => void }
    | null;
  useEffect(() => {
    const focusY = FIGURE_HEIGHT * framing.focus;
    camera.position.set(0, focusY, FIGURE_HEIGHT * framing.distance);
    camera.lookAt(0, focusY, 0);
    if (controls) {
      controls.target.set(0, focusY, 0);
      controls.update();
    }
    camera.updateProjectionMatrix();
  }, [camera, controls, framing]);

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
