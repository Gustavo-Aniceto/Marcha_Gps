#!/usr/bin/env python3
"""
Marcha GPS — importa lombadas, valetas e radares de São Paulo, Guarulhos e Itaquaquecetuba.

Fontes:
  1. OpenStreetMap (via Overpass API): traffic_calming=* e highway=speed_camera
     dentro dos municípios de São Paulo, Guarulhos e Itaquaquecetuba.  Licença ODbL: mostre "© OpenStreetMap
     contributors" no app.
  2. (Opcional) CSV de radares da ANTT (dados.antt.gov.br, dataset "radar"),
     que cobre rodovias federais concedidas. Baixe o CSV e passe com --antt.
     Só ficam os pontos dentro das 3 cidades.

Saída: um GeoJSON pronto pra carregar no banco do app. Todo ponto entra com
status "nao_confirmado" — a comunidade confirma pelo Radar.

Uso:
  python3 scripts/import_obstacles.py                          # só OpenStreetMap
  python3 scripts/import_obstacles.py --antt radares.csv       # OSM + radares da ANTT
  python3 scripts/import_obstacles.py --sql carga.sql          # também gera SQL pra tabela reports

Precisa só da biblioteca padrão do Python 3.
"""
import argparse
import csv
import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Cidades cobertas pelo Marcha GPS (municípios, admin_level 8 no OSM).
CIDADES = ["São Paulo", "Guarulhos", "Itaquaquecetuba"]

OVERPASS_TEMPLATE = """
[out:json][timeout:180];
area["boundary"="administrative"]["admin_level"="8"]["name"="{cidade}"]->.c;
(
  node["traffic_calming"](area.c);
  way["traffic_calming"](area.c);
  node["highway"="speed_camera"](area.c);
  node["hazard"="bump"](area.c);
);
out center tags;
"""

# Caixas aproximadas de cada cidade (pra filtrar o CSV da ANTT).
# As caixas se sobrepõem um pouco na divisa; o ponto fica com a primeira que bater.
CIDADE_BBOX = {
    "Itaquaquecetuba": {"lat_min": -23.53, "lat_max": -23.40, "lon_min": -46.40, "lon_max": -46.30},
    "Guarulhos":       {"lat_min": -23.50, "lat_max": -23.29, "lon_min": -46.58, "lon_max": -46.32},
    "São Paulo":       {"lat_min": -24.01, "lat_max": -23.35, "lon_min": -46.83, "lon_max": -46.36},
}

# Como cada etiqueta do OSM vira um tipo do Bonde.
# risco_base: o quanto costuma pegar em carro baixo (0 = tranquilo, 3 = não passa).
TRAFFIC_CALMING_MAP = {
    "bump":         ("lombada", 3),
    "hump":         ("lombada", 2),
    "mini_bumps":   ("lombada", 2),
    "table":        ("faixa_elevada", 2),
    "cushion":      ("lombada", 2),
    "dip":          ("valeta", 3),
    "double_dip":   ("valeta", 3),
    "rumble_strip": ("sonorizador", 1),
    "yes":          ("lombada", 2),
}

DEDUPE_METERS = 15


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def fetch_osm(cidade):
    query = OVERPASS_TEMPLATE.replace("{cidade}", cidade)
    data = urllib.parse.urlencode({"data": query}).encode()
    req = urllib.request.Request(OVERPASS_URL, data=data,
                                 headers={"User-Agent": "MarchaGPS-import/1.0"})
    with urllib.request.urlopen(req, timeout=240) as resp:
        return json.load(resp)["elements"]


def osm_to_points(elements, cidade):
    pts = []
    for el in elements:
        tags = el.get("tags", {})
        if "lat" in el:
            lat, lon = el["lat"], el["lon"]
        elif "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        if tags.get("highway") == "speed_camera":
            tipo, risco = "radar", 0
        elif tags.get("hazard") == "bump":
            tipo, risco = "lombada", 2
        else:
            # o OSM permite vários valores separados por ";"
            vals = [v.strip() for v in tags.get("traffic_calming", "").split(";") if v.strip()]
            mapped = [TRAFFIC_CALMING_MAP[v] for v in vals if v in TRAFFIC_CALMING_MAP]
            if not mapped:
                continue  # chicane, choker, ilha etc. não importam pra altura do carro
            tipo, risco = max(mapped, key=lambda t: t[1])
        pts.append({
            "lat": lat, "lon": lon, "tipo": tipo, "risco_base": risco,
            "velocidade_max": tags.get("maxspeed"),
            "sentido": tags.get("direction"),
            "cidade": cidade,
            "fonte": "osm", "fonte_id": f"{el['type']}/{el['id']}",
        })
    return pts


def _find_col(headers, *cands):
    low = {h.lower().strip(): h for h in headers}
    for c in cands:
        for k, orig in low.items():
            if c in k:
                return orig
    return None


def _num(v):
    if v is None:
        return None
    v = str(v).strip().replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return None


