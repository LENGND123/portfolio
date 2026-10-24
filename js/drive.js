// Local forward is -Z. rotation.y > 0 turns that forward toward -X (left).
// ArrowRight stores a negative steer so the nose swings toward +X.

export const CAR_RADIUS = 0.52

export function createDriveState(x = 0, z = 8) {
  return { x, z, yaw: 0, speed: 0, steer: 0 }
}

export function carForward(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) }
}

function pushOut(x, z, radius, c) {
  if (c.kind === 'circle') {
    let dx = x - c.x
    let dz = z - c.z
    let dist = Math.hypot(dx, dz)
    const min = radius + c.r
    if (dist >= min) return { x, z, hit: false }
    if (dist < 1e-8) {
      dx = 1
      dz = 0
      dist = 1
    }
    const scale = (min - dist) / dist
    return { x: x + dx * scale, z: z + dz * scale, hit: true }
  }

  const cos = Math.cos(c.yaw)
  const sin = Math.sin(c.yaw)
  const dx = x - c.x
  const dz = z - c.z
  const lx = dx * cos - dz * sin
  const lz = dx * sin + dz * cos
  const clampedX = clamp(lx, -c.hx, c.hx)
  const clampedZ = clamp(lz, -c.hz, c.hz)
  let ox = lx - clampedX
  let oz = lz - clampedZ
  let dist = Math.hypot(ox, oz)

  if (dist >= radius) return { x, z, hit: false }

  let localX
  let localZ
  if (dist < 1e-8) {
    const penX = c.hx - Math.abs(lx)
    const penZ = c.hz - Math.abs(lz)
    const extra = Math.min(penX, penZ) + radius
    if (penX < penZ) {
      localX = (lx >= 0 ? 1 : -1) * extra
      localZ = 0
    } else {
      localX = 0
      localZ = (lz >= 0 ? 1 : -1) * extra
    }
  } else {
    const scale = (radius - dist) / dist
    localX = ox * scale
    localZ = oz * scale
  }

  return {
    x: x + localX * cos + localZ * sin,
    z: z - localX * sin + localZ * cos,
    hit: true,
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function resolveCircle(x, z, radius, colliders) {
  let hit = false
  let pushX = 0
  let pushZ = 0
  for (let pass = 0; pass < 4; pass += 1) {
    for (const collider of colliders) {
      const next = pushOut(x, z, radius, collider)
      if (!next.hit) continue
      pushX += next.x - x
      pushZ += next.z - z
      x = next.x
      z = next.z
      hit = true
    }
  }
  return { x, z, hit, pushX, pushZ }
}

export function stepDrive(state, input, dt, colliders = []) {
  const steerTarget = input.right ? -1 : input.left ? 1 : 0
  state.steer += (steerTarget - state.steer) * Math.min(1, dt * 8)

  let accel = 0
  if (input.forward) accel = 14
  else if (input.back) accel = -9

  state.speed += accel * dt
  const braking = input.back && state.speed > 0.15
  const drag = braking ? 3.4 : input.forward || input.back ? 0.35 : 1.15
  state.speed *= Math.exp(-dt * drag)
  state.speed = clamp(state.speed, -4.5, 8.2)
  if (Math.abs(state.speed) < 0.04 && !input.forward && !input.back) state.speed = 0

  if (Math.abs(state.speed) > 0.12) {
    const speedFactor = clamp(Math.abs(state.speed) / 7.5, 0.15, 1)
    state.yaw += state.steer * Math.sign(state.speed) * dt * 2.15 * speedFactor
  }

  const forward = carForward(state.yaw)
  state.x += forward.x * state.speed * dt
  state.z += forward.z * state.speed * dt

  const resolved = resolveCircle(state.x, state.z, CAR_RADIUS, colliders)
  state.x = resolved.x
  state.z = resolved.z
  if (resolved.hit) {
    const pushLen = Math.hypot(resolved.pushX, resolved.pushZ) || 1
    const nx = resolved.pushX / pushLen
    const nz = resolved.pushZ / pushLen
    const into = forward.x * nx + forward.z * nz
    if (state.speed > 0 && into < -0.25) state.speed = Math.min(state.speed, 0.35)
    if (state.speed < 0 && into > 0.25) state.speed = Math.max(state.speed, -0.35)
  }

  const dx = state.x - 2
  const dz = state.z + 28
  const dist = Math.hypot(dx, dz)
  if (dist > 130) {
    state.x = 2 + (dx / dist) * 130
    state.z = -28 + (dz / dist) * 130
    state.speed *= 0.4
  }

  return state
}

export function selfTestDrive() {
  const errors = []
  const assert = (condition, message) => {
    if (!condition) errors.push(message)
  }

  const forward = carForward(0)
  assert(Math.abs(forward.x) < 1e-6 && forward.z < -0.99, 'yaw 0 should face -Z')
  assert(-forward.z > 0.99, 'the camera behind the car sits on +Z')

  let state = createDriveState(0, 0)
  for (let i = 0; i < 90; i += 1) {
    stepDrive(state, { forward: true, back: false, left: false, right: false }, 1 / 60, [])
  }
  assert(state.z < -1, `forward should move toward -Z, z=${state.z.toFixed(2)}`)
  assert(Math.abs(state.x) < 0.25, `straight drive should hold x, x=${state.x.toFixed(2)}`)

  state = createDriveState(0, 0)
  for (let i = 0; i < 80; i += 1) {
    stepDrive(state, { forward: true, back: false, left: false, right: true }, 1 / 60, [])
  }
  assert(state.x > 0.35, `right should move toward +X, x=${state.x.toFixed(2)}`)
  assert(state.yaw < -0.08, `right should decrease yaw, yaw=${state.yaw.toFixed(2)}`)
  assert(carForward(state.yaw).x > 0.05, 'right turn should face +X')

  state = createDriveState(0, 0)
  for (let i = 0; i < 80; i += 1) {
    stepDrive(state, { forward: true, back: false, left: true, right: false }, 1 / 60, [])
  }
  assert(state.x < -0.35, `left should move toward -X, x=${state.x.toFixed(2)}`)
  assert(state.yaw > 0.08, `left should increase yaw, yaw=${state.yaw.toFixed(2)}`)

  state = createDriveState(0, 0)
  for (let i = 0; i < 90; i += 1) {
    stepDrive(state, { forward: false, back: true, left: false, right: false }, 1 / 60, [])
  }
  assert(state.z > 0.4, `reverse should move toward +Z, z=${state.z.toFixed(2)}`)

  const wall = [{ kind: 'circle', x: 0, z: -2, r: 0.6 }]
  state = createDriveState(0, 0)
  for (let i = 0; i < 200; i += 1) {
    stepDrive(state, { forward: true, back: false, left: false, right: false }, 1 / 60, wall)
  }
  assert(state.z > -2 + 0.6 + CAR_RADIUS - 0.08, `circle wall was crossed, z=${state.z.toFixed(2)}`)

  const obb = [{ kind: 'obb', x: 0, z: -3, hx: 3, hz: 0.3, yaw: 0 }]
  state = createDriveState(0, 0)
  for (let i = 0; i < 200; i += 1) {
    stepDrive(state, { forward: true, back: false, left: false, right: false }, 1 / 60, obb)
  }
  assert(state.z > -3 + 0.3 + CAR_RADIUS - 0.08, `wall was crossed, z=${state.z.toFixed(2)}`)

  const sideWall = [{ kind: 'obb', x: -3, z: 0, hx: 3, hz: 0.3, yaw: Math.PI / 2 }]
  state = createDriveState(0, 0)
  state.yaw = Math.PI / 2
  for (let i = 0; i < 200; i += 1) {
    stepDrive(state, { forward: true, back: false, left: false, right: false }, 1 / 60, sideWall)
  }
  assert(state.x > -3 + 0.3 + CAR_RADIUS - 0.08, `rotated wall was crossed, x=${state.x.toFixed(2)}`)

  return errors
}
