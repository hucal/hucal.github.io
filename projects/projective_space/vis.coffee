$(document).ready(
# Prepare document and renderer.
if (!Detector.webgl) then $('div#vis').prepend('<h2>The visualization requires WebGL.</h2>')
if (!Detector.canvas) then $('div#vis').prepend('<h2>The visualization requires the HTML5 Canvas.</h2>')

container = document.getElementById('vis')

scene = new (THREE.Scene)
scene.fog = new THREE.FogExp2( 0xffffff, 0.002 )

camera_far = 10000
camera = new (THREE.PerspectiveCamera)(75, container.offsetWidth / container.offsetHeight, 0.1, camera_far)

renderer = new (THREE.WebGLRenderer)((antialias: true))
renderer.setSize container.offsetWidth, container.offsetHeight
renderer.setClearColor(scene.fog.color, 1)
renderer.setPixelRatio(window.devicePixelRatio)

container.appendChild renderer.domElement

window.addEventListener('resize', () ->
  camera.aspect = container.offsetWidth / container.offsetHeight
  camera.updateProjectionMatrix()
  renderer.setSize container.offsetWidth, container.offsetHeight)

# Prepare Canvas for 2D drawings.
r2_canvas = document.createElement 'canvas'
r2_resolution = 1024
r2_canvas.width = r2_canvas.height = r2_resolution
r2_stage = new (createjs.Stage)(r2_canvas)

# Create fixed features

# xy plane
make_plane(root_objects, 2, 0xbbffbb)
make_point(root_objects, 0.02, 0xffffff, 1.0, 50)

# Sphere of radius 2
s2 = make_point(s2_points, 2, 0x101010, 1.0, 50)

# R2
r2_texture = new (THREE.Texture)(r2_canvas)
r2_texture.needsUpdate = true
r2 = new (THREE.Mesh)(
  new (THREE.PlaneGeometry)(2, 2),
  new (THREE.MeshBasicMaterial)((
        side: THREE.DoubleSide
        map: r2_texture
        transparent: true)))
r2.position.z = 1

# R2 grid
max = 10
for i in [-max..max]
  r2_stage.addChild canvas_line([i / max, 1], [i / max, -1], 0x222222, 1)
  r2_stage.addChild canvas_line([1, i / max], [-1, i / max], 0x222222, 1)

scene.add new (THREE.AmbientLight)(0x404040)
scene.add new (THREE.HemisphereLight)(0xffffff, 0x404040, 1)
scene.add obj for obj in root_objects

# Sample points and lines
x = y = 0.1
theta = PI / 4
c = Math.cos(theta)
s = Math.sin(theta)
m = new (THREE.Matrix3)().set(
  c, 0.1,   x, # 0
  0, s,   y, # 0
  0, 0.4, 1) # 0
  # 0, 0,   0, 1)
t = (m, p) -> array2_from_vec3(vec3_from_array(p).applyMatrix3(m))
points = [{'p': [0, 0], 'c': 0xff0000},
  {'p': [0.5, 0.5], 'c': 0xff00f0},
  {'p': [-0.4, 0.6], 'c': 0xfff000}]
lines = [{'p1': [0.2, 0.2], 'p2': [-0.3, 0.4], 'c': 0xaa0ff},
  {'p1': [-0.2, -0.1], 'p2': [0, 0.1], 'c': 0xff0aa}]


r2_points = new Array()
s2_points = new Array()
r3_points = new Array()

clear_scene = () ->
  for obj in [r2]
    obj.updateMatrix();
    obj.position.set( 0, 0, 0 );
    obj.rotation.set( 0, 0, 0 );
    obj.scale.set( 1, 1, 1 );
    obj.updateMatrix();
    scene.remove obj
  r2.position.z = 1
  for obj in r3_points.concat(s2_points)
    scene.remove obj
  for obj in r2_points
    r2_stage.removeChild(obj)
  r2_stage.update()
  r2.material.map.needsUpdate = true
  r2_points = new Array()
  s2_points = new Array()
  r3_points = new Array()

m_ = 0
add_all = (m, show_r2=true, show_s2=true, show_r3=true, trans_r2_plane=false) ->
  for p in points
    make_p_point(t(m, p.p), p.p, p.c, trans_r2_plane)
  for p in lines
    make_p_line(t(m, p.p1), t(m, p.p2), p.p1, p.p2, p.c, 1.0, true, trans_r2_plane)

  if show_r3
    for obj in r3_points
      scene.add obj
  if show_s2
    for obj in s2_points
      scene.add obj
  if show_r2
    scene.add r2
    for obj in r2_points
      r2_stage.addChild obj
    if trans_r2_plane
      m_ = new (THREE.Matrix4)().identity()
      for r in [0..2]
        for c in [0..2]
          m_.elements[r * 4 + c] = m.elements[r * 3 + c]
      r2.applyMatrix(m_)
      r2.updateMatrix()
      console.log r2.matrix

  r2_stage.update()
  r2.material.map.needsUpdate = true

# identity matrix
transform = new (THREE.Matrix3)()
show_r2 = show_s2 = show_r3 = true
trans_r2_plane = false

redraw = () ->
  clear_scene()
  add_all(transform, show_r2, show_s2, show_r3, trans_r2_plane)

camera.position.z = 3
theta = -PI * 1 / 2
camera.position.y = 2.5 * Math.sin theta
camera.position.x = 2.5 * Math.cos theta

# Controls
controls = new (THREE.OrbitControls)(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 1.0
controls.enablePan = false

render = ->
  requestAnimationFrame render
  renderer.render scene, camera
  controls.update()


# Reading and writing to the user's matrix
write_input_matrix = (m, dim=3, id_prefix="input#trans_") ->
  for r in [1..dim]
    for c in [1..dim]
      $(id_prefix + ('' + r) + ('' + c)).val(m.elements[(c - 1) * dim + (r - 1)])
read_input_matrix = (dim=3, id_prefix="input#trans_") ->
  a = Array(dim * dim)
  for r in [1..dim]
    for c in [1..dim]
      a[(c - 1) * dim + (r - 1)] = parseFloat($(id_prefix + ('' + r) + ('' + c)).val())
  return new (THREE.Matrix3)().fromArray(a)

# Checkboxes
for c in [
  {'checkbox': 'input#show_r2', 'f': () -> show_r2 = this.checked ; redraw()},
  {'checkbox': 'input#show_s2', 'f': () -> show_s2 = this.checked ; redraw()},
  {'checkbox': 'input#show_r3', 'f': () -> show_r3 = this.checked ; redraw()}]
  $(c.checkbox).prop('checked', true).change(c.f)

$('button#apply_trans').click(() -> transform = read_input_matrix() ; trans_r2_plane = false ; redraw())
$('button#apply_trans_plane').click(() -> transform = read_input_matrix() ; trans_r2_plane = true  ; redraw())

THREE.Matrix3.prototype.multiply = (other) -> return this.multiplyMatrices(this, other)
THREE.Matrix3.prototype.multiplyMatrices = (a, b) ->
  ae = a.elements
  be = b.elements

  a11 = ae[0]; a12 = ae[3]; a13 = ae[6]
  a21 = ae[1]; a22 = ae[4]; a23 = ae[7]
  a31 = ae[2]; a32 = ae[5]; a33 = ae[8]

  b11 = be[0]; b12 = be[3]; b13 = be[6]
  b21 = be[1]; b22 = be[4]; b23 = be[7]
  b31 = be[2]; b32 = be[5]; b33 = be[8]

  ae[0] = a11 * b11 + a11 * b12 + a11 * b13
  ae[3] = a12 * b21 + a12 * b22 + a12 * b23
  ae[6] = a13 * b31 + a13 * b32 + a13 * b33

  ae[1] = a21 * b11 + a21 * b12 + a21 * b13
  ae[4] = a22 * b21 + a22 * b22 + a22 * b23
  ae[7] = a23 * b31 + a23 * b32 + a23 * b33

  ae[2] = a31 * b11 + a31 * b12 + a31 * b13
  ae[5] = a32 * b21 + a32 * b22 + a32 * b23
  ae[8] = a33 * b31 + a33 * b32 + a33 * b33
  return a



make_rotation = (theta, s=1, reflection=false) ->
  return new (THREE.Matrix3)().set(
    s * (if reflection then -1 else 1) * Math.cos(theta), -s * Math.sin(theta), 0,
    s * (if reflection then -1 else 1) * Math.sin(theta),  s * Math.cos(theta), 0,
    0, 0, 1)

$('button#create_sim').click(() ->
  prefix = 'input#sim_'
  s = parseFloat($(prefix + 's').val())
  theta = parseFloat($(prefix + 'theta').val())
  theta = PI * theta / 180
  tx = parseFloat($(prefix + 'tx').val())
  ty = parseFloat($(prefix + 'ty').val())
  reflection = $(prefix + 'reflection').prop('checked')

  m = make_rotation(theta, s, reflection)
  m.elements[6] = tx
  m.elements[7] = ty
  write_input_matrix(m))

$('button#create_identity').click(() ->
  write_input_matrix(new (THREE.Matrix3)().identity()))
$('button#apply_identity').click(() ->
  transform = new (THREE.Matrix3)().identity()
  redraw())
$('button#create_aff').click(() ->
  prefix = 'input#aff_'
  theta = parseFloat($(prefix + 'theta').val())
  theta = PI * theta / 180
  phi = parseFloat($(prefix + 'phi').val())
  phi = PI * phi / 180
  l1 = parseFloat($(prefix + 'l1').val())
  l2 = parseFloat($(prefix + 'l2').val())
  tx = parseFloat($(prefix + 'tx').val())
  ty = parseFloat($(prefix + 'ty').val())
  reflection = $(prefix + 'reflection').prop('checked')

  console.log theta, phi, l1, l2, tx, ty, reflection
  m = make_rotation(theta, 1, reflection)
   .multiply(make_rotation(-phi)
   .multiply(new (THREE.Matrix3)().set(
      l1, 0, 0
      0, l2, 0
      0, 0, 1)
   .multiply(make_rotation(phi))))
  m.elements[6] = tx
  m.elements[7] = ty
  write_input_matrix(m))

colors = [parseInt(c.substr(1), 16) for c in ['#a6bddb', '#67a9cf', '#3690c0', '#02818a', '#016c59', '#014636']][0]
current_color = 0
color_dir = 1

$('button#add_point').click(() ->
  if current_color + color_dir < 0
    color_dir = 1
  if current_color + color_dir > colors.length - 1
    color_dir = -1
  current_color += color_dir

  x = parseFloat($('input#point_x').val())
  y = parseFloat($('input#point_y').val())
  points.push({'p': [x, y], 'c': colors[current_color]})
  redraw())

$('button#add_line').click(() ->
  if current_color + color_dir < 0
    color_dir = 1
  if current_color + color_dir > colors.length - 1
    color_dir = -1
  current_color += color_dir

  a = parseFloat($('input#line_a').val())
  b = parseFloat($('input#line_b').val())
  c = parseFloat($('input#line_c').val())
  # Two points on the line ax + by + c:
  # or y = (-ax - c) / b
  lines.push({'p1': [1, (a - c) / b], 'p2': [c / a, 0], 'c': colors[current_color]})
  redraw())
$('button#clear_all').click(() -> lines = []; points = []; clear_scene())

redraw()
render()
)
