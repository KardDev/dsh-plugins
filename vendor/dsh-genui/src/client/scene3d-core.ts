/**
 * three.js scene renderer — the HEAVY half. This module imports three and is
 * bundled ONLY into the lazy asset bundle `lib/assets/three.js`, loaded on
 * demand by the scene3d-lazy loader when a spec contains a `scene3d` node;
 * the main client bundle stays small.
 *
 * Security: the model only supplies white-listed primitive shapes, numeric
 * transforms, and colors. No textures, no external URLs, no scripts, no
 * custom shaders — everything is geometry + material colors constructed
 * locally. The renderer mounts into a caller-owned container and returns a
 * disposer that tears down the WebGL context.
 * @module @changfenhuang/dsh-genui/client/scene3d-core
 */
import type { GenuiScene3D } from './spec.ts'

let threePromise: Promise<typeof import('three')> | null = null

function loadThree(): Promise<typeof import('three')> {
  threePromise ??= import('three')
  return threePromise
}

/** Shape constructors we accept, mapped to a size-normalized factory. */
type ShapeKind = 'box' | 'sphere' | 'cone' | 'cylinder' | 'torus'

function geometryFor(
  THREE: typeof import('three'),
  shape: ShapeKind,
  size: number | [number, number, number] | undefined,
): import('three').BufferGeometry {
  const s = size ?? 1
  switch (shape) {
    case 'box': {
      const [w, h, d] = Array.isArray(s) ? s : [s, s, s]
      return new THREE.BoxGeometry(w, h, d)
    }
    case 'sphere': {
      const r = Array.isArray(s) ? s[0] : s
      return new THREE.SphereGeometry(r, 32, 24)
    }
    case 'cone': {
      const r = Array.isArray(s) ? s[0] : s
      return new THREE.ConeGeometry(r, Array.isArray(s) ? s[1] : r * 2, 32)
    }
    case 'cylinder': {
      const r = Array.isArray(s) ? s[0] : s
      return new THREE.CylinderGeometry(r, r, Array.isArray(s) ? s[1] : r * 2, 32)
    }
    case 'torus': {
      const r = Array.isArray(s) ? s[0] : s
      return new THREE.TorusGeometry(r, Array.isArray(s) ? s[1] : r * 0.4, 16, 48)
    }
  }
}

/**
 * Mount a GenUI 3D scene into `container`.
 * @param container - the DOM node to host the WebGL canvas.
 * @param scene - the declarative scene spec.
 * @returns a disposer that removes the renderer and its context.
 */
export async function mountScene(container: HTMLElement, scene: GenuiScene3D): Promise<() => void> {
  const THREE = await loadThree()
  const width = container.clientWidth || 420
  const height = 240

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100)
  camera.position.set(3, 2.4, 4)
  camera.lookAt(0, 0, 0)

  const threeScene = new THREE.Scene()
  if (scene.background !== undefined) {
    try { threeScene.background = new THREE.Color(scene.background) } catch { /* keep transparent */ }
  }

  const ambient = new THREE.AmbientLight(0xffffff, scene.ambient ?? 0.8)
  threeScene.add(ambient)
  const key = new THREE.DirectionalLight(0xffffff, 1.6)
  key.position.set(4, 6, 3)
  threeScene.add(key)
  const rim = new THREE.DirectionalLight(0x6ea8ff, 0.6)
  rim.position.set(-4, -2, -4)
  threeScene.add(rim)

  // Wireframe-ish ground grid for spatial reference.
  const grid = new THREE.GridHelper(8, 16, 0x3a4152, 0x232a38)
  threeScene.add(grid)

  for (const mesh of scene.meshes) {
    const geo = geometryFor(THREE, mesh.shape, mesh.size)
    const color = new THREE.Color(mesh.color ?? '#6ea8ff')
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 })
    const obj = new THREE.Mesh(geo, mat)
    const p = mesh.position ?? [0, 0, 0]
    obj.position.set(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0)
    const r = mesh.rotation ?? [0, 0, 0]
    obj.rotation.set(r[0] ?? 0, r[1] ?? 0, r[2] ?? 0)
    const sc = mesh.scale ?? 1
    if (typeof sc === 'number') obj.scale.setScalar(sc)
    else obj.scale.set(sc[0] ?? 1, sc[1] ?? 1, sc[2] ?? 1)
    threeScene.add(obj)
  }

  // Orbit: simple drag-to-rotate, wheel to zoom (no external controls dep).
  // EVENT-DRIVEN rendering: one render after init, one per orbit change —
  // a static scene never runs a requestAnimationFrame loop, so an idle
  // scene costs zero GPU/battery. Pointer capture keeps all drag events on
  // the canvas (no window listeners, nothing to leak on unmount).
  let isDragging = false
  let prevX = 0
  let prevY = 0
  let theta = 0.8
  let phi = 0.6
  let radius = 5.5
  const orbit = (): void => {
    camera.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    )
    camera.lookAt(0, 0, 0)
    renderer.render(threeScene, camera)
  }

  const onPointerDown = (e: PointerEvent): void => {
    isDragging = true
    prevX = e.clientX
    prevY = e.clientY
    try { canvas.setPointerCapture(e.pointerId) } catch { /* jsdom / capture unsupported */ }
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!isDragging) return
    // Drag follows the cursor (standard orbit feel): dragging right/left
    // sweeps the azimuth with the pointer, dragging up/down tilts the polar
    // angle with the pointer (phi grows from +Y down toward the equator).
    theta += (e.clientX - prevX) * 0.01
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi - (e.clientY - prevY) * 0.01))
    prevX = e.clientX
    prevY = e.clientY
    orbit()
  }
  const onPointerEnd = (e: PointerEvent): void => {
    if (!isDragging) return
    isDragging = false
    try { canvas.releasePointerCapture(e.pointerId) } catch { /* jsdom */ }
  }
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    radius = Math.max(2.5, Math.min(14, radius + e.deltaY * 0.005))
    orbit()
  }
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerEnd)
  canvas.addEventListener('pointercancel', onPointerEnd)
  canvas.addEventListener('wheel', onWheel, { passive: false })

  // Container-size sync: the panel is resizable and the window reflows, so a
  // fixed mount-time width drifts. Event-driven like the orbit — a resize
  // renders exactly once, an idle scene still costs nothing.
  let lastWidth = width
  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
      const w = container.clientWidth || 420
      if (w === lastWidth) return
      lastWidth = w
      renderer.setSize(w, height)
      camera.aspect = w / height
      camera.updateProjectionMatrix()
      renderer.render(threeScene, camera)
    })
    : null
  observer?.observe(container)

  orbit() // initial render; afterwards only interactions re-render.

  return () => {
    observer?.disconnect()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerEnd)
    canvas.removeEventListener('pointercancel', onPointerEnd)
    canvas.removeEventListener('wheel', onWheel)
    renderer.dispose()
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
  }
}
