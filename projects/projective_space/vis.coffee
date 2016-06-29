if (!Detector.webgl) then Detector.addGetWebGLMessage

container = document.getElementById('vis')

scene = new (THREE.Scene)
scene.fog = new THREE.FogExp2( 0xffffff, 0.002 );

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

## canvas for 2D shapes
r2_canvas = document.createElement 'canvas'
r2_resolution = 1024
r2_canvas.width = r2_canvas.height = r2_resolution
r2_context = r2_canvas.getContext('2d')

canvas_draw = (ctx, obj) ->
  ctx.beginPath()
  col = if obj.color then obj.color else "#000"
  if obj.should_stroke
    ctx.lineWidth = if obj.lineWidth then obj.lineWidth else 2
    ctx.strokeStyle = col
    ctx.stroke(obj)
  else
    ctx.fillStyle = col
    ctx.fill(obj)
  ctx.closePath()

### utility functions ###
PI = Math.PI

vec3 = (x, y, z) -> new (THREE.Vector3)(x, y, z)
vec3_from_array = (p) ->
    return vec3(p[0], p[1], if p.length > 2 then p[2] else 1)

add_to = (c, o) ->
  c.push(o)
  return o

make_point = (collection, size, color, opacity=1.0, detail=15) ->
 return add_to(collection, new (THREE.Mesh)(
  new (THREE.SphereGeometry)(size, detail, detail),
  new (THREE.MeshLambertMaterial)(
    color: color,
    transparent: opacity != 1.0, opacity: opacity)))

make_plane = (collection, size, color, opacity=1.0) ->
 return add_to(collection, new (THREE.Mesh)(
  new (THREE.PlaneGeometry)(size, size)
  new (THREE.MeshBasicMaterial)((
    color: color, side: THREE.DoubleSide,
    transparent: opacity != 1.0, opacity: opacity))))

make_line = (collection, here, there, color, width=1, extend=true) ->
  # get vectors and extend the line's length to 2 * camera_far
  v1 = if here instanceof THREE.Vector3 then here else vec3_from_array(here)
  v2 = if there instanceof THREE.Vector3 then there else vec3_from_array(there)
  if extend
    v1_orig = v1.clone()
    v1.sub(v2)
    v1.setLength(camera_far)
    v1.add(v2)
    v2.sub(v1_orig)
    v2.setLength(camera_far)
    v2.add(v1_orig)

  geometry = new (THREE.Geometry)
  geometry.vertices.push(v1, v2)
  return add_to(collection, new (THREE.Line)(geometry,
    new (THREE.LineBasicMaterial)((color: color, linewidth: width))))

to_ctx_coords = (xy, f) -> f(r2_resolution / 2 * (xy[0] + 1), r2_resolution / 2 * (1 - xy[1]))

make_p_point = (x, y, color) ->
  # draw dot on canvas
  c1 = canvas_circ(r2_objects, x, y, color, 6)

  o1 = make_line(root_objects, [-x, -y, -1], [x, y, 1], color)

  o2 = make_point(s2_objects, 0.0075, color)
  o2.position.copy(vec3(x, y, 1).normalize())
  o3 = make_point(s2_objects, 0.0075, color)
  o3.position.copy(vec3(-x, -y, -1).normalize())

  return [[c1], [o1, o2, o3]]

to_canvas_color = (c) ->
  if c instanceof String || typeof c == "string"
    return c
  else
    return '#' + c.toString(16)

canvas_rect = (collection, start, end, color) ->
  c = add_to(collection, new Path2D())
  c.color = to_canvas_color(color)
  to_ctx_coords(start, (x1, y1) ->
    to_ctx_coords(end, (x2, y2) ->
      c.rect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1)))
  return c

canvas_circ = (collection, x, y, color, radius) ->
  c = add_to(collection, new Path2D())
  c.color = to_canvas_color(color)
  to_ctx_coords([x, y], (x, y) -> c.arc(x + 0.5, y + 0.5, radius, 0, 2 * PI))
  return c

canvas_line = (collection, p1, p2, color, width) ->
  c = add_to(collection, new Path2D())
  c.color = to_canvas_color(color)
  c.should_stroke = true
  c.lineWidth = width
  to_ctx_coords(p1, (x, y) -> c.moveTo(x, y))
  to_ctx_coords(p2, (x, y) -> c.lineTo(x + 0.5, y + 0.5))
  return c

make_p_line = (p1, p2, color, opacity=1.0, draw_points=false) ->
  o = make_plane(root_objects, 3, color, opacity)
  v1 = vec3(p1[0], p1[1], 1)
  v2 = vec3(p2[0], p2[1], 1)
  # draw line on canvas
  c = canvas_line(r2_objects, p1, p2, color, 14)

  if draw_points
    make_p_point(p1[0], p1[1], color)
    make_p_point(p2[0], p2[1], color)
  v1.cross(v2)
  v1.normalize()
  angle = v1.angleTo(vec3(0,0,1))
  o.rotation.setFromQuaternion new
    (THREE.Quaternion)().setFromUnitVectors(vec3(0, 0, 1), v1)
  return [c, o]


### setup scene ###
r2_objects = []
s2_objects = []
root_objects = []

# draw grid
canvas_rect(r2_objects, [-1, -1], [1, 1], "rgba(255, 255, 255, 0)")

max = 20
for i in [0..max]
  x = 1 - 2 * i / max
  canvas_line(r2_objects, [x, 1], [x, -1], "black", 2)
  canvas_line(r2_objects, [1, x], [-1, x], "black", 2)

make_plane(root_objects, 2, 0xbbffbb)

make_p_point(0, 0, 0xff0000)
make_p_point(0.5, 0.5, 0xff0000)
make_p_line([0.2, 0.2], [-0.3, 0.4], 0xff00ff, 0.5, true)
make_p_line([-0.2, -0.2], [0.3, -0.3], 0xffffff, 0.5, true)

s2 = make_point(s2_objects, 1, 0xffffff, 0.2, 90)

r2_texture = new (THREE.Texture)(r2_canvas)
r2_texture.needsUpdate = true
r2 = new (THREE.Mesh)(
  new (THREE.PlaneGeometry)(2, 2),
  new (THREE.MeshBasicMaterial)((
        color: 0xffffff
        side: THREE.DoubleSide
        map: r2_texture
        transparent: true)))
r2.position.z = 1

r2_ = new (THREE.Mesh)(
  new (THREE.PlaneGeometry)(2, 2),
  new (THREE.MeshBasicMaterial)((
        side: THREE.DoubleSide
        map: r2_texture
        transparent: true)))

transform = (new (THREE.Matrix4)).set(2, 0, 0, 1,
                                      0, 1, 0, 1,
                                      0, 0, 1, 1,
                                      0, 0, 0, 1)
r2_.applyMatrix(transform)
r2_.position.z = 2

scene.add r2
# scene.add r2_
scene.add obj for obj in root_objects
canvas_draw(r2_context, obj) for obj in r2_objects
# scene.add obj for obj in s2_objects
scene.add new (THREE.AmbientLight)(0x404040)
scene.add new (THREE.HemisphereLight)(0xffffff, 0x404040, 1)

# place camera and render

controls = new (THREE.OrbitControls)(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.1

camera.position.z = 2
theta = -PI * 3/4
camera.position.y = 3 * Math.sin theta
camera.position.x = 3 * Math.cos theta

render = ->
  requestAnimationFrame render
  renderer.render scene, camera
  controls.update()

render()
