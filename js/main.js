import * as THREE from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { LAYOUT, loadContent } from './data.js'
import { carForward, createDriveState, selfTestDrive, stepDrive } from './drive.js'
import { createCar } from './car.js'
import { createWorld } from './world.js'

const params = new URLSearchParams(location.search)
const shot = params.get('shot')
if (shot) {
  const loader = document.querySelector('#loader')
  loader.style.transition = 'none'
  loader.style.display = 'none'
}

if (params.get('test') === '1') {
  const errors = selfTestDrive()
  const out = document.querySelector('#test-out')
  out.hidden = false
  out.textContent = errors.length ? errors.join('\n') : 'drive self-test passed'
  document.title = errors.length ? 'TEST FAIL' : 'TEST PASS'
}

const canvas = document.querySelector('#view')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NoToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 220)
const look = new THREE.Vector3()
const clock = new THREE.Clock()

const keys = new Set()
const input = { forward: false, back: false, left: false, right: false, enter: false }
let enterWasDown = false
let resetWasDown = false
let audio = null

function readInput() {
  input.forward = keys.has('ArrowUp') || keys.has('KeyW')
  input.back = keys.has('ArrowDown') || keys.has('KeyS')
  input.left = keys.has('ArrowLeft') || keys.has('KeyA')
  input.right = keys.has('ArrowRight') || keys.has('KeyD')
  input.enter = keys.has('Enter')
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
  keys.add(event.code)
  readInput()
  if (input.forward || input.back || input.left || input.right) startAudio()
})
window.addEventListener('keyup', (event) => {
  keys.delete(event.code)
  readInput()
})
window.addEventListener('blur', () => {
  keys.clear()
  readInput()
})

document.querySelectorAll('[data-key]').forEach((button) => {
  const code = button.dataset.key
  const press = (event) => {
    event.preventDefault()
    keys.add(code)
    readInput()
    startAudio()
  }
  const release = (event) => {
    event.preventDefault()
    keys.delete(code)
    readInput()
  }
  button.addEventListener('pointerdown', press)
  button.addEventListener('pointerup', release)
  button.addEventListener('pointerleave', release)
  button.addEventListener('pointercancel', release)
})

const bar = document.querySelector('#bar')
const setProgress = (value) => { bar.style.width = `${value}%` }

function loadPreview(url, attempt = 0) {
  if (!url) return Promise.resolve(null)
  const loader = new THREE.TextureLoader()
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        resolve(texture)
      },
      undefined,
      () => {
        if (attempt < 1) resolve(loadPreview(url, attempt + 1))
        else resolve(null)
      },
    )
  })
}

function loadFont() {
  const loader = new FontLoader()
  return new Promise((resolve) => {
    loader.load(
      'https://unpkg.com/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json',
      (font) => resolve(font),
      undefined,
      () => resolve(null),
    )
  })
}

function applyUser(user) {
  document.querySelector('#handle').textContent = `@${user.login}`
  document.querySelector('#name').textContent = user.name
  document.querySelector('#avatar').src = user.avatar
  document.querySelector('#avatar').alt = user.name
  document.querySelector('#panel-avatar').src = user.avatar
  document.querySelector('#panel-avatar').alt = user.name
  document.querySelector('#panel-name').textContent = user.name
  document.querySelector('#panel-handle').textContent = `@${user.login}`
  document.querySelector('#panel-bio').textContent = user.bio
  const bits = [user.company, user.location].filter(Boolean)
  document.querySelector('#panel-meta').textContent = bits.join('  ·  ')
  document.querySelector('#stat-repos').textContent = String(user.public_repos)
  document.querySelector('#stat-followers').textContent = String(user.followers)
  document.querySelector('#stat-following').textContent = String(user.following)
  document.querySelector('#link-github').href = user.html_url
  if (user.blog) document.querySelector('#link-linkedin').href = user.blog
  if (user.email) document.querySelector('#link-mail').href = `mailto:${user.email}`
  if (user.portfolio) document.querySelector('#link-site').href = user.portfolio
}

function openLink(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) location.href = url
}

const panel = document.querySelector('#panel')
function setPanel(open) {
  panel.hidden = !open
}
document.querySelector('#profile').addEventListener('click', () => setPanel(panel.hidden))
window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') setPanel(false)
})

