#!/usr/bin/env python3
"""
Generate data/media/objects/stadiums/dugout.ase — the two technical-area dugouts
(one per team) that stand just off the touchline: a raised floor, a row of
seats, a back wall and a roof.

The engine's ASE loader (src/loaders/aseloader.cpp) needs, per GEOMOBJECT:
NODE_TM, MESH_NUMVERTEX/FACES, MESH_VERTEX_LIST, MESH_FACE_LIST,
MESH_NUMTVERTEX + MESH_TVERTLIST, MESH_NUMTVFACES + MESH_TFACELIST and
MESH_NORMALS. Vertices are in WORLD space (goals.ase does the same — its node
TM is not applied), so the whole thing is written out where it stands.

  python3 tools/gen_dugout_ase.py
"""
import re
from pathlib import Path

# pitch: x = -55..55 (length), y = -36..36 (width), z up
PITCH_HALF_H = 36.0
DUGOUT_Y = -39.6          # behind the touchline, on the camera side
SEATS = 8

MATS = [
    ("dugout_frame", "media/objects/stadiums/test/floor01wall.png"),
    ("dugout_seats", "media/objects/stadiums/test/seat01.png"),
]


def box(cx, cy, cz, sx, sy, sz):
    """Axis-aligned box -> (8 verts, 12 triangles) as (verts, faces)."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz),
         (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
         (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz),
         (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz)]
    f = [(0, 2, 1), (0, 3, 2),        # bottom
         (4, 5, 6), (4, 6, 7),        # top
         (0, 1, 5), (0, 5, 4),        # -y
         (2, 3, 7), (2, 7, 6),        # +y
         (1, 2, 6), (1, 6, 5),        # +x
         (3, 0, 4), (3, 4, 7)]        # -x
    return v, f


def normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
    ln = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1.0
    return nx / ln, ny / ln, nz / ln


class Mesh:
    def __init__(self):
        self.v, self.f = [], []

    def add_box(self, *a):
        base = len(self.v)
        v, f = box(*a)
        self.v += v
        self.f += [(base + x, base + y, base + z) for x, y, z in f]


def dugout(frame: Mesh, seats: Mesh, cx: float, mirror: bool):
    """One shelter centred on cx. `mirror` faces it back towards the halfway line."""
    w, d = 10.0, 3.2                      # width along x, depth along y
    y = DUGOUT_Y
    frame.add_box(cx, y, 0.12, w, d, 0.24)                    # floor
    frame.add_box(cx, y - d / 2 + 0.1, 1.35, w, 0.2, 2.3)     # back wall
    frame.add_box(cx, y, 2.65, w + 0.5, d + 0.6, 0.22)        # roof
    for sx in (cx - w / 2 + 0.12, cx + w / 2 - 0.12):         # side panels
        frame.add_box(sx, y, 1.35, 0.24, d, 2.3)
    # a row of seats facing the pitch
    step = (w - 1.6) / (SEATS - 1)
    for i in range(SEATS):
        x = cx - (w - 1.6) / 2 + i * step
        seats.add_box(x, y + 0.35, 0.55, 0.86, 0.8, 0.42)     # cushion
        seats.add_box(x, y + 0.0, 1.0, 0.86, 0.14, 0.62)      # backrest
    _ = mirror


def geomobject(name, mesh, matref):
    out = []
    out.append("*GEOMOBJECT {")
    out.append('\t*NODE_NAME "%s"' % name)
    out.append("\t*NODE_TM {")
    out.append('\t\t*NODE_NAME "%s"' % name)
    out.append("\t\t*INHERIT_POS 0 0 0")
    out.append("\t\t*INHERIT_ROT 0 0 0")
    out.append("\t\t*INHERIT_SCL 0 0 0")
    out.append("\t\t*TM_ROW0 1.0000\t0.0000\t0.0000")
    out.append("\t\t*TM_ROW1 0.0000\t1.0000\t0.0000")
    out.append("\t\t*TM_ROW2 0.0000\t0.0000\t1.0000")
    out.append("\t\t*TM_ROW3 0.0000\t0.0000\t0.0000")
    out.append("\t\t*TM_POS 0.0000\t0.0000\t0.0000")
    out.append("\t\t*TM_ROTAXIS 0.0000\t0.0000\t1.0000")
    out.append("\t\t*TM_ROTANGLE 0.0000")
    out.append("\t\t*TM_SCALE 1.0000\t1.0000\t1.0000")
    out.append("\t\t*TM_SCALEAXIS 0.0000\t0.0000\t0.0000")
    out.append("\t\t*TM_SCALEAXISANG 0.0000")
    out.append("\t}")
    out.append("\t*MESH {")
    out.append("\t\t*TIMEVALUE 0")
    out.append("\t\t*MESH_NUMVERTEX %i" % len(mesh.v))
    out.append("\t\t*MESH_NUMFACES %i" % len(mesh.f))
    out.append("\t\t*MESH_VERTEX_LIST {")
    for i, (x, y, z) in enumerate(mesh.v):
        out.append("\t\t\t*MESH_VERTEX %4i\t%.4f\t%.4f\t%.4f" % (i, x, y, z))
    out.append("\t\t}")
    out.append("\t\t*MESH_FACE_LIST {")
    for i, (a, b, c) in enumerate(mesh.f):
        out.append("\t\t\t*MESH_FACE %4i:    A: %4i B: %4i C: %4i AB:    1 BC:    1 CA:    1"
                   "\t *MESH_SMOOTHING 1 \t*MESH_MTLID 0" % (i, a, b, c))
    out.append("\t\t}")
    # one UV quad per box face keeps the seat texture readable
    out.append("\t\t*MESH_NUMTVERTEX 4")
    out.append("\t\t*MESH_TVERTLIST {")
    for i, (u, v) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        out.append("\t\t\t*MESH_TVERT %i\t%.4f\t%.4f\t0.0000" % (i, u, v))
    out.append("\t\t}")
    out.append("\t\t*MESH_NUMTVFACES %i" % len(mesh.f))
    out.append("\t\t*MESH_TFACELIST {")
    for i in range(len(mesh.f)):
        a, b, c = (0, 1, 2) if i % 2 == 0 else (0, 2, 3)
        out.append("\t\t\t*MESH_TFACE %i\t%i\t%i\t%i" % (i, a, b, c))
    out.append("\t\t}")
    out.append("\t\t*MESH_NUMCVERTEX 0")
    out.append("\t\t*MESH_NORMALS {")
    for i, (a, b, c) in enumerate(mesh.f):
        nx, ny, nz = normal(mesh.v[a], mesh.v[b], mesh.v[c])
        out.append("\t\t\t*MESH_FACENORMAL %i\t%.4f\t%.4f\t%.4f" % (i, nx, ny, nz))
        for idx in (a, b, c):
            out.append("\t\t\t\t*MESH_VERTEXNORMAL %i\t%.4f\t%.4f\t%.4f" % (idx, nx, ny, nz))
    out.append("\t\t}")
    out.append("\t}")
    out.append("\t*PROP_MOTIONBLUR 0")
    out.append("\t*PROP_CASTSHADOW 1")
    out.append("\t*PROP_RECVSHADOW 1")
    out.append("\t*MATERIAL_REF %i" % matref)
    out.append("}")
    return "\n".join(out)


def material(i, name, bitmap):
    return "\n".join([
        "\t*MATERIAL %i {" % i,
        '\t\t*MATERIAL_NAME "%s"' % name,
        '\t\t*MATERIAL_CLASS "Standard"',
        "\t\t*MATERIAL_AMBIENT 0.5882\t0.5882\t0.5882",
        "\t\t*MATERIAL_DIFFUSE 0.5882\t0.5882\t0.5882",
        "\t\t*MATERIAL_SPECULAR 0.9000\t0.9000\t0.9000",
        "\t\t*MATERIAL_SHINE 0.2000",
        "\t\t*MATERIAL_SHINESTRENGTH 0.1000",
        "\t\t*MATERIAL_TRANSPARENCY 0.0000",
        "\t\t*MATERIAL_WIRESIZE 1.0000",
        "\t\t*MATERIAL_SHADING Blinn",
        "\t\t*MATERIAL_XP_FALLOFF 0.0000",
        "\t\t*MATERIAL_SELFILLUM 0.0000",
        "\t\t*MATERIAL_FALLOFF In",
        "\t\t*MATERIAL_XP_TYPE Filter",
        "\t\t*MAP_DIFFUSE {",
        '\t\t\t*MAP_NAME "Map #%i"' % (i + 1),
        '\t\t\t*MAP_CLASS "Bitmap"',
        "\t\t\t*MAP_SUBNO 1",
        "\t\t\t*MAP_AMOUNT 1.0000",
        '\t\t\t*BITMAP "%s"' % bitmap,
        "\t\t\t*MAP_TYPE Screen",
        "\t\t\t*UVW_U_OFFSET 0.0000",
        "\t\t\t*UVW_V_OFFSET 0.0000",
        "\t\t\t*UVW_U_TILING 1.0000",
        "\t\t\t*UVW_V_TILING 1.0000",
        "\t\t\t*UVW_ANGLE 0.0000",
        "\t\t\t*UVW_BLUR 1.0000",
        "\t\t\t*UVW_BLUR_OFFSET 0.0000",
        "\t\t\t*UVW_NOUSE_AMT 1.0000",
        "\t\t\t*UVW_NOISE_SIZE 1.0000",
        "\t\t\t*UVW_NOISE_LEVEL 1",
        "\t\t\t*UVW_NOISE_PHASE 0.0000",
        '\t\t\t*BITMAP_FILTER Pyramidal',
        "\t\t}",
        "\t}",
    ])


BEGIN = '*COMMENT "gpf-dugout-begin"'
END = '*COMMENT "gpf-dugout-end"'


def patch_stadium(frame, seats):
    """Append the dugouts to the stadium mesh.

    A standalone .object loads fine (the ASE parser reports 2 meshes / 5400
    floats) but never gets drawn, while everything inside test.ase does — the
    stadium is split per-geometry through SplitGeometry() in Match::Match and
    goes down that path. So rather than fight the renderer, the shelters ride
    along with the stadium. Re-running this script replaces its own block.
    """
    path = Path("data/media/objects/stadiums/test/test.ase")
    txt = path.read_text(errors="ignore")

    # drop a previous run's block
    if BEGIN in txt:
        head, rest = txt.split(BEGIN, 1)
        _, tail = rest.split(END, 1)
        txt = head + tail
        # ...and its two materials
        txt = txt.replace("\t*MATERIAL_COUNT 33\n", "\t*MATERIAL_COUNT 31\n")
        for name in ("dugout_frame", "dugout_seats"):
            i = txt.find('*MATERIAL_NAME "%s"' % name)
            if i < 0:
                continue
            start = txt.rfind("\t*MATERIAL ", 0, i)
            depth, j = 0, start
            while j < len(txt):
                if txt[j] == "{":
                    depth += 1
                elif txt[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            txt = txt[:start] + txt[j + 2:]

    count = int(re.search(r"\*MATERIAL_COUNT (\d+)", txt).group(1))
    base = count
    mats = "\n".join(material(base + i, name, bmp) for i, (name, bmp) in enumerate(MATS))

    # close of the MATERIAL_LIST block
    ml = txt.index("*MATERIAL_LIST {")
    depth, j = 0, ml
    while j < len(txt):
        if txt[j] == "{":
            depth += 1
        elif txt[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    txt = (txt[:j] + mats + "\n" + txt[j:]).replace(
        "*MATERIAL_COUNT %i" % count, "*MATERIAL_COUNT %i" % (count + len(MATS)), 1)

    block = "\n".join([BEGIN,
                       geomobject("gpf_dugout_frame", frame, base + 0),
                       geomobject("gpf_dugout_seats", seats, base + 1),
                       END])
    path.write_text(txt.rstrip("\n") + "\n" + block + "\n")
    print("%s: +%i faces (frame) +%i faces (seats), materials %i/%i"
          % (path, len(frame.f), len(seats.f), base, base + 1))


def main():
    frame, seats = Mesh(), Mesh()
    dugout(frame, seats, -12.0, False)   # home team, left of the halfway line
    dugout(frame, seats, +12.0, True)    # away team, right of it
    patch_stadium(frame, seats)


if __name__ == "__main__":
    main()
