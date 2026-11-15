// The lake's surface: one see-through sheet over all the water in town, drawn by a shader in the game's flat cartoon style
// (realistic shading and sparkles did not fit): bands of colour by depth, clean white wave marks drifting, white rings
// where the ripples crest, a white band of foam lapping the beach. Under it the ground is painted a plain lake-bed blue. It lies a little above the ground, so what is lower than it (Lili's legs and
// belly when she swims) shows through, tinted: that is her waterline.
//
// Ripples (`ripples`): the water's height is simulated on the GPU over a grid of the lake, a wave step 60 times a second, and
// things moving in the water push it (`push`): Lili's chest as she swims, a splash. The waves spread, cross and bounce off
// the shore on their own; the surface shader lights their slopes and whitens their crests.
//
// How far each point is from the shore is measured once, when the town is built (a distance map over the water, `shoreMap`),
// so the shading runs smoothly across tile edges whatever shape the tiles make.
import * as THREE from '../vendor/three.module.min.js';
import { TILE } from './world.js';

export const WATER_Y = 12;                              // how high the surface lies over the ground
const CELL = 8;                                         // the distance map's resolution, in game units
const FAR = 255;                                        // distances are stored up to this (in game units)
const RIPPLE_CELL = 6, STEP = 1 / 60, DAMP = 0.985, PUSHES = 4;

// The water tiles' bounding box, and for each cell of a grid over it, how far it is from the nearest point that is not water
// (0 out of the water). A two-pass chamfer distance, good to a few per cent.
function shoreMap(world) {
  const wet = world.tiles.filter((t) => (t.def.ground || []).some((g) => g.water));
  if (!wet.length) return null;
  const x0 = Math.min(...wet.map((t) => t.col)) * TILE - TILE, y0 = Math.min(...wet.map((t) => t.row)) * TILE - TILE;
  const x1 = (Math.max(...wet.map((t) => t.col)) + 2) * TILE, y1 = (Math.max(...wet.map((t) => t.row)) + 2) * TILE;
  const w = Math.ceil((x1 - x0) / CELL), h = Math.ceil((y1 - y0) / CELL), d = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) d[j * w + i] = world.surfaceAt(x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL) === 'water' ? 1e9 : 0;
  const A = CELL, B = CELL * Math.SQRT2;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let v = d[k]; if (!v) continue;
    if (i) v = Math.min(v, d[k - 1] + A); if (j) v = Math.min(v, d[k - w] + A);
    if (i && j) v = Math.min(v, d[k - w - 1] + B); if (j && i < w - 1) v = Math.min(v, d[k - w + 1] + B);
    d[k] = v;
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i; let v = d[k]; if (!v) continue;
    if (i < w - 1) v = Math.min(v, d[k + 1] + A); if (j < h - 1) v = Math.min(v, d[k + w] + A);
    if (i < w - 1 && j < h - 1) v = Math.min(v, d[k + w + 1] + B); if (j < h - 1 && i) v = Math.min(v, d[k + w - 1] + B);
    d[k] = v;
  }
  const px = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) px[k] = Math.min(FAR, d[k]);
  const tex = new THREE.DataTexture(px, w, h, THREE.RedFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, x0, y0, x1, y1 };
}

const VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vMap;
  void main() {
    vMap = position.xy;                                 // map coordinates (x east, y south)
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform sampler2D shore;
  uniform vec4 box;                                     // the distance map's x0, y0, x1, y1
  uniform float time;
  uniform sampler2D ripple;
  uniform vec2 rippleTexel;
  uniform float hasRipple;
  varying vec2 vMap;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float d = texture2D(shore, (vMap - box.xy) / (box.zw - box.xy)).r * ${FAR.toFixed(1)};   // from the shore, in game units
    if (d < 1.0) discard;
    // flat colour bands, as the rest of the town is drawn: shallow, middle and deep, with clean edges
    float band = step(45.0, d) + step(130.0, d);
    vec3 col = band < 0.5 ? vec3(0.49, 0.80, 0.92) : band < 1.5 ? vec3(0.36, 0.71, 0.88) : vec3(0.29, 0.62, 0.83);
    // ripples from the simulation, drawn as clean white rings where the waves crest
    vec2 uv = (vMap - box.xy) / (box.zw - box.xy);
    float h = texture2D(ripple, uv).r * hasRipple;
    float ring = smoothstep(0.09, 0.11, h) * (1.0 - smoothstep(0.15, 0.17, h));      // a thin line round each crest
    col = mix(col, vec3(1.0), ring * 0.9);
    // a few clean wave marks drifting slowly: short white arcs, placed one per cell of a coarse grid
    vec2 g = vMap / 90.0 + vec2(time * 0.04, time * 0.02), id = floor(g), f = fract(g) - 0.5;
    vec2 o = vec2(hash(id), hash(id + 7.3)) - 0.5;
    vec2 q = f - o * 0.5;
    float r = length(q * vec2(1.0, 1.6));
    float arc = smoothstep(0.035, 0.0, abs(r - 0.17)) * step(q.y, -0.02) * step(0.45, hash(id + 3.1));
    col = mix(col, vec3(1.0), arc * 0.7 * (0.6 + 0.4 * sin(time * 0.8 + hash(id) * 6.0)));
    // foam along the beach: a solid white band, its edge softly waving
    float lap = 13.0 + 4.0 * sin(time * 1.4 + vMap.x * 0.03 + vMap.y * 0.02);
    float foam = step(d, lap);
    col = mix(col, vec3(1.0), foam);
    float alpha = foam > 0.5 ? 0.95 : band < 0.5 ? 0.7 : 0.85;
    alpha *= smoothstep(1.0, 3.0, d);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

// One wave step: each cell's new height from its neighbours' and its own last two, damped; pushes added; held flat on the
// shore. The state is (height now, height before).
const SIM = /* glsl */ `
  uniform sampler2D state, shore;
  uniform vec2 texel;
  uniform vec4 box;
  uniform vec4 pushes[${PUSHES}];                       // x, y (game units), radius, strength
  varying vec2 vUv;
  void main() {
    vec2 s = texture2D(state, vUv).rg;
    float n = (texture2D(state, vUv + vec2(texel.x, 0.0)).r + texture2D(state, vUv - vec2(texel.x, 0.0)).r
             + texture2D(state, vUv + vec2(0.0, texel.y)).r + texture2D(state, vUv - vec2(0.0, texel.y)).r) * 0.5 - s.g;
    n *= ${DAMP};
    vec2 at = box.xy + vUv * (box.zw - box.xy);
    for (int i = 0; i < ${PUSHES}; i++) { vec4 p = pushes[i]; if (p.w != 0.0) { vec2 q = (at - p.xy) / p.z; n += p.w * exp(-dot(q, q)); } }
    if (texture2D(shore, vUv).r * ${FAR.toFixed(1)} < 3.0) n = 0.0;
    gl_FragColor = vec4(clamp(n, -2.0, 2.0), s.r, 0.0, 1.0);
  }`;

function makeRipples(renderer, map) {
  const caps = renderer.capabilities, ext = renderer.extensions;
  if (!caps.isWebGL2 || !(ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return null;   // older devices: no ripples
  const w = Math.ceil((map.x1 - map.x0) / RIPPLE_CELL), h = Math.ceil((map.y1 - map.y0) / RIPPLE_CELL);
  const rt = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  let a = rt(), b = rt();
  const pushes = Array.from({ length: PUSHES }, () => new THREE.Vector4());
  const mat = new THREE.ShaderMaterial({
    uniforms: { state: { value: null }, shore: { value: map.tex }, texel: { value: new THREE.Vector2(1 / w, 1 / h) }, box: { value: new THREE.Vector4(map.x0, map.y0, map.x1, map.y1) }, pushes: { value: pushes } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: SIM,
  });
  const scene = new THREE.Scene(), cam = new THREE.Camera();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  for (const t of [a, b]) { renderer.setRenderTarget(t); renderer.clear(); }
  renderer.setRenderTarget(null);
  let acc = 0, queued = [];
  return {
    texel: new THREE.Vector2(1 / w, 1 / h),
    get tex() { return a.texture; },
    push(x, y, r, s) { queued.push([x, y, r, s]); },
    step(dt) {
      acc = Math.min(acc + dt, STEP * 4);
      const prev = renderer.getRenderTarget();
      while (acc >= STEP) {
        acc -= STEP;
        pushes.forEach((p, i) => (queued[i] ? p.set(...queued[i]) : p.set(0, 0, 1, 0)));
        queued = queued.slice(PUSHES);
        mat.uniforms.state.value = a.texture;
        renderer.setRenderTarget(b); renderer.render(scene, cam);
        [a, b] = [b, a];
      }
      queued = [];
      renderer.setRenderTarget(prev);
    },
  };
}

export function makeWater(world, renderer) {
  const map = shoreMap(world);
  if (!map) return null;
  const ripples = makeRipples(renderer, map);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { shore: { value: null }, box: { value: new THREE.Vector4() }, time: { value: 0 },
    ripple: { value: null }, rippleTexel: { value: new THREE.Vector2() }, hasRipple: { value: ripples ? 1 : 0 } }]);
  uniforms.shore.value = map.tex; uniforms.box.value.set(map.x0, map.y0, map.x1, map.y1);
  uniforms.ripple.value = map.tex;
  if (ripples) uniforms.rippleTexel.value.copy(ripples.texel);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
  // a plane in map coordinates, laid flat: its x is east, its y south
  const geo = new THREE.PlaneGeometry(map.x1 - map.x0, map.y1 - map.y0).translate((map.x0 + map.x1) / 2, (map.y0 + map.y1) / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2; mesh.position.y = WATER_Y; mesh.renderOrder = 1;
  return {
    mesh,
    // something in the water pushes it at (x, y): r how wide, s how hard (a swimming dog about 0.5 a step, a splash 4)
    push(x, y, r, s) { if (ripples) ripples.push(x, y, r, s); },
    update(t, dt) {
      uniforms.time.value = t;
      if (ripples) { ripples.step(dt); uniforms.ripple.value = ripples.tex; }
    },
  };
}
