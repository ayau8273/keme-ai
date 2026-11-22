import { Mesh, SphereGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';

// Each component contributes a height and its two slopes in horizontal world space.
const oceanWaves = /* glsl */`
vec3 swell(vec2 q, vec2 k, float phase, float amplitude) {
  float a = dot(q, k) + phase;
  return amplitude * vec3(sin(a), k * cos(a));
}
vec3 seaWaves(vec2 q, float t) {
  // Long swells follow the same wind. Bend the crests and carry that bend
  // through to the slope used for shading.
  float bend = 0.63 * q.x + 0.22 * q.y - t * 0.12;
  float curl = 1.39 * q.x - 0.34 * q.y + t * 0.17;
  vec2 water = q + vec2(0.0, 0.46 * sin(bend) + 0.17 * sin(curl));
  vec3 waves = swell(water, vec2(0.40, 2.35), -t * 0.81, 0.123)
             + swell(water, vec2(-0.51, 3.83), -t * 1.04 + 1.7, 0.049)
             + swell(water, vec2(1.22, 5.77), -t * 1.35 + 4.2, 0.023);
  vec2 bendSlope = 0.46 * cos(bend) * vec2(0.63, 0.22) + 0.17 * cos(curl) * vec2(1.39, -0.34);
  waves.yz += waves.z * bendSlope;
  return waves;
}
vec2 seaCoordinates(vec2 uv, float aspect) {
  float distance = 1.0 / (1.2 - uv.y);
  return vec2((uv.x - 0.5) * (3.8 + aspect) * distance, distance * 2.5);
}`;

// Displace the geometry and differentiate the same waves to get its surface normal.
const vertexShader = /* glsl */`
uniform float uTime;
uniform vec3 uTouch;
uniform float uPressure;
uniform vec2 uSeaSize;
uniform float uRadius;
uniform float uGather;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec2 vSheet;
${oceanWaves}

void wave(vec3 p, vec3 k, float phase, float amplitude, inout float h, inout vec3 grad) {
  float a = dot(p, k) + phase;
  h += amplitude * sin(a);
  grad += amplitude * cos(a) * k;
}

void main() {
  vec3 p = normalize(position);
  vSheet = p.xy * 0.5 + 0.5;
  float h = 1.0;
  vec3 grad = vec3(0.0);
  wave(p, vec3(2.9, 2.1, -1.8), 0.64 * uTime, 0.032, h, grad);
  wave(p, vec3(-3.4, 1.8, 3.1), -0.48 * uTime, 0.025, h, grad);
  wave(p, vec3(4.2, -5.0, 2.4), 0.76 * uTime, 0.014, h, grad);
  wave(p, vec3(-6.2, -2.7, 3.8), -0.58 * uTime, 0.008, h, grad);
  float distanceToTouch = 1.0 - dot(p, uTouch);
  float pulse = exp(-6.0 * distanceToTouch) * uPressure;
  float phase = 14.0 * distanceToTouch - 3.7 * uTime;
  h += pulse * (0.025 * sin(phase) - 0.045);
  grad -= pulse * (0.35 * cos(phase) - 0.15 * sin(phase) + 0.27) * uTouch;
  vNormal = normalize(p - (grad - dot(grad, p) * p) / h);
  vSurface = h * p;
  vec2 q = seaCoordinates(vSheet, uSeaSize.x / max(uSeaSize.y, 1.0));
  float swellHeight = seaWaves(q, uTime).x;
  float lift = swellHeight * mix(0.44, 0.055, vSheet.y);
  // At sea level, the far edge lies back along Z. The closed sides draw in
  // with the front surface as the water rounds up, keeping a continuous rim.
  vec3 sheet = vec3(p.x * uSeaSize.x, (p.y + lift) * uSeaSize.y,
                    (p.z * 0.35 - p.y * 1.65 + lift * 0.2) * uSeaSize.y);
  vec3 surface = mix(sheet, vSurface * uRadius, uGather);
  surface.x = mix(sheet.x, vSurface.x * uRadius, 1.0 - pow(1.0 - uGather, 2.4));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(surface, 1.0);
}`;

const fragmentShader = /* glsl */`
uniform float uGather;
uniform vec2 uSeaSize;
uniform float uTime;
varying vec3 vSurface;
varying vec3 vNormal;
varying vec2 vSheet;
${oceanWaves}

// A smooth random height field on a triangular lattice. Its analytic gradient
// gives wind ripples continuous slopes at every scale.
vec2 rippleGradient(vec2 cell) {
  vec3 h = fract(vec3(cell.xyx) * vec3(0.1031, 0.1030, 0.0973));
  h += dot(h, h.yzx + 33.33);
  return 2.0 * fract((h.xx + h.yz) * h.zy) - 1.0;
}
vec2 rippleCorner(vec2 delta, vec2 cell) {
  float w = max(0.5 - dot(delta, delta), 0.0);
  vec2 g = rippleGradient(cell);
  return w * w * w * (w * g - 8.0 * delta * dot(g, delta));
}
vec2 rippleSlope(vec2 q, vec2 frequency, vec2 drift) {
  vec2 p = q * frequency + drift * uTime;
  vec2 cell = floor(p + dot(p, vec2(0.3660254)));
  vec2 a = p - cell + dot(cell, vec2(0.2113249));
  vec2 stepDir = a.x > a.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 slope = rippleCorner(a, cell)
             + rippleCorner(a - stepDir + 0.2113249, cell + stepDir)
             + rippleCorner(a - 0.5773503, cell + 1.0);
  float footprint = max(fwidth(p).x, fwidth(p).y);
  return 55.0 * slope * frequency * (1.0 - smoothstep(0.18, 0.8, footprint));
}
vec4 seaColor() {
  vec2 q = seaCoordinates(vSheet, uSeaSize.x / max(uSeaSize.y, 1.0));
  vec3 waves = seaWaves(q, uTime);
  vec2 detail = rippleSlope(q, vec2(1.7, 3.9), vec2(0.12, -0.30)) * 0.023
              + rippleSlope(q + 9.7, vec2(4.8, 10.3), vec2(-0.13, -0.58)) * 0.006
              + rippleSlope(q - 5.3, vec2(11.5, 22.7), vec2(0.32, -0.91)) * 0.0017;
  vec2 slope = waves.yz + detail;
  vec3 n = normalize(vec3(-slope.x, 1.0, slope.y));
  vec3 eye = normalize(vec3((0.5 - vSheet.x) * 0.27, mix(0.65, 0.09, vSheet.y), 1.0));
  vec3 r = reflect(-eye, n);
  float fresnel = 0.021 + 0.979 * pow(1.0 - max(dot(eye, n), 0.0), 5.0);
  vec3 body = mix(vec3(0.16, 0.44, 0.53), vec3(0.30, 0.61, 0.66), 0.5 + 0.45 * n.z);
  vec3 sky = mix(vec3(0.82, 0.89, 0.92), vec3(0.42, 0.66, 0.81), smoothstep(0.0, 0.85, r.y));
  vec3 water = mix(body, sky, 0.16 + 0.84 * fresnel);
  float sun = max(dot(r, normalize(vec3(-0.21, 0.37, -0.91))), 0.0);
  water += vec3(1.0, 0.96, 0.85) * (0.13 * pow(sun, 24.0) + 0.47 * pow(sun, 270.0));
  water = mix(water, vec3(0.76, 0.87, 0.93), 0.56 * smoothstep(0.27, 1.0, vSheet.y));
  return vec4(water, 1.0 - smoothstep(0.91, 1.0, vSheet.y));
}

// A pale sky, a blue horizon and two broad studio lights. Both interfaces
// of the drop sample this environment, so the highlights bend with the water.
vec3 environment(vec3 d) {
  float horizon = d.y + 0.18 + 0.12 * d.x;
  vec3 c = mix(vec3(0.58, 0.83, 0.91), vec3(0.92, 0.97, 1.0), smoothstep(-0.8, 0.65, horizon));
  c -= vec3(0.40, 0.28, 0.15) * exp(-14.0 * horizon * horizon);
  float skyline = horizon - 0.24 + 0.11 * sin(3.6 * d.x + d.z);
  c -= vec3(0.19, 0.15, 0.11) * exp(-180.0 * skyline * skyline);
  c += vec3(0.32, 0.27, 0.21) * exp(-360.0 * (skyline + 0.11) * (skyline + 0.11));
  float softbox = dot(d, normalize(vec3(-0.57, 0.72, 0.39)));
  c += vec3(0.65) * smoothstep(0.83, 0.97, softbox);
  float strip = (d.x - 0.61 + 0.25 * d.y) / 0.085;
  c += vec3(0.54) * exp(-strip * strip) * smoothstep(-0.5, 0.4, d.y);
  return c;
}

void main() {
  vec4 sea = vec4(0.0);
  if (uGather < 0.95) sea = seaColor();
  if (uGather <= 0.001) { gl_FragColor = sea; return; }
  vec3 n = normalize(vNormal);
  vec3 incident = vec3(0.0, 0.0, -1.0);
  vec3 inner = refract(incident, n, 1.0 / 1.333);
  float thickness = max(0.0, -2.0 * dot(vSurface, inner));
  vec3 backNormal = normalize(vSurface + thickness * inner);
  // Ripples on the far surface bend transmitted light a second time.
  vec3 farSlope = 0.075 * cos(dot(backNormal, vec3(5.7, -3.1, 2.2)) - uTime * 0.58) * vec3(1.0, -0.55, 0.38)
                + 0.09 * cos(dot(backNormal, vec3(2.2, 4.6, -3.1)) + uTime * 0.70) * vec3(0.48, 1.0, -0.67);
  backNormal = normalize(backNormal - farSlope + dot(backNormal, farSlope) * backNormal);
  vec3 outgoing = refract(inner, -backNormal, 1.333);
  if (dot(outgoing, outgoing) < 0.01) outgoing = reflect(inner, backNormal);
  vec3 transmission = environment(outgoing) * exp(-thickness * vec3(0.19, 0.075, 0.025));
  vec3 reflected = environment(reflect(incident, n));
  float fresnel = 0.0204 + 0.9796 * pow(1.0 - clamp(n.z, 0.0, 1.0), 5.0);
  vec3 color = mix(transmission, reflected, fresnel);
  // Tight white glints sit on the curved front surface above the refracted horizon.
  vec3 light = normalize(vec3(-0.56, 0.72, 0.38));
  float highlight = dot(reflect(incident, n), light);
  color += vec3(0.68) * smoothstep(0.89, 0.975, highlight);
  gl_FragColor = mix(sea, vec4(color, 1.0), smoothstep(0.04, 0.95, uGather));
}`;

export function createWaterSphere() {
  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uGather: { value: 0 },
      uSeaSize: { value: new Vector2(1, 1) }, uRadius: { value: 1 },
      uTouch: { value: new Vector3(0, 0, 1) }, uPressure: { value: 0 },
    },
    vertexShader, fragmentShader, transparent: true,
  });
  const sphere = new Mesh(new SphereGeometry(1, 192, 96), material);
  sphere.frustumCulled = false;
  return sphere;
}
