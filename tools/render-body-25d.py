import bpy, sys, math
from mathutils import Vector
OUT = '/tmp/claude-0/r25/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/za/body-real.glb')
real = {o.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/za/body-lowpoly.glb')
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH' and o not in real.values():
        if o.name.startswith('body'): o.name = 'shell'
        else: bpy.data.objects.remove(o, do_unlink=True)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
names = sorted(o.name for o in objs)
print('OBJS', names)
GROUPS = ['chest','frontDelts','sideDelts','rearDelts','traps','lats','upperBack','lowerBack','biceps','triceps','forearms','abs','obliques','glutes','quads','hamstrings','adductors','calves']
# id colours: group i -> (i+1)*12 in red channel; neutral parts -> 250
pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (lo + hi) / 2; H = (hi.z - lo.z) * 1.04; W = (hi.x - lo.x) * 1.04
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
PX = 1400
sc.render.resolution_y = PX; sc.render.resolution_x = int(PX * W / H) // 2 * 2
sc.render.image_settings.file_format = 'PNG'
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = H
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
print('FRAME', sc.render.resolution_x, sc.render.resolution_y, tuple(lo), tuple(hi))

def emit(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*rgb, 1); e.inputs[1].default_value = 1
    o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0]); return m
def diffuse():
    m = bpy.data.materials.new('clay'); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1); b.inputs['Roughness'].default_value = 0.65
    return m
def setmat(o, m):
    o.data.materials.clear(); o.data.materials.append(m)

def place(view):
    if view == 'front': cam.location = (ctr.x, lo.y - 3, ctr.z); cam.rotation_euler = (math.pi/2, 0, 0)
    else: cam.location = (ctr.x, hi.y + 3, ctr.z); cam.rotation_euler = (math.pi/2, 0, math.pi)

# ID pass (sRGB-linear exact): use Standard view and linear values
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.cycles.samples = 1; sc.cycles.pixel_filter_type = 'BOX'; sc.cycles.filter_width = 0.01
sc.cycles.use_denoising = False; sc.render.film_transparent = True
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0, 0, 0)
for o in objs:
    if o.name in GROUPS: v = (GROUPS.index(o.name) + 1) * 12
    elif o.name == 'shell': v = 250
    elif o.name == 'head': v = 240
    else: v = 230  # other muscles, bones
    setmat(o, emit('id_' + o.name, ((v / 255) ** 2.2, 0, 0)))
def both(prefix):
    for view in ('front', 'back'):
        place(view)
        for layer in ('a', 'b'):
            for o in objs: o.hide_render = o.name == 'bones' or ((o.name == 'shell') == (layer == 'a'))
            sc.render.filepath = OUT + f'{prefix}-{view}-{layer}.png'; bpy.ops.render.render(write_still=True)
both('id')

# shading pass
sc.view_settings.view_transform = 'Standard'
sc.cycles.samples = 48; sc.cycles.pixel_filter_type = 'BLACKMAN_HARRIS'; sc.cycles.filter_width = 1.5
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.film_transparent = True
sc.world.use_nodes = True; sc.world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.55
clay = diffuse()
for o in objs: setmat(o, clay)
sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 2.2; sun_d.angle = math.radians(25)
sun = bpy.data.objects.new('sun', sun_d); sc.collection.objects.link(sun)
_place = place
def place(view):
    _place(view); yaw = 0 if view == 'front' else math.pi
    sun.rotation_euler = (math.radians(50), 0, yaw + math.radians(-25))
both('shade')
print('done')
