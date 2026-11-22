/** One water surface travels from the hero sea to the sphere in the result section. */
import { MathUtils, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { createWaterSphere } from './water-sphere.js';

export function createFigure(host, { seaAnchor, desktopTarget, mobileTarget, reducedMotion }) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'figure__canvas';
  host.append(renderer.domElement);

  const scene = new Scene();
  const surface = createWaterSphere();
  scene.add(surface);
  const camera = new OrthographicCamera(0, 1, 1, 0, 0.1, 8000);
  camera.position.z = 4000;
  const uniforms = surface.material.uniforms;
  const pointer = { x: -10000, y: -10000, down: false };
  let frame = 0, visible = false;
  let width = 1, height = 1;
  let previous = 0, elapsed = 0;

  function render(now) {
    frame = 0;
    const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now;
    if (!reducedMotion) elapsed += dt;

    const view = host.getBoundingClientRect();
    const sea = seaAnchor.getBoundingClientRect();
    const mobile = mobileTarget.getBoundingClientRect();
    const target = mobile.width ? mobile : desktopTarget.getBoundingClientRect();
    const targetX = target.left - view.left + target.width / 2;
    const targetY = target.top - view.top + target.height / 2;
    const end = window.scrollY + target.top + target.height / 2 - height / 2;
    const sectionEnd = window.scrollY + sea.bottom - height * 0.04;
    const progress = MathUtils.smoothstep(window.scrollY / Math.max(1, mobile.width ? end : sectionEnd), 0.10, 0.96);

    const radius = Math.min(target.width * 0.45, target.height * 0.465, height * 0.32);
    const seaHeight = sea.height * 0.93;
    const seaY = sea.bottom - view.top - seaHeight * 0.43;
    const cx = MathUtils.lerp(width / 2, targetX, progress);
    const cy = MathUtils.lerp(seaY, targetY, progress);
    surface.position.set(cx, height - cy, 0);
    uniforms.uSeaSize.value.set(width * 1.25, seaHeight * 0.56);
    uniforms.uRadius.value = Math.max(1, radius);
    uniforms.uGather.value = progress;
    uniforms.uTime.value = elapsed;

    const x = (pointer.x - view.left - cx) / Math.max(1, radius);
    const y = (cy - pointer.y + view.top) / Math.max(1, radius);
    const hit = x * x + y * y < 1 && progress > 0.65 && !reducedMotion;
    if (hit) uniforms.uTouch.value.set(x, y, Math.sqrt(1 - x * x - y * y));
    uniforms.uPressure.value = MathUtils.damp(uniforms.uPressure.value, hit ? (pointer.down ? 1.5 : 0.55) : 0, 6, dt);
    renderer.render(scene, camera);
    if (visible && !reducedMotion) kick();
  }

  function kick() {
    if (!frame && visible) frame = requestAnimationFrame(render);
  }

  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
    kick();
  };
  const onPointer = (event) => {
    pointer.x = event.clientX; pointer.y = event.clientY;
    pointer.down = (event.buttons & 1) !== 0;
  };
  const onLeave = () => { pointer.x = -10000; pointer.down = false; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  window.addEventListener('pointerup', onPointer, { passive: true });
  window.addEventListener('pointercancel', onLeave);
  document.addEventListener('pointerleave', onLeave);
  const resizeObserver = new ResizeObserver(resize);
  [host, seaAnchor, mobileTarget, desktopTarget].forEach(el => resizeObserver.observe(el));
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    previous = 0;
    kick();
  });
  observer.observe(host);
  resize();
  render(performance.now());
  host.classList.add('is-ready');
  return { refresh: kick };
}
