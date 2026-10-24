import * as THREE from 'three'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { CAR_RADIUS, carForward, resolveCircle } from './drive.js'
import { LAYOUT } from './data.js'

const mats = {
  white: new THREE.MeshLambertMaterial({ color: 0xf7f4ef }),
  yellow: new THREE.MeshLambertMaterial({ color: 0xf3e34b }),
  yellowDeep: new THREE.MeshLambertMaterial({ color: 0xe4cf2e }),
  trunk: new THREE.MeshLambertMaterial({ color: 0xb07d45 }),
  wood: new THREE.MeshLambertMaterial({ color: 0xf4e7d6 }),
  clay: new THREE.MeshLambertMaterial({ color: 0xe39a55 }),
  bezel: new THREE.MeshLambertMaterial({ color: 0x101216 }),
}

const brickGeo = new THREE.BoxGeometry(0.56, 0.26, 0.3)
const tileGeo = new THREE.BoxGeometry(0.92, 0.05, 0.92)
const trunkGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22)
const canopyGeo = new THREE.BoxGeometry(0.78, 1.35, 0.78)
const canopyTopGeo = new THREE.BoxGeometry(0.52, 0.62, 0.52)
const rockGeo = new THREE.DodecahedronGeometry(0.45, 0)

function addDecal(scene, lines, x, z, width, height, weight = 700, yaw = 0) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = Math.max(180, Math.round(1024 * (height / width)))
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const maxWidth = canvas.width * 0.92
  let size = Math.floor(canvas.height / (lines.length + 0.7))
  while (size > 18) {
    ctx.font = `${weight} ${size}px Outfit, sans-serif`
    const tooWide = lines.some((line) => ctx.measureText(line).width > maxWidth)
    const tooTall = size * 1.16 * lines.length > canvas.height * 0.88
    if (!tooWide && !tooTall) break
    size -= 2
  }
  ctx.font = `${weight} ${size}px Outfit, sans-serif`
  lines.forEach((line, index) => {
    const y = canvas.height / 2 + (index - (lines.length - 1) / 2) * size * 1.14
    ctx.fillText(line, canvas.width / 2, y)
  })
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
  material.polygonOffset = true
  material.polygonOffsetFactor = -2
  material.polygonOffsetUnits = -2
  const holder = new THREE.Group()
  holder.position.set(x, 0.06, z)
  holder.rotation.y = yaw
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  decal.rotation.x = -Math.PI / 2
  holder.add(decal)
  scene.add(holder)
  return holder
}

function softWrap(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:]$/, '')}…`
  return kept
}

function wrapCanvas(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trim()}…`
  return kept
}

function drawScreen(project, anisotropy) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#12151c'
  ctx.fillRect(0, 0, 1280, 720)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = '600 68px Outfit, sans-serif'
  const title = project.repo
  ctx.fillText(title.length > 28 ? `${title.slice(0, 26)}…` : title, 72, 168)
  ctx.font = '400 34px Outfit, sans-serif'
  ctx.fillStyle = '#b7c0ce'
  const lines = wrapCanvas(ctx, project.description, 1120, 3)
  lines.forEach((line, index) => ctx.fillText(line, 72, 280 + index * 52))
  ctx.fillStyle = project.color || '#c9d1d9'
  ctx.beginPath()
  ctx.arc(88, 610, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '500 30px Outfit, sans-serif'
  ctx.fillStyle = '#d5dbe6'
  ctx.fillText(String(project.language || 'Code').toUpperCase(), 118, 612)
  if (project.stars) {
    ctx.textAlign = 'right'
    ctx.fillText(`★  ${project.stars}`, 1200, 612)
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = anisotropy
  return map
}

function makeRect(width, height) {
  const halfW = width / 2
  const halfD = height / 2
  const points = [
    new THREE.Vector3(-halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, -halfD),
    new THREE.Vector3(halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, halfD),
    new THREE.Vector3(-halfW, 0, -halfD),
  ]
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
  )
}

function addTile(scene, x, z, yaw = 0) {
  const tile = new THREE.Mesh(tileGeo, mats.white)
  tile.position.set(x, 0.028, z)
  tile.rotation.y = yaw
  tile.castShadow = true
  tile.receiveShadow = true
  scene.add(tile)
}

