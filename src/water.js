// The lake's surface: one see-through sheet over all the water in town, drawn by a shader. Under it the ground is painted
// a plain lake-bed blue (ground.js); the sheet adds the depth (darker further from the shore), wavelets that drift,
// sparkles, and foam lapping the beach. It lies a little above the ground, so what is lower than it (Lili's legs and
// belly when she swims) shows through, tinted: that is her waterline.
//
// How far each point is from the shore is measured once, when the town is built (a distance map over the water, `shoreMap`),
// so the shading runs smoothly across tile edges whatever shape the tiles make.
import * as THREE from '../vendor/three.module.min.js';
import { TILE } from './world.js';

export const WATER_Y = 12;                              // how high the surface lies over the ground
const CELL = 8;                                         // the distance map's resolution, in game units
const FAR = 255;                                        // distances are stored up to this (in game units)

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
  varying vec2 vMap;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float d = texture2D(shore, (vMap - box.xy) / (box.zw - box.xy)).r * ${FAR.toFixed(1)};   // from the shore, in game units
    if (d < 1.0) discard;
    float deep = smoothstep(10.0, 220.0, d);
    vec3 col = mix(vec3(0.53, 0.82, 0.93), vec3(0.20, 0.52, 0.78), deep);
    // wavelets: thin bright crescents where two drifting noise fields cross a level, slowly changing
    vec2 p = vMap / 70.0;
    float n = noise(p + vec2(time * 0.10, time * 0.06)) * 0.6 + noise(p * 2.1 - vec2(time * 0.07, -time * 0.11)) * 0.4;
    float line = smoothstep(0.035, 0.0, abs(n - 0.55)) * smoothstep(0.3, 0.7, noise(p * 0.7 + time * 0.03));
    col = mix(col, vec3(0.92, 0.97, 1.0), line * 0.55);
    // sparkles: where the light catches the water, now and then
    float s = noise(vMap / 9.0 + time * 0.8) * noise(vMap / 13.0 - time * 0.5);
    col += vec3(pow(s, 9.0) * 6.0);
    // foam lapping the beach: a band along the shore whose width breathes in and out, with a ragged edge
    float lap = 14.0 + 7.0 * sin(time * 1.6 + noise(vMap / 40.0) * 6.0) + noise(vMap / 12.0 + time * 0.4) * 8.0;
    float foam = smoothstep(lap + 3.0, lap - 2.0, d);
    col = mix(col, vec3(1.0), foam * 0.9);
    float alpha = mix(0.55, 0.85, deep);
    alpha = max(alpha, foam * 0.95);
    alpha *= smoothstep(1.0, 4.0, d);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }`;

export function makeWater(world) {
  const map = shoreMap(world);
  if (!map) return null;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { shore: { value: null }, box: { value: new THREE.Vector4() }, time: { value: 0 } }]);
  uniforms.shore.value = map.tex; uniforms.box.value.set(map.x0, map.y0, map.x1, map.y1);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide });
  // a plane in map coordinates, laid flat: its x is east, its y south
  const geo = new THREE.PlaneGeometry(map.x1 - map.x0, map.y1 - map.y0).translate((map.x0 + map.x1) / 2, (map.y0 + map.y1) / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2; mesh.position.y = WATER_Y; mesh.renderOrder = 1;
  return { mesh, update(t) { uniforms.time.value = t; } };
}