function startAudio() {
  if (audio) return
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 48
  filter.type = 'lowpass'
  filter.frequency.value = 240
  gain.gain.value = 0
  osc.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  audio = { ctx, osc, gain }
  if (ctx.state === 'suspended') ctx.resume()
}

function updateAudio(speed) {
  if (!audio) return
  const amount = Math.min(0.02, Math.abs(speed) * 0.0028)
  audio.gain.gain.setTargetAtTime(amount, audio.ctx.currentTime, 0.08)
  audio.osc.frequency.setTargetAtTime(40 + Math.abs(speed) * 8, audio.ctx.currentTime, 0.08)
}

function placeCamera(state, dt, snap) {
  const forward = carForward(state.yaw)
  const desired = new THREE.Vector3(
    state.x - forward.x * 11.4,
    12.4,
    state.z - forward.z * 11.4,
  )
  const focus = new THREE.Vector3(
    state.x + forward.x * 2.6,
    0.4,
    state.z + forward.z * 2.6,
  )
  if (snap) {
    camera.position.copy(desired)
    look.copy(focus)
  } else {
    const blend = 1 - Math.pow(0.0008, dt)
    camera.position.lerp(desired, blend)
    look.lerp(focus, blend)
  }
  camera.lookAt(look)
}

function poseForShot(name) {
  if (name === 'projects' || name === 'avenue' || name === 'board') {
    const index = name === 'board' ? Number(params.get('n') || 0) : name === 'avenue' ? 1 : 0
    const z = name === 'avenue' ? LAYOUT.projectZ(1) + 12 : LAYOUT.projectZ(index) + 5.35
    return { x: 0.2, z, yaw: 0 }
  }
  if (name === 'profile') return { x: -6.2, z: -16, yaw: Math.PI / 2 }
  if (name === 'play') return { x: 12.5, z: -18, yaw: -Math.PI / 2 }
  return null
}

const hint = document.querySelector('#hint')
const defaultHint = 'ARROW KEYS / WASD DRIVE THROUGH THE PROFILE · ENTER INTERACT'

async function boot() {
  setProgress(12)
  await document.fonts.load('700 64px Outfit').catch(() => {})
  await document.fonts.ready.catch(() => {})
  setProgress(34)
  const content = await loadContent()
  await Promise.all(content.projects.map(async (project) => {
    project.preview = await loadPreview(project.image)
  }))
  applyUser(content.user)
  if (params.get('panel') === '1') setPanel(true)
  setProgress(62)
  const font = await loadFont()
  setProgress(84)
  const world = createWorld(scene, {
    content,
    font,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  })
  const car = createCar(scene)
  const posed = poseForShot(shot)
  const state = createDriveState(posed ? posed.x : LAYOUT.spawn.x, posed ? posed.z : LAYOUT.spawn.z)
  if (posed) state.yaw = posed.yaw
  car.sync(state, input, 0)
  placeCamera(state, 1 / 60, true)
  setProgress(100)
  requestAnimationFrame(() => document.querySelector('#loader').classList.add('hide'))
  document.body.dataset.ready = '1'

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05)
    if (keys.has('KeyR') && !resetWasDown) {
      const spawn = createDriveState(LAYOUT.spawn.x, LAYOUT.spawn.z)
      state.x = spawn.x
      state.z = spawn.z
      state.yaw = 0
      state.speed = 0
      state.steer = 0
    }
    resetWasDown = keys.has('KeyR')

    if (!shot) stepDrive(state, input, dt, world.colliders)
    const active = world.update(state, dt, clock.elapsedTime)
    car.sync(state, input, dt)
    world.light.position.set(state.x + 16, 26, state.z + 12)
    world.light.target.position.set(state.x, 0, state.z)
    placeCamera(state, dt, false)
    updateAudio(state.speed)

    if (active?.kind === 'project') hint.textContent = `ENTER  ·  OPEN ${active.project.repo.toUpperCase()}`
    else if (active?.kind === 'profile') hint.textContent = 'ENTER  ·  OPEN PROFILE'
    else hint.textContent = defaultHint

    if (input.enter && !enterWasDown && active) {
      if (active.kind === 'profile') setPanel(true)
      else openLink(active.project.url)
    }
    enterWasDown = input.enter

    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }
  frame()
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

boot()
