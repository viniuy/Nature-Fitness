import bpy, re, bmesh
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath='/tmp/claude-0/za/Z-Anatomy/Startup.blend')
exec(open(__file__.rsplit('/', 1)[0] + '/body-groups.py').read())
SHELL_EXTRA = re.compile(r'^(.*phalanx of .*|.*metacarpal bone|.*metatarsal bone|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|calcaneus|talus|navicular|cuboid bone|.*cuneiform|patella|tibia|fibula|ulna|radius|clavicle|humerus|femur|hip bone|sacrum)\.[lr]$|^(sacrum|body of sternum|manubrium of sternum)$', re.I)
HEAD_RE = re.compile(r'^(frontal bone|parietal bone(\.[lr])?|occipital bone|temporal bone\.[lr]|mandible|maxilla\.[lr]|zygomatic bone\.[lr])$', re.I)
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 10]
byname = {}
for o in meshes:
    if o.name.endswith(('.l', '.r')): byname.setdefault(re.sub(r'\.[lr]$', '', o.name), []).append(o)
dg = bpy.context.evaluated_depsgraph_get()
col = bpy.data.collections.new('LP'); bpy.context.scene.collection.children.link(col)

def joined(objs, name):
    bm = bmesh.new()
    for o in objs:
        ev = o.evaluated_get(dg); me = ev.to_mesh().copy(); ev.to_mesh_clear()
        me.transform(o.matrix_world); bm.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob); return ob

def bake(ob, mods):
    for kind, kw in mods:
        m = ob.modifiers.new(kind, kind)
        for k, v in kw.items(): setattr(m, k, v)
    d = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(d))
    ob.modifiers.clear(); old = ob.data; ob.data = me; bpy.data.meshes.remove(old)

def lowpoly(ob, voxel, tris, thick=0.0, grow=0.0):
    mods = []
    if thick: mods.append(('SOLIDIFY', {'thickness': thick, 'offset': 0}))
    mods.append(('REMESH', {'mode': 'VOXEL', 'voxel_size': voxel, 'use_smooth_shade': False}))
    mods.append(('SMOOTH', {'factor': 0.6, 'iterations': 6}))
    bake(ob, mods)
    if grow:
        bake(ob, [('DISPLACE', {'strength': grow, 'mid_level': 0})])
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if n > tris: bake(ob, [('DECIMATE', {'ratio': tris / n})])
    for p in ob.data.polygons: p.use_smooth = True
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

THICK = {'lats': 0.012, 'traps': 0.012, 'obliques': 0.012, 'upperBack': 0.01, 'lowerBack': 0.01, 'chest': 0.01, 'abs': 0.01}
allmus = []
for g, names in G.items():
    objs = [o for n in names for o in byname.get(n, [])]
    allmus += objs
    if g == 'body': continue
    ob = joined(objs, g)
    print(g, lowpoly(ob, 0.008, 2400, THICK.get(g, 0.006)))
# shell: every muscle we know plus limb bones, fused and simplified
shell_objs = allmus + [o for o in meshes if SHELL_EXTRA.match(o.name)]
sh = joined(shell_objs, 'body')
print('body', lowpoly(sh, 0.014, 14000, 0.01, grow=-0.004))
hb = [o for o in meshes if HEAD_RE.match(o.name)]
pts = [o.matrix_world @ Vector(c) for o in hb for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, location=(lo + hi) / 2)
hd = bpy.context.active_object; hd.name = 'head'; bpy.ops.object.shade_smooth(); hd.scale = ((hi.x-lo.x)/2*1.05, (hi.y-lo.y)/2*1.0, (hi.z-lo.z)/2*1.0)
for c in hd.users_collection: c.objects.unlink(hd)
col.objects.link(hd)
for o in list(bpy.data.objects):
    if col not in o.users_collection: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath='/tmp/claude-0/za/body-lowpoly.glb', export_format='GLB', export_apply=True,
    export_draco_mesh_compression_enable=True, export_materials='NONE', export_texcoords=False, export_normals=True)
print('done')
