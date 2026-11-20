import bpy, re, bmesh
bpy.ops.wm.open_mainfile(filepath='/tmp/claude-0/za/Z-Anatomy/Startup.blend')
G = {
 'chest': ['Sternocostal head of pectoralis major muscle','Clavicular head of pectoralis major muscle','(Abdominal part of pectoralis major muscle)'],
 'frontDelts': ['Clavicular part of deltoid muscle'],
 'sideDelts': ['Acromial part of deltoid muscle'],
 'rearDelts': ['Scapular spinal part of deltoid muscle'],
 'traps': ['Descending part of trapezius muscle','Transverse part of trapezius muscle','Ascending part of trapezius muscle'],
 'lats': ['Latissimus dorsi muscle'],
 'upperBack': ['Rhomboid major muscle','Rhomboid minor muscle','Infraspinatus muscle','Teres major muscle','Teres minor muscle'],
 'lowerBack': ['Iliocostalis lumborum muscle','Iliocostalis thoracis muscle','Longissimus thoracis muscle','Spinalis thoracis muscle'],
 'biceps': ['Long head of biceps brachii','Short head of biceps brachii','Brachialis muscle'],
 'triceps': ['Lateral head of triceps brachii','Long head of triceps brachii','Medial head of triceps brachii','Anconeus muscle'],
 'forearms': ['Brachioradialis muscle','Flexor carpi radialis','Palmaris longus muscle','Humeral head of flexor carpi ulnaris','Ulnar head of flexor carpi ulnaris','Extensor carpi radialis longus','Extensor carpi radialis brevis','Extensor digitorum','Extensor digiti minimi','Humeral head of extensor carpi ulnaris','Ulnar head of extensor carpi ulnaris','Superficial head of pronator teres','Humero-ulnar head of flexor digitorum superficialis','Radial head of flexor digitorum superficialis','Abductor pollicis longus'],
 'abs': ['Rectus abdominis muscle'],
 'obliques': ['External abdominal oblique muscle','Serratus anterior muscle'],
 'glutes': ['Gluteus maximus muscle','Gluteus medius muscle'],
 'quads': ['Rectus femoris muscle','Vastus lateralis muscle','Vastus medialis muscle'],
 'hamstrings': ['Long head of biceps femoris','Short head of biceps femoris','Semitendinosus muscle','Semimembranosus muscle'],
 'adductors': ['Adductor longus','Adductor magnus','Adductor brevis','Gracilis muscle','Pectineus muscle'],
 'calves': ['Lateral head of gastrocnemius','Medial head of gastrocnemius','Soleus muscle'],
 'body': ['Sternocleidomastoid muscle','Sartorius muscle','Tensor fasciae latae','Tibialis anterior muscle','Fibularis longus muscle','Fibularis brevis muscle','Extensor digitorum longus','Splenius capitis muscle','Levator scapulae','Omohyoid muscle','Plantaris muscle'],
}
BONE_RE = re.compile(r'^(.*phalanx of .*|.*metacarpal bone|.*metatarsal bone|scaphoid|lunate|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate|calcaneus|talus|navicular|cuboid bone|.*cuneiform|patella|clavicle|tibia|fibula|ulna|radius)\.[lr]$', re.I)
HEAD_RE = re.compile(r'^(frontal bone|parietal bone(\.[lr])?|occipital bone|temporal bone\.[lr]|mandible|maxilla\.[lr]|zygomatic bone\.[lr])$', re.I)
TARGET = {'body': 22000, 'bones': 18000, 'forearms': 9000, 'lowerBack': 5000, 'obliques': 7000}
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and len(o.data.vertices) > 10]
def base(n): return re.sub(r'\.[lr]$', '', n)
byname = {}
for o in meshes:
    if o.name.endswith(('.l', '.r')): byname.setdefault(base(o.name), []).append(o)
skel = set(bpy.data.collections['1: Skeletal system'].all_objects) | set(bpy.data.collections['Bonus collection'].all_objects)
G['bones'] = None
meshes_all = meshes
dg = bpy.context.evaluated_depsgraph_get()
scene = bpy.context.scene
newcol = bpy.data.collections.new('EXPORT'); scene.collection.children.link(newcol)
for g, names in G.items():
    objs = []
    if names is None:
        seen=set()
        for o in meshes:
            if BONE_RE.search(o.name) and o.name.endswith(('.l','.r','')):
                if o in skel: objs.append(o); seen.add(o.data.name)
    else:
        for n in names:
            found = byname.get(n, [])
            if not found: print('MISSING', g, n)
            objs += found
    if names is None: print('BONES', sorted(o.name for o in objs))
    total = sum(sum(len(p.vertices)-2 for p in o.evaluated_get(dg).data.polygons) for o in objs) or 1
    budget = TARGET.get(g, 5000)
    ratio = min(1.0, budget / total)
    bm = bmesh.new()
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh().copy()
        ev.to_mesh_clear()
        me.transform(o.matrix_world)
        tmp = bpy.data.objects.new('tmp', me); newcol.objects.link(tmp)
        if ratio < 1:
            d = tmp.modifiers.new('d', 'DECIMATE'); d.ratio = max(ratio, min(1.0, 250 / max(1, len(me.polygons))))
        me2 = tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh().copy()
        bpy.data.objects.remove(tmp)
        if g == 'obliques' and o.name.startswith('External'):
            b2 = bmesh.new(); b2.from_mesh(me2)
            kill = [f for f in b2.faces if all(abs(v.co.x) < 0.085 for v in f.verts)]
            bmesh.ops.delete(b2, geom=kill, context='FACES'); b2.to_mesh(me2); b2.free()
        bm.from_mesh(me2)
    me = bpy.data.meshes.new(g); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(g, me); newcol.objects.link(ob)
    print(g, len(objs), 'objs', total, '->', sum(len(p.vertices)-2 for p in me.polygons))
from mathutils import Vector
hb = [o for o in meshes if HEAD_RE.match(o.name)]
pts = [o.matrix_world @ Vector(c) for o in hb for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print('HEAD', len(hb), lo, hi)
bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=(lo+hi)/2)
hd = bpy.context.active_object; hd.name = 'head'; hd.scale = ((hi.x-lo.x)/2*1.08, (hi.y-lo.y)/2*1.05, (hi.z-lo.z)/2*1.02)
for c in hd.users_collection: c.objects.unlink(hd)
newcol.objects.link(hd)
# keep only export collection
for o in list(bpy.data.objects):
    if o.users_collection and newcol not in o.users_collection:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath='/tmp/claude-0/za/body.glb', export_format='GLB', use_selection=False, export_apply=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_normals=True, export_materials='NONE', export_texcoords=False)
print('done')