function addTree(scene, colliders, x, z, scale) {
  const group = new THREE.Group()
  const trunk = new THREE.Mesh(trunkGeo, mats.trunk)
  trunk.position.y = 0.36 * scale
  trunk.castShadow = true
  const canopy = new THREE.Mesh(canopyGeo, mats.yellow)
  canopy.position.y = (0.72 + 0.67) * scale
  canopy.castShadow = true
  canopy.receiveShadow = true
  const top = new THREE.Mesh(canopyTopGeo, mats.yellowDeep)
  top.position.y = (0.72 + 1.35 + 0.2) * scale
  top.castShadow = true
  trunk.scale.y = scale
  canopy.scale.setScalar(scale)
  top.scale.setScalar(scale)
  group.add(trunk, canopy, top)
  group.position.set(x, 0, z)
  group.rotation.y = (x * 1.7 + z) * 0.2
  scene.add(group)
  colliders.push({ kind: 'circle', x, z, r: 0.42 * scale })
}

function addRock(scene, colliders, x, z, scale) {
  const rock = new THREE.Mesh(rockGeo, mats.white)
  rock.scale.set(scale, scale * 0.72, scale * 0.9)
  rock.position.set(x, 0.12 * scale, z)
  rock.rotation.y = x + z
  rock.castShadow = true
  rock.receiveShadow = true
  scene.add(rock)
  colliders.push({ kind: 'circle', x, z, r: 0.34 * scale })
}

function addWall(scene, colliders, x, z, yaw, cols, rows) {
  const brickW = 0.56
  const brickH = 0.26
  const gap = 0.045
  const group = new THREE.Group()
  const totalW = cols * brickW + (cols - 1) * gap
  for (let row = 0; row < rows; row += 1) {
    const stagger = row % 2 ? (brickW + gap) / 2 : 0
    const count = row % 2 ? cols - 1 : cols
    for (let col = 0; col < count; col += 1) {
      const brick = new THREE.Mesh(brickGeo, mats.white)
      brick.position.set(
        -totalW / 2 + brickW / 2 + stagger + col * (brickW + gap),
        brickH / 2 + row * (brickH + gap),
        0,
      )
      brick.castShadow = true
      brick.receiveShadow = true
      group.add(brick)
    }
  }
  group.position.set(x, 0, z)
  group.rotation.y = yaw
  scene.add(group)
  colliders.push({ kind: 'obb', x, z, hx: totalW / 2, hz: 0.2, yaw })
}

function addBoard(scene, colliders, x, z, project, anisotropy) {
  const root = new THREE.Group()
  root.position.set(x, 0, z)
  const leg = new THREE.BoxGeometry(0.12, 0.7, 0.12)
  const left = new THREE.Mesh(leg, mats.wood)
  const right = new THREE.Mesh(leg, mats.wood)
  left.position.set(-1.35, 0.35, 0.15)
  right.position.set(1.35, 0.35, 0.15)
  left.castShadow = true
  right.castShadow = true
  root.add(left, right)

  const frame = new THREE.Group()
  frame.position.set(0, 1.95, 0)
  frame.rotation.x = -0.28
  const width = 4.2
  const height = 2.4
  const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.14), mats.wood)
  shell.castShadow = true
  shell.receiveShadow = true
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, height - 0.16, 0.04), mats.bezel)
  bezel.position.z = 0.08
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.34, height - 0.34),
    new THREE.MeshBasicMaterial({ map: project.preview || drawScreen(project, anisotropy) }),
  )
  screen.position.z = 0.11
  frame.add(shell, bezel, screen)
  root.add(frame)
  scene.add(root)
  colliders.push({ kind: 'circle', x, z, r: 1.35 })
}

function addBox(parent, material, w, h, d, x, y, z) {
  const item = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  item.position.set(x, y, z)
  item.castShadow = true
  item.receiveShadow = true
  parent.add(item)
}

