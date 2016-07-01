# Utility canvas functions
ctx_coords = (xy, f) ->
  [x, y] = if xy instanceof THREE.Vector3 or xy instanceof THREE.Vector2 \
    then [xy.x, xy.y] else xy
  f(r2_resolution / 2 * (x + 1), r2_resolution / 2 * (1 - y))

ctx_color = (c) ->
  if not (c instanceof String || typeof c == "string")
    c = c.toString(16)
  return '#' + ('000000'+c).substring(c.length);

canvas_line = (p1, p2, color, width, collection=[]) ->
  color = ctx_color(color)
  c = ctx_coords(p1, (x, y) -> 
    (new (createjs.Shape)()).set(x: x, y: y))
  ctx_coords(p1, (x1, y1) ->
    ctx_coords(p2, (x2, y2) ->
      c.graphics.beginStroke(color).setStrokeStyle(width)
                .moveTo(0, 0).lineTo(x2 - x1, y2 - y1)))
  return add_to(collection, c)

# Utility geometry functions
PI = Math.PI

vec2 = (x, y) -> new (THREE.Vector2)(x, y)
vec3 = (x, y, z) -> new (THREE.Vector3)(x, y, z)
array2_from_vec3 = (v) -> return (if v instanceof THREE.Vector3 then [v.x / v.z, v.y / v.z, 1] else v)
vec3_from_array = (p) ->
    return (if p instanceof THREE.Vector3 then p else vec3(p[0], p[1], if p.length > 2 then p[2] else 1))
vec2_from_array = (p) ->
    return (if p instanceof THREE.Vector2 then p else vec2(p[0], p[1]))

# Collections of entitites
add_to = (c, o) ->
  c.push(o)
  return o

r2_points = []
s2_points = []
r3_points = []
root_objects = []

extend = (v1, v2, length=camera_far) ->
    v1_orig = v1.clone()
    v1.sub(v2)
    v1.setLength(length)
    v1.add(v2)
    v2.sub(v1_orig)
    v2.setLength(length)
    v2.add(v1_orig)
    return [v1, v2]

# Drawing 3D entities
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

make_line = (collection, here, there, color, width=1, extend_vectors=true) ->
  # get vectors and extend the line's length to 2 * camera_far
  v1 = vec3_from_array(here)
  v2 = vec3_from_array(there)
  if extend_vectors
    [v1, v2] = extend(v1, v2)

  geometry = new (THREE.Geometry)
  geometry.vertices.push(v1, v2)
  return add_to(collection, new (THREE.Line)(geometry,
    new (THREE.LineBasicMaterial)((color: color, linewidth: width))))

make_p_point = (p, color) ->
  p = vec2_from_array p

  # Draw dot on canvas
  c = add_to(r2_points, ctx_coords(p, (x, y) -> (new (createjs.Shape)()).set(x: x, y: y)))
  c.graphics.beginFill(ctx_color(color)).drawCircle(0, 0, 4)

  o1 = make_line(r3_points, [-p.x, -p.y, -1], [p.x, p.y, 1], color)

  o2 = make_point(s2_points, 0.015, color)
  o2.position.copy(vec3(p.x, p.y, 1).normalize())
  o3 = make_point(s2_points, 0.015, color)
  o3.position.copy(vec3(-p.x, -p.y, -1).normalize())

  return (
    r2: [c]
    s2: [o2, o3]
    r3: [o1])

make_p_line = (p1, p2, color, opacity=1.0, draw_points=false) ->
  [p1, p2] = [vec2_from_array(p1), vec2_from_array(p2)]
  # Draw line on canvas
  c = canvas_line(p1, p2, color, 3, r2_points)

  _p1 = _p2 = []
  if draw_points
    _p1 = make_p_point(p1, color)
    _p2 = make_p_point(p2, color)

  # Rotate plane so that it lies along on the line from p1 to p2
  o = make_plane(r3_points, 3, color, opacity)
  v1 = vec3(p1.x, p1.y, 1)
  v2 = vec3(p2.x, p2.y, 1)
  v1.cross(v2)
  v1.normalize()
  angle = v1.angleTo(vec3(0,0,1))
  o.rotation.setFromQuaternion new
    (THREE.Quaternion)().setFromUnitVectors(vec3(0, 0, 1), v1)

  return (
    r2: _p1.r2.concat(_p2.r2).concat(c)
    s2: _p1.s2.concat(_p2.s2)
    r3: _p1.r3.concat(_p2.r3).concat([o]))