def antt_to_points(path):
    pts = []
    with open(path, encoding="utf-8-sig", errors="replace") as fh:
        sample = fh.read(4096)
        fh.seek(0)
        delim = ";" if sample.count(";") > sample.count(",") else ","
        reader = csv.DictReader(fh, delimiter=delim)
        lat_c = _find_col(reader.fieldnames, "latitude", "lat")
        lon_c = _find_col(reader.fieldnames, "longitude", "lon", "long")
        vel_c = _find_col(reader.fieldnames, "velocidade", "limite")
        if not lat_c or not lon_c:
            sys.exit(f"Não achei colunas de latitude/longitude no CSV: {reader.fieldnames}")
        for i, row in enumerate(reader):
            lat, lon = _num(row.get(lat_c)), _num(row.get(lon_c))
            if lat is None or lon is None:
                continue
            cidade = next((n for n, b in CIDADE_BBOX.items()
                           if b["lat_min"] <= lat <= b["lat_max"] and b["lon_min"] <= lon <= b["lon_max"]), None)
            if cidade is None:
                continue
            pts.append({
                "lat": lat, "lon": lon, "tipo": "radar", "risco_base": 0,
                "velocidade_max": row.get(vel_c) if vel_c else None,
                "sentido": None, "cidade": cidade, "fonte": "antt", "fonte_id": f"antt/{i}",
            })
    return pts


def dedupe(points):
    """Junta pontos do mesmo tipo a menos de DEDUPE_METERS. Fonte oficial ganha."""
    priority = {"antt": 0, "osm": 1}
    points = sorted(points, key=lambda p: priority.get(p["fonte"], 9))
    kept = []
    for p in points:
        dup = next((k for k in kept if k["tipo"] == p["tipo"]
                    and haversine(k["lat"], k["lon"], p["lat"], p["lon"]) < DEDUPE_METERS), None)
        if dup:
            dup.setdefault("fontes_extras", []).append(p["fonte_id"])
        else:
            kept.append(p)
    return kept


def to_geojson(points):
    now = datetime.now(timezone.utc).isoformat()
    feats = []
    for p in points:
        props = {k: v for k, v in p.items() if k not in ("lat", "lon")}
        props.update({"status": "nao_confirmado", "confirmacoes": 0,
                      "votos": {"passa": 0, "raspa": 0, "nao_passa": 0},
                      "importado_em": now})
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                      "properties": props})
    return {"type": "FeatureCollection", "features": feats}


CITY_IDS = {"São Paulo": "sao_paulo", "Guarulhos": "guarulhos", "Itaquaquecetuba": "itaquaquecetuba"}


def _sql_str(v):
    if v is None:
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def _speed(v):
    try:
        n = int(str(v).split()[0])
        return str(n) if 0 < n < 200 else "null"
    except (ValueError, IndexError, TypeError):
        return "null"


def to_sql(points):
    """INSERT na tabela public.reports. Rodar com um usuário de serviço (passa por cima do RLS).
    Reimportar não duplica: (source, source_ref) é único."""
    lines = ["-- Gerado por scripts/import_obstacles.py",
             "insert into public.reports (kind, lat, lon, city_id, source, source_ref, base_risk, speed_limit, status) values"]
    rows = []
    for p in points:
        rows.append("  ({}, {:.7f}, {:.7f}, {}, {}, {}, {}, {}, 'unconfirmed')".format(
            _sql_str(p["tipo"]), p["lat"], p["lon"], _sql_str(CITY_IDS[p["cidade"]]),
            _sql_str(p["fonte"]), _sql_str(p["fonte_id"]), int(p["risco_base"]), _speed(p.get("velocidade_max"))))
    if not rows:
        return "-- nada para importar\n"
    lines.append(",\n".join(rows))
    lines.append("on conflict (source, source_ref) where source_ref is not null do nothing;")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser(description="Importa obstáculos e radares de SP, Guarulhos e Itaquá pro Marcha GPS")
    ap.add_argument("--antt", help="CSV de radares da ANTT (opcional)")
    ap.add_argument("--osm-json", help="Usar um JSON do Overpass já baixado, em vez de baixar")
    ap.add_argument("--cidade", default="São Paulo", choices=list(CITY_IDS), help="Cidade do --osm-json")
    ap.add_argument("--sql", help="Também grava um arquivo .sql de carga pra tabela reports")
    ap.add_argument("--out", default="obstaculos_sp_guarulhos_itaqua.geojson")
    args = ap.parse_args()

    pts = []
    if args.osm_json:
        # JSON já baixado: informe a cidade dele com --cidade
        with open(args.osm_json, encoding="utf-8") as fh:
            pts = osm_to_points(json.load(fh)["elements"], args.cidade)
        print(f"OSM ({args.cidade}): {len(pts)} pontos")
    else:
        for cidade in CIDADES:
            print(f"Baixando {cidade} do OpenStreetMap...")
            p = osm_to_points(fetch_osm(cidade), cidade)
            print(f"  {len(p)} pontos")
            pts += p

    if args.antt:
        a = antt_to_points(args.antt)
        print(f"ANTT: {len(a)} radares dentro das 3 cidades")
        pts += a

    pts = dedupe(pts)
    gj = to_geojson(pts)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(gj, fh, ensure_ascii=False)

    resumo = {}
    for p in pts:
        k = f'{p["cidade"]} · {p["tipo"]}'
        resumo[k] = resumo.get(k, 0) + 1
    print(f"Salvo em {args.out}: {len(pts)} pontos após juntar duplicados")
    if args.sql:
        with open(args.sql, "w", encoding="utf-8") as fh:
            fh.write(to_sql(pts))
        print(f"SQL de carga em {args.sql}")
    for t, n in sorted(resumo.items(), key=lambda x: -x[1]):
        print(f"  {t}: {n}")


if __name__ == "__main__":
    main()