function addStatue(scene, colliders) {
  const { x, z } = LAYOUT.profile
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.46, 2.7), mats.white)
  plinth.position.set(x, 0.23, z)
  plinth.castShadow = true
  plinth.receiveShadow = true
  const cap = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.1, 2.25), mats.white)
  cap.position.set(x, 0.5, z)
  cap.castShadow = true
  scene.add(plinth, cap)

  const figure = new THREE.Group()
  addBox(figure, mats.clay, 1.15, 0.12, 1.05, 0, 0.58, 0.05)
  addBox(figure, mats.clay, 1.05, 0.5, 0.1, 0, 0.86, -0.42)
  addBox(figure, mats.clay, 0.12, 0.55, 0.12, -0.48, 0.3, 0.38)
  addBox(figure, mats.clay, 0.12, 0.55, 0.12, 0.48, 0.3, 0.38)
  addBox(figure, mats.clay, 0.12, 0.55, 0.12, -0.48, 0.3, -0.36)
  addBox(figure, mats.clay, 0.12, 0.55, 0.12, 0.48, 0.3, -0.36)
  addBox(figure, mats.clay, 0.12, 0.32, 0.46, -0.48, 0.78, -0.05)
  addBox(figure, mats.clay, 0.12, 0.32, 0.46, 0.48, 0.78, -0.05)
  addBox(figure, mats.clay, 0.58, 0.62, 0.36, 0, 1.02, 0.02)
  addBox(figure, mats.clay, 0.42, 0.4, 0.38, 0, 1.5, 0.1)
  addBox(figure, mats.clay, 0.14, 0.4, 0.16, -0.4, 1.12, 0.08)
  addBox(figure, mats.clay, 0.14, 0.4, 0.16, 0.4, 1.12, 0.08)
  addBox(figure, mats.clay, 0.2, 0.14, 0.42, -0.16, 0.72, 0.36)
  addBox(figure, mats.clay, 0.2, 0.14, 0.42, 0.16, 0.72, 0.36)
  addBox(figure, mats.clay, 0.16, 0.36, 0.16, -0.16, 0.44, 0.52)
  addBox(figure, mats.clay, 0.16, 0.36, 0.16, 0.16, 0.44, 0.52)
  figure.position.set(x, 0.52, z)
  figure.rotation.y = Math.PI / 2
  scene.add(figure)
  colliders.push({ kind: 'circle', x, z, r: 1.45 })
}

function addKeys(scene, colliders, font) {
  if (!font) {
    addDecal(scene, ['KEYS'], 5.4, -5.6, 3.4, 1.15)
    return
  }
  const geo = new TextGeometry('KEYS', {
    font,
    size: 0.78,
    depth: 0.36,
    curveSegments: 4,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.02,
    bevelSegments: 1,
  })
  geo.computeBoundingBox()
  const box = geo.boundingBox
  geo.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -box.min.z)
  const mesh = new THREE.Mesh(geo, mats.white)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.set(5.2, 0, -6.4)
  scene.add(mesh)
  colliders.push({ kind: 'circle', x: 5.2, z: -6.4, r: 1.05 })
}

function addGround(scene) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(180, 1024, 860, 0)
  gradient.addColorStop(0, '#ffd7b0')
  gradient.addColorStop(0.45, '#ff7a2a')
  gradient.addColorStop(1, '#ff3d00')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 1024)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.ClampToEdgeWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  const geo = new THREE.PlaneGeometry(240, 240)
  const uv = geo.attributes.uv
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    const worldX = pos.getX(i)
    const worldZ = -pos.getY(i)
    uv.setXY(i, (worldX + 46) / 92, (34 - worldZ) / 72)
  }
  uv.needsUpdate = true
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

