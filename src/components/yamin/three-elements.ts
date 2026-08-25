import { createElement } from "react";

/**
 * Dev tooling injects `data-*` source attributes into JSX, which react-three-fiber
 * cannot apply to three.js objects. These thin wrappers are authored without JSX
 * (so they are never tagged) and strip any `data-*` props before forwarding.
 */
function threeElement<P extends Record<string, unknown>>(tag: string) {
  const Component = (props: P) => {
    const clean: Record<string, unknown> = {};
    for (const key in props) {
      if (!key.startsWith("data-")) clean[key] = props[key];
    }
    return createElement(tag, clean);
  };
  Component.displayName = `Three(${tag})`;
  return Component;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const Group = threeElement<any>("group");
export const Primitive = threeElement<any>("primitive");
export const AmbientLight = threeElement<any>("ambientLight");
export const DirectionalLight = threeElement<any>("directionalLight");
export const SpotLight = threeElement<any>("spotLight");
export const PointLight = threeElement<any>("pointLight");
