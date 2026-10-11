import trimesh
import numpy as np

# Increase resolution for a detailed shape
# Subdivisions 5 = ~10k vertices. 
mesh = trimesh.creation.icosphere(subdivisions=5, radius=1.0)
v = mesh.vertices

# Deform a perfect sphere into a heart shape
# 1. Elongate along Z (apex pointing down, base up)
v[:, 2] *= 1.4

# 2. Apex (bottom tip): taper the bottom
z_mask = v[:, 2] < 0
v[z_mask, 0] *= 1.0 - (np.abs(v[z_mask, 2]) / 2.0)
v[z_mask, 1] *= 1.0 - (np.abs(v[z_mask, 2]) / 2.0)

# 3. Curve the apex slightly to the left (anatomical left)
v[:, 0] += (np.exp([-z for z in v[:, 2]]) * 0.1)

# 4. Atria & vessel bulbs (top)
top_mask = v[:, 2] > 0.5
v[top_mask, 0] *= 1.0 + np.sin(v[top_mask, 2] * np.pi) * 0.2
v[top_mask, 1] *= 1.0 + np.cos(v[top_mask, 2] * np.pi) * 0.2

# 5. Interventricular sulcus (groove on front where LAD runs)
# A groove angling from top-left to bottom-right
sulcus = np.abs(v[:, 0] + v[:, 1]*0.5 - 0.2)
sulcus_mask = (v[:, 1] > 0) & (sulcus < 0.3)
v[sulcus_mask, 1] -= (0.3 - sulcus[sulcus_mask]) * 0.5 * (1 - np.abs(v[sulcus_mask, 2]/1.5))

# 6. Add some organic lumps/noise
noise = np.sin(v[:, 0]*15) * np.cos(v[:, 1]*15) * np.sin(v[:, 2]*10) * 0.02
v += v / np.linalg.norm(v, axis=1)[:, None] * noise[:, None]

# Scale up
v *= 3.0
mesh.vertices = v
trimesh.smoothing.filter_laplacian(mesh, iterations=8)
mesh.metadata['name'] = 'Heart'

# Coronaries - using path sweeps instead of straight cylinders so they wrap the surface!
def generate_vessel(points, radius, name):
    # points: list of [x, y, z]
    # We will interpolate points and create a tube
    from trimesh.creation import sweep_polygon
    import trimesh.path
    
    
    # create a circular cross section
    
    # create a 3D path
    path = trimesh.path.Path3D(entities=[trimesh.path.entities.Line(np.arange(len(points)))], vertices=points)
    # sweep magic... Wait, trimesh doesn't natively do easy tubing along 3D splines in one line.
    # Alternative: construct a polyline and use spheres/cylinders between points.
    
    vessels = []
    for i in range(len(points) - 1):
        p1 = np.array(points[i])
        p2 = np.array(points[i+1])
        c = trimesh.creation.cylinder(radius=radius, segment=[p1, p2], sections=10)
        vessels.append(c)
        s = trimesh.creation.icosphere(subdivisions=2, radius=radius)
        s.apply_translation(p1)
        vessels.append(s)
    
    vessel_mesh = trimesh.util.concatenate(vessels)
    vessel_mesh.metadata['name'] = name
    return vessel_mesh

# LAD: runs down the anterior sulcus
lad_points = []
for z in np.linspace(2.5, -2.5, 20):
    # find front edge x, y
    x = -0.2 - z*0.1
    y = 2.0 - abs(z)*0.2
    # project onto mesh surface
    ray_origin = [x, 5.0, z]
    # raycast ... too complex, let's just approximate the wrapper curve
    y = np.sqrt(max(0, 9 - x**2 - z**2)) * 0.95
    lad_points.append([x, y, z])

lad = generate_vessel(lad_points, 0.12, "LAD_Vessel")

# LCX: wraps around the left side
lcx_points = []
for theta in np.linspace(0, np.pi, 20):
    x = np.cos(theta) * 2.8 - 0.5
    y = np.sin(theta) * 2.8
    z = 1.0 - theta * 0.2
    lcx_points.append([x, y, z])

lcx = generate_vessel(lcx_points, 0.1, "LCX_Vessel")

# RCA: wraps around the right side
rca_points = []
for theta in np.linspace(0, -np.pi*0.8, 20):
    x = np.cos(theta) * 2.8 + 0.5
    y = np.sin(theta) * 2.8
    z = 1.0 + theta * 0.15
    rca_points.append([x, y, z])

rca = generate_vessel(rca_points, 0.12, "RCA_Vessel")

scene = trimesh.Scene({
    'Heart_Body': mesh,
    'LAD_Vessel': lad, 
    'LCX_Vessel': lcx,
    'RCA_Vessel': rca
})
scene.export('artifacts/coronarylens-3d/public/models/coronary-heart.glb')
print("Generated advanced heart.")

