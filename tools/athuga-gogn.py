#!/usr/bin/env python3
"""
Athugar gagnaskrárnar data/baeir*.js og myndirnar í Myndir/Baeir/.

Keyrsla (úr verkefnismöppunni):   python tools/athuga-gogn.py

Villur (VILLA) þarf að laga áður en nokkuð fer á vefinn.
Ábendingar (ATH) eru til umhugsunar en stöðva ekkert.
"""
import json
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
IMG_ROOT = os.path.join(ROOT, "Myndir", "Baeir")

LANDSHLUTAR = [
    "Höfuðborgarsvæðið", "Suðurnes", "Vesturland", "Vestfirðir",
    "Norðurland vestra", "Norðurland eystra", "Austurland", "Suðurland",
]
FARM_KEYS = {"id", "nafn", "landshluti", "svaedi", "lat", "lng", "lysing", "sida", "myndir"}
FARM_REQUIRED = ["id", "nafn", "landshluti", "lat", "lng", "myndir"]
IMG_KEYS = {"src", "texti", "heimild"}
ID_RX = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SRC_RX = re.compile(r"^[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|png|webp)$")
MAX_KB, MAX_PX = 400, 1600

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


WRAP_RX = re.compile(r"window\.BAEIR\s*=\s*\(\s*window\.BAEIR\s*\|\|\s*\[\]\s*\)\s*\.concat\(\s*(\[.*\])\s*\)\s*;?\s*$", re.S)


def load_file(path):
    name = os.path.basename(path)
    with open(path, encoding="utf-8") as f:
        text = f.read()
    # fjarlægja athugasemdalínur (//) efst en halda línunúmerum
    clean = "\n".join("" if ln.lstrip().startswith("//") else ln for ln in text.split("\n"))
    m = WRAP_RX.search(clean)
    if not m:
        print(f"VILLA í {name}: umbúðirnar vantar eða hafa breyst.")
        print("Skráin á að byrja á línunni  window.BAEIR = (window.BAEIR || []).concat([  og enda á  ]);")
        sys.exit(1)
    body = m.group(1)
    first_line = clean.count("\n", 0, m.start(1))
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        lineno = e.lineno + first_line
        lines = text.split("\n")
        print(f"VILLA í {name}: {e.msg} (lína {lineno}, dálkur {e.colno})")
        for n in range(max(1, lineno - 2), min(len(lines), lineno) + 1):
            print(f"  {n:5d} | {lines[n-1]}")
        print(f"        | {' ' * (e.colno - 1)}^ hér")
        print("Villan bendir oft á línuna EFTIR þar sem kommu vantar – skoðaðu enda línunnar á undan.")
        print("Algengast: komma vantar milli færslna, aukakomma á eftir síðustu færslu eða síðasta myndinni,")
        print("eða gæsalappir (\") inni í texta. Notaðu frekar „svona“ gæsalappir í texta.")
        sys.exit(1)


def load():
    files = sorted(f for f in os.listdir(DATA_DIR) if re.match(r"^baeir.*\.js$", f)) if os.path.isdir(DATA_DIR) else []
    if not files:
        print("VILLA: engin gagnaskrá (data/baeir.js) fannst")
        sys.exit(1)
    data = []
    for f in files:
        part = load_file(os.path.join(DATA_DIR, f))
        if not isinstance(part, list):
            print(f"VILLA í {f}: á að vera listi [ ... ] af bæjum")
            sys.exit(1)
        data.extend(part)
    return data, files


