import * as THREE from 'three'
import gsap from '../../node_modules/gsap/index.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import GUI from '../../node_modules/lil-gui/dist/lil-gui.esm.js'


/**
 * Debug
 */
const gui = new GUI()


/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Sizes
const sizes = {
    width: 800,
    height: 600
}

// Cursor
const cursor = {
    x: 0,
    y: 0
}

window.addEventListener('mousemove', (event) =>
{
    cursor.x = event.clientX / sizes.width - 0.5
    cursor.y = - (event.clientY / sizes.height - 0.5)
})

// Scene
const scene = new THREE.Scene()

// Object
const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })

const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 10, 10),
    material
)
sphere.position.x = 1.2

const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    material
)
plane.position.x = -1.2

scene.add(sphere, plane)

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
// const aspectRatio = sizes.width / sizes.height
// const camera = new THREE.OrthographicCamera(- 1 * aspectRatio, 1 * aspectRatio, 1, - 1, 0.1, 100)
camera.position.z = 3
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

// Renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)

// Animate
const clock = new THREE.Clock()

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    sphere.rotation.y = 0.1 * elapsedTime
    plane.rotation.y = 0.1 * elapsedTime

    sphere.rotation.x = -0.15 * elapsedTime
    plane.rotation.x = -0.15 * elapsedTime

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()