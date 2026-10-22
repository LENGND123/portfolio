import * as THREE from 'three'

const paint = new THREE.MeshStandardMaterial({ color: 0xe10600, roughness: 0.38, metalness: 0.12 })
const white = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.46, metalness: 0.02 })
const glass = new THREE.MeshStandardMaterial({ color: 0x24343a, roughness: 0.18, metalness: 0.45 })
const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.62, metalness: 0.08 })
const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92 })
const hubMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.32, metalness: 0.55 })
const lamp = new THREE.MeshStandardMaterial({
  color: 0xfff6df,
  emissive: 0xfff1c4,
  emissiveIntensity: 0.7,
})
const brakeMat = new THREE.MeshStandardMaterial({
  color: 0x3a0d0d,
  emissive: 0xff2a1a,
  emissiveIntensity: 0.35,
})

function mesh(geo, mat, x, y, z, parent) {
  const item = new THREE.Mesh(geo, mat)
  item.position.set(x, y, z)
  item.castShadow = true
  item.receiveShadow = true
  parent.add(item)
  return item
}

export function createCar(scene) {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)

  mesh(new THREE.BoxGeometry(0.78, 0.2, 1.28), paint, 0, 0.3, 0.02, body)
  mesh(new THREE.BoxGeometry(0.72, 0.1, 0.42), paint, 0, 0.42, -0.28, body)
  mesh(new THREE.BoxGeometry(0.66, 0.2, 0.48), white, 0, 0.48, 0.08, body)
  mesh(new THREE.BoxGeometry(0.6, 0.15, 0.06), glass, 0, 0.48, -0.16, body)
  mesh(new THREE.BoxGeometry(0.6, 0.12, 0.05), glass, 0, 0.5, 0.32, body)
  mesh(new THREE.BoxGeometry(0.14, 0.08, 0.05), lamp, -0.22, 0.32, -0.63, body)
  mesh(new THREE.BoxGeometry(0.14, 0.08, 0.05), lamp, 0.22, 0.32, -0.63, body)
  mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), brakeMat, -0.24, 0.32, 0.66, body)
  mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), brakeMat, 0.24, 0.32, 0.66, body)
  mesh(new THREE.BoxGeometry(0.7, 0.05, 0.16), dark, 0, 0.2, 0.5, body)

  const antenna = new THREE.Group()
  antenna.position.set(0.18, 0.56, 0.22)
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 6), dark)
  stick.position.y = 0.28
  stick.castShadow = true
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), paint)
  ball.position.y = 0.6
  ball.castShadow = true
  antenna.add(stick, ball)
  body.add(antenna)

  const wheelGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.13, 18)
  wheelGeo.rotateZ(Math.PI / 2)
  const hubGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.14, 12)
  hubGeo.rotateZ(Math.PI / 2)

  const wheels = []
  for (const spec of [
    { x: -0.42, z: -0.4, steer: true },
    { x: 0.42, z: -0.4, steer: true },
    { x: -0.42, z: 0.44, steer: false },
    { x: 0.42, z: 0.44, steer: false },
  ]) {
    const pivot = new THREE.Group()
    pivot.position.set(spec.x, 0.17, spec.z)
    const spin = new THREE.Group()
    const tire = new THREE.Mesh(wheelGeo, rubber)
    tire.castShadow = true
    const hub = new THREE.Mesh(hubGeo, hubMat)
    spin.add(tire, hub)
    pivot.add(spin)
    body.add(pivot)
    wheels.push({ pivot, spin, steer: spec.steer })
  }

  const blobCanvas = document.createElement('canvas')
  blobCanvas.width = 128
  blobCanvas.height = 128
  const blobCtx = blobCanvas.getContext('2d')
  const gradient = blobCtx.createRadialGradient(64, 64, 10, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(80, 30, 0, 0.35)')
  gradient.addColorStop(1, 'rgba(80, 30, 0, 0)')
  blobCtx.fillStyle = gradient
  blobCtx.fillRect(0, 0, 128, 128)
  const blobMap = new THREE.CanvasTexture(blobCanvas)
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.3),
    new THREE.MeshBasicMaterial({ map: blobMap, transparent: true, depthWrite: false }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.03
  scene.add(blob)

  scene.add(root)

  let lean = 0
  let roll = 0
  return {
    sync(state, input, dt) {
      root.position.set(state.x, 0, state.z)
      root.rotation.set(0, state.yaw, 0)
      const accelLean = input.forward ? -0.14 : input.back ? 0.16 : 0
      lean += (accelLean - state.speed * 0.02 - lean) * Math.min(1, dt * 6)
      roll += (state.steer * Math.min(Math.abs(state.speed), 6) * -0.035 - roll) * Math.min(1, dt * 6)
      body.rotation.x = lean
      body.rotation.z = roll
      antenna.rotation.x = lean * 1.8

      for (const wheel of wheels) {
        wheel.spin.rotation.x += (state.speed / 0.17) * dt
        wheel.pivot.rotation.y = wheel.steer ? state.steer * 0.48 : 0
      }
      brakeMat.emissiveIntensity = input.back && state.speed > 0.2 ? 2.2 : 0.2
      blob.position.x = state.x
      blob.position.z = state.z
    },
  }
}
