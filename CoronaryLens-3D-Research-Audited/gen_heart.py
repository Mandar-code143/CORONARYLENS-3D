import trimesh
import numpy as np

main_body = trimesh.creation.icosphere(subdivisions=4, radius=3.0)
for i, v in enumerate(main_body.vertices):
    main_body.vertices[i][1] *= 1.2
    if main_body.vertices[i][1] < 0:
        main_body.vertices[i][0] *= 0.8
        main_body.vertices[i][2] *= 0.8

lad = trimesh.creation.cylinder(radius=0.15, height=4.0, sections=12)
lad.apply_translation([1.5, 0, 1.5])

lcx = trimesh.creation.cylinder(radius=0.12, height=3.5, sections=12)
lcx.apply_translation([-1.0, 1, 1.0])
lcx.apply_transform(trimesh.transformations.rotation_matrix(np.pi/4, [0, 1, 0]))

rca = trimesh.creation.cylinder(radius=0.15, height=3.2, sections=12)
rca.apply_translation([-1.5, -0.5, -1.0])
rca.apply_transform(trimesh.transformations.rotation_matrix(-np.pi/4, [1, 0, 0]))

# Trimesh export to GLB with names. In GLTF, node names matter.
# We must create a GLTF tree structure. Trimesh handles scene node names via node names in the scene graph.
scene = trimesh.Scene({
    'Heart_Body': main_body,
    'LAD_Vessel': lad, 
    'LCX_Vessel': lcx,
    'RCA_Vessel': rca
})

scene.export('artifacts/coronarylens-3d/public/models/coronary-heart.glb')