def image_size(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def check_farm(i, farm, seen_ids):
    where = f"færsla {i + 1}"
    if not isinstance(farm, dict):
        err(f"{where}: á að vera {{ ... }}")
        return
    name = farm.get("nafn") or farm.get("id") or where
    where = f"{name} ({where})"

    for k in FARM_REQUIRED:
        if k not in farm:
            err(f"{where}: vantar reitinn „{k}“")
    for k in farm:
        if k not in FARM_KEYS:
            warn(f"{where}: óþekktur reitur „{k}“ (ritvilla?) – verður hunsaður")

    fid = farm.get("id")
    if isinstance(fid, str):
        if not ID_RX.match(fid):
            err(f"{where}: auðkennið „{fid}“ á að vera lágstafir, tölustafir og bandstrik, án íslenskra stafa (t.d. „glaumbaer“)")
        if fid in seen_ids:
            err(f"{where}: auðkennið „{fid}“ er notað tvisvar (áður í færslu {seen_ids[fid] + 1})")
        seen_ids[fid] = i
    elif "id" in farm:
        err(f"{where}: „id“ á að vera texti")

    if isinstance(farm.get("nafn"), str):
        if not farm["nafn"].strip():
            err(f"{where}: „nafn“ er tómt")
    elif "nafn" in farm:
        err(f"{where}: „nafn“ á að vera texti")

    if "svaedi" in farm and not isinstance(farm["svaedi"], str):
        err(f"{where}: „svaedi“ á að vera texti")

    lh = farm.get("landshluti")
    if lh is not None and lh not in LANDSHLUTAR:
        err(f"{where}: landshlutinn „{lh}“ er ekki á listanum. Leyfilegt: {', '.join(LANDSHLUTAR)}")

    lat, lng = farm.get("lat"), farm.get("lng")
    if lat is not None and lng is not None:
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (lat, lng)):
            err(f"{where}: „lat“ og „lng“ eiga að vera tölur án gæsalappa (t.d. 65.6038)")
        elif 63 <= lng <= 67 and -25 <= lat <= -13:
            err(f"{where}: hnitin virðast víxluð – „lat“ (breiddargráða) á að vera um 63–67 og „lng“ um -25 til -13")
        elif not (63.0 <= lat <= 67.0 and -25.0 <= lng <= -13.0):
            err(f"{where}: hnitin ({lat}, {lng}) eru utan Íslands")

    sida = farm.get("sida")
    if sida and not os.path.exists(os.path.join(ROOT, sida)):
        err(f"{where}: „sida“ vísar á skrá sem finnst ekki: {sida}")

    imgs = farm.get("myndir")
    if not isinstance(imgs, list):
        if "myndir" in farm:
            err(f"{where}: „myndir“ á að vera listi [ ... ]")
        return
    if not imgs:
        warn(f"{name}: engar myndir ennþá")
    folder = os.path.join(IMG_ROOT, fid) if isinstance(fid, str) else None
    present = set(os.listdir(folder)) if folder and os.path.isdir(folder) else set()
    if imgs and folder and not os.path.isdir(folder):
        err(f"{name}: myndamappan Myndir/Baeir/{fid}/ finnst ekki")
    referenced = set()
    for j, im in enumerate(imgs):
        iw = f"{name}, mynd {j + 1}"
        if not isinstance(im, dict):
            err(f"{iw}: á að vera {{ \"src\": ..., \"texti\": ... }}")
            continue
        for k in im:
            if k not in IMG_KEYS:
                warn(f"{iw}: óþekktur reitur „{k}“ – verður hunsaður")
        src = im.get("src")
        if not isinstance(src, str) or not src:
            err(f"{iw}: vantar „src“ (skráarnafn)")
            continue
        referenced.add(src)
        if not SRC_RX.match(src):
            err(f"{iw}: skráarnafnið „{src}“ á að vera lágstafir án íslenskra stafa og bila (t.d. „{fid}-1.jpg“)")
        if folder and os.path.isdir(folder) and src not in present:
            near = [p for p in present if p.lower() == src.lower()]
            hint = f" – í möppunni heitir hún „{near[0]}“ (hástafir/lágstafir skipta máli á vefnum)" if near else ""
            err(f"{iw}: myndin Myndir/Baeir/{fid}/{src} finnst ekki{hint}")
        elif folder and src in present:
            p = os.path.join(folder, src)
            kb = os.path.getsize(p) // 1024
            sz = image_size(p)
            if kb > MAX_KB or (sz and max(sz) > MAX_PX):
                dim = f"{sz[0]}x{sz[1]} px, " if sz else ""
                warn(f"{iw}: {src} er stór ({dim}{kb} KB) – ráðlagt hámark er {MAX_PX} px og um {MAX_KB} KB")
        if "texti" in im and not isinstance(im["texti"], str):
            err(f"{iw}: „texti“ á að vera texti")
    for extra in sorted(present - referenced):
        if not extra.startswith("."):
            warn(f"{name}: skráin Myndir/Baeir/{fid}/{extra} er ekki notuð í gagnaskránni")


def main():
    data, files = load()
    seen = {}
    for i, farm in enumerate(data):
        check_farm(i, farm, seen)
    if os.path.isdir(IMG_ROOT):
        ids = set(seen)
        for d in sorted(os.listdir(IMG_ROOT)):
            if os.path.isdir(os.path.join(IMG_ROOT, d)) and d not in ids:
                warn(f"myndamappan Myndir/Baeir/{d}/ á sér enga færslu í gagnaskránni")

    n_img = sum(len(f.get("myndir", [])) for f in data if isinstance(f, dict) and isinstance(f.get("myndir"), list))
    print(f"Athugaði {len(data)} bæi og {n_img} myndir (skrár: {', '.join(files)}).\n")
    for w in warnings:
        print(f"  ATH:   {w}")
    for e in errors:
        print(f"  VILLA: {e}")
    print()
    if errors:
        print(f"{len(errors)} villa/villur og {len(warnings)} ábending(ar). Lagaðu villurnar áður en þetta fer á vefinn.")
        sys.exit(1)
    print(f"Engar villur. {len(warnings)} ábending(ar).")


if __name__ == "__main__":
    main()