export function createWorld(scene, { content, font, anisotropy = 8 }) {
  const colliders = []
  const zones = []
  const crates = []
  const pins = []

  scene.background = new THREE.Color(0xff6a1a)
  scene.fog = new THREE.Fog(0xff7d2e, 34, 118)
  scene.add(new THREE.HemisphereLight(0xfff3e6, 0xff7a2a, 0.72))
  scene.add(new THREE.AmbientLight(0xfff4ea, 0.28))
  const light = new THREE.DirectionalLight(0xfffaf4, 1.25)
  light.position.set(18, 26, 14)
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  light.shadow.camera.near = 2
  light.shadow.camera.far = 70
  const span = 24
  light.shadow.camera.left = -span
  light.shadow.camera.right = span
  light.shadow.camera.top = span
  light.shadow.camera.bottom = -span
  light.shadow.bias = -0.0005
  light.shadow.normalBias = 0.035
  scene.add(light)
  scene.add(light.target)
  addGround(scene)

  const faceProfile = Math.PI / 2
  addDecal(scene, ['USE YOUR ARROW KEYS', 'TO MOVE AROUND'], 0.2, 1.6, 8.6, 1.7)
  addKeys(scene, colliders, font)
  addDecal(scene, ['PROFILE'], -1.6, -21.4, 2.8, 0.46, 600)
  addDecal(scene, ['PROJECTS'], -0.2, -24.2, 3.4, 0.48, 700)
  addDecal(scene, ['PLAYGROUND'], 12.4, -13.4, 3.6, 0.42, 600)
  addDecal(scene, ['ADITYA RAJ SINGH'], -11.7, -16, 5.8, 0.62, 700, faceProfile)
  addDecal(scene, ['B.TECH CSE   ·   AJMER'], -12.5, -16, 4.8, 0.34, 600, faceProfile)
  addDecal(scene, ['LENGND123'], 14, 11, 2.8, 0.32, 600)

  const profileLine = makeRect(4.6, 3.1)
  profileLine.position.set(-9.5, 0.05, -16)
  scene.add(profileLine)
  zones.push({ kind: 'profile', x: -9.5, z: -16, hw: 2.3, hd: 1.55, line: profileLine })
  addDecal(scene, ['ENTER', 'PROFILE'], -9.5, -16, 3.2, 1.15, 700, faceProfile)

  let tileIndex = 0
  for (let z = 12; z >= -165; z -= 3.15) {
    const sway = tileIndex % 3 === 0 ? 0.55 : tileIndex % 3 === 1 ? -0.3 : 0.1
    addTile(scene, -5.7 + sway, z, tileIndex % 2 ? 0.16 : -0.1)
    tileIndex += 1
  }
  for (let x = -1.4; x >= -7.2; x -= 1.85) addTile(scene, x, -18.15, 0.14)
  for (let x = 1.2; x <= 14; x += 1.9) addTile(scene, x, -20.4, -0.1)
  addTile(scene, -1.1, 6.4, 0.4)
  addTile(scene, 1.8, 8.1, -0.2)
  addTile(scene, 3.2, 5.2, 0.25)
  addTile(scene, -3.6, 4.6, 0.15)
  addTile(scene, 4.6, -8.2, 0.3)
  addTile(scene, 2.2, -12.4, -0.18)

  const trees = [
    [7.4, 5.2, 1.15], [9.6, 0.6, 0.92], [6.4, -2.8, 1.22], [11.2, 8.2, 0.84],
    [-9.2, 5.4, 1.02], [8.6, -15.5, 1.08], [15.5, -9.5, 0.9], [-18.5, -9.2, 1.05],
    [24, -30, 1.15], [-10, -42, 0.95], [13.5, -50, 1.05], [18, -66, 0.9],
    [-7, -74, 1.1], [6, -90, 0.88], [-16, -28, 0.96], [26, -48, 1],
    [14, -120, 0.92], [-8, -132, 1],
  ]
  for (const [x, z, scale] of trees) addTree(scene, colliders, x, z, scale)

  const rocks = [
    [4.4, 2.8, 0.7], [8.2, -1.6, 0.5], [-5.2, -0.6, 0.62], [3.2, -11.5, 0.42],
    [16.2, -21, 0.55], [-11.5, -7.5, 0.48], [1.5, -20, 0.4], [21, -12, 0.58],
  ]
  for (const [x, z, scale] of rocks) addRock(scene, colliders, x, z, scale)

  const walls = [
    [-8.6, 3.4, 0.35, 5, 3],
    [-10.2, 0.8, 1.15, 4, 2],
    [13.2, -5.6, -0.25, 4, 3],
    [-18.2, -22.5, 0.15, 5, 2],
    [25.5, -16, 0.9, 4, 3],
    [8.5, -102, 0.2, 6, 2],
  ]
  for (const [x, z, yaw, cols, rows] of walls) addWall(scene, colliders, x, z, yaw, cols, rows)

  addStatue(scene, colliders)

  content.projects.forEach((project, index) => {
    const z = LAYOUT.projectZ(index)
    const title = project.repo.toUpperCase()
    addBoard(scene, colliders, 7.1, z - 2.7, project, anisotropy)
    addDecal(scene, [`GITHUB PROJECT  |  0${index + 1}`], 0.2, z - 1.55, 4.8, 0.36, 600)
    addDecal(scene, [title], 0.2, z - 0.15, 8.2, 1.15)
    addDecal(scene, softWrap(project.description, 42, 2), 0.2, z + 1.45, 7.4, 0.85, 500)
    addDecal(scene, [project.stack], 0.2, z + 2.55, 5.5, 0.34, 600)
    const line = makeRect(5.4, 2.5)
    line.position.set(0.2, 0.05, z + 4.55)
    scene.add(line)
    zones.push({
      kind: 'project',
      project,
      x: 0.2,
      z: z + 4.55,
      hw: 2.7,
      hd: 1.25,
      line,
    })
    addDecal(scene, [`OPEN   ${title}`], 0.2, z + 3.35, 5, 0.42)
  })

  const crateSpots = [
    [17.4, -16.2, 0.62],
    [18.3, -16.9, 0.5],
    [16.6, -17.4, 0.56],
    [19.1, -17.6, 0.68],
    [17.8, -15.4, 0.48],
    [15.8, -16.2, 0.58],
    [19.6, -15.6, 0.44],
  ]
  for (const [x, z, size] of crateSpots) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mats.white)
    mesh.position.set(x, size / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    crates.push({ mesh, x, z, vx: 0, vz: 0, size, r: size * 0.56 })
  }

  const pinOffsets = [
    [0, 0],
    [-0.48, 0.72],
    [0.48, 0.72],
    [-0.96, 1.44],
    [0, 1.44],
    [0.96, 1.44],
  ]
  for (const [ox, oz] of pinOffsets) {
    const group = new THREE.Group()
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.72, 8), mats.white)
    cone.position.y = 0.36
    cone.castShadow = true
    group.add(cone)
    const x = 21.2 + ox
    const z = -23.4 + oz
    group.position.set(x, 0, z)
    scene.add(group)
    pins.push({
      group,
      x,
      z,
      r: 0.28,
      down: false,
      angle: 0,
      axis: new THREE.Vector3(1, 0, 0),
    })
  }

  addDecal(scene, ['BUMP THE PINS'], 21.2, -20.6, 3.4, 0.36, 600)

  function zoneAt(x, z) {
    for (let i = zones.length - 1; i >= 0; i -= 1) {
      const zone = zones[i]
      if (Math.abs(x - zone.x) < zone.hw && Math.abs(z - zone.z) < zone.hd) return zone
    }
    return null
  }

  function update(state, dt, time) {
    const active = zoneAt(state.x, state.z)
    for (const zone of zones) {
      const on = zone === active
      zone.line.material.opacity = on ? 0.45 + Math.sin(time * 5) * 0.35 : 0.92
    }

    for (const crate of crates) {
      const dx = crate.x - state.x
      const dz = crate.z - state.z
      const dist = Math.hypot(dx, dz) || 0.0001
      const min = crate.r + CAR_RADIUS
      if (dist < min) {
        const nx = dx / dist
        const nz = dz / dist
        const push = min - dist
        crate.x += nx * push * 0.8
        crate.z += nz * push * 0.8
        state.x -= nx * push * 0.2
        state.z -= nz * push * 0.2
        const forward = carForward(state.yaw)
        crate.vx += forward.x * state.speed * 0.85 + nx * 1.2
        crate.vz += forward.z * state.speed * 0.85 + nz * 1.2
        state.speed *= 0.74
      }
      crate.vx *= Math.exp(-dt * 2.5)
      crate.vz *= Math.exp(-dt * 2.5)
      crate.x += crate.vx * dt
      crate.z += crate.vz * dt
      const resolved = resolveCircle(crate.x, crate.z, crate.r, colliders)
      crate.x = resolved.x
      crate.z = resolved.z
      if (resolved.hit) {
        crate.vx *= 0.35
        crate.vz *= 0.35
      }
      crate.mesh.position.set(crate.x, crate.size / 2, crate.z)
    }

    for (let i = 0; i < crates.length; i += 1) {
      for (let j = i + 1; j < crates.length; j += 1) {
        const a = crates[i]
        const b = crates[j]
        let dx = b.x - a.x
        let dz = b.z - a.z
        let dist = Math.hypot(dx, dz)
        const min = a.r + b.r
        if (dist >= min) continue
        if (dist < 1e-6) {
          dx = 1
          dz = 0
          dist = 1
        }
        const push = (min - dist) / dist
        a.x -= dx * push * 0.5
        a.z -= dz * push * 0.5
        b.x += dx * push * 0.5
        b.z += dz * push * 0.5
      }
    }

    for (const pin of pins) {
      const dx = pin.x - state.x
      const dz = pin.z - state.z
      const dist = Math.hypot(dx, dz)
      if (!pin.down && dist < pin.r + CAR_RADIUS) {
        pin.down = true
        const nx = dx / (dist || 1)
        const nz = dz / (dist || 1)
        pin.axis.set(nz, 0, -nx).normalize()
        state.speed *= 0.88
      }
      if (pin.down && pin.angle < Math.PI / 2) {
        pin.angle = Math.min(Math.PI / 2, pin.angle + dt * 5.5)
        pin.group.quaternion.setFromAxisAngle(pin.axis, pin.angle)
      }
    }

    return active
  }

  return { colliders, light, zoneAt, update }
}
