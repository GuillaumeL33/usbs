#!/usr/bin/env python3
"""Build a best-effort worldwide Decathlon store CSV from first-party locators and OSM."""

from __future__ import annotations

import csv
import json
import math
import re
import time
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import pycountry
import requests
import reverse_geocoder as rg

OUTPUT = Path("decathlon_stores_world.csv")
SUMMARY = Path("decathlon_stores_world_summary.json")
USER_AGENT = "Decathlon-world-store-list/1.0 (data consolidation for Power BI)"

ATP_SPIDERS = [
    "decathlon_au", "decathlon_be", "decathlon_ch", "decathlon_cz",
    "decathlon_de", "decathlon_es", "decathlon_fr", "decathlon_gb",
    "decathlon_hk", "decathlon_hu", "decathlon_it", "decathlon_ma",
    "decathlon_nl", "decathlon_pl", "decathlon_pt", "decathlon_ro",
    "decathlon_sg", "decathlon_sk", "decathlon_tr", "decathlon_tw",
]

OVERPASS_ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
]

# South, west, north, east. Smaller boxes reduce Overpass timeouts.
ZONES = [
    (-90, -180, 0, -90), (-90, -90, 0, 0), (-90, 0, 0, 90), (-90, 90, 0, 180),
    (0, -180, 30, -120), (0, -120, 30, -60), (0, -60, 30, 0),
    (0, 0, 30, 45), (0, 45, 30, 90), (0, 90, 30, 135), (0, 135, 30, 180),
    (30, -180, 55, -120), (30, -120, 55, -60), (30, -60, 55, 0),
    (30, 0, 55, 30), (30, 30, 55, 60), (30, 60, 55, 90),
    (30, 90, 55, 120), (30, 120, 55, 150), (30, 150, 55, 180),
    (55, -180, 90, -60), (55, -60, 90, 30), (55, 30, 90, 90), (55, 90, 90, 180),
]

COUNTRY_OVERRIDES = {
    "XK": "Kosovo", "TW": "Taiwan", "HK": "Hong Kong", "MO": "Macao",
    "PS": "Palestine", "RE": "Réunion", "PF": "French Polynesia",
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(clean(v) for v in value if clean(v))
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return re.sub(r"\s+", " ", str(value)).strip()


def norm_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def country_name(code: str) -> str:
    code = clean(code).upper()
    if not code:
        return ""
    if code in COUNTRY_OVERRIDES:
        return COUNTRY_OVERRIDES[code]
    try:
        return pycountry.countries.get(alpha_2=code).name
    except Exception:
        return code


def make_row(**kwargs: Any) -> dict[str, Any]:
    row = {
        "SourceRef": "", "StoreName": "Decathlon", "Address": "", "City": "",
        "Region": "", "Postcode": "", "Country": "", "CountryCode": "",
        "Latitude": None, "Longitude": None, "Phone": "", "Website": "",
        "OpeningHours": "", "Source": "", "SourceURL": "", "SourcePriority": 9,
    }
    row.update(kwargs)
    return row


def fetch_alltheplaces(session: requests.Session) -> tuple[list[dict[str, Any]], list[str]]:
    rows: list[dict[str, Any]] = []
    failures: list[str] = []
    for spider in ATP_SPIDERS:
        url = f"https://data.alltheplaces.xyz/runs/latest/output/{spider}.geojson"
        try:
            response = session.get(url, timeout=90, allow_redirects=True)
            response.raise_for_status()
            payload = response.json()
            features = payload.get("features", []) if isinstance(payload, dict) else []
            for feature in features:
                geometry = feature.get("geometry") or {}
                coords = geometry.get("coordinates") or []
                if len(coords) < 2:
                    continue
                props = feature.get("properties") or {}
                cc = clean(props.get("addr:country")).upper()
                street = clean(props.get("addr:street_address"))
                if not street:
                    street = " ".join(
                        part for part in [clean(props.get("addr:housenumber")), clean(props.get("addr:street"))] if part
                    )
                rows.append(make_row(
                    SourceRef=clean(props.get("ref") or feature.get("id")),
                    StoreName=clean(props.get("name") or props.get("branch") or "Decathlon"),
                    Address=clean(props.get("addr:full") or street),
                    City=clean(props.get("addr:city")),
                    Region=clean(props.get("addr:state")),
                    Postcode=clean(props.get("addr:postcode")),
                    Country=country_name(cc), CountryCode=cc,
                    Latitude=float(coords[1]), Longitude=float(coords[0]),
                    Phone=clean(props.get("phone")), Website=clean(props.get("website")),
                    OpeningHours=clean(props.get("opening_hours")),
                    Source="AllThePlaces / localisateur officiel",
                    SourceURL=clean(props.get("@source_uri") or url), SourcePriority=1,
                ))
        except Exception as exc:
            failures.append(f"{spider}: {type(exc).__name__}: {exc}")
    return rows, failures


def fetch_woosmap(session: requests.Session) -> tuple[list[dict[str, Any]], str]:
    """Try Decathlon's public Woosmap project. It may be France-only."""
    rows: list[dict[str, Any]] = []
    base = "https://api.woosmap.com/stores/search"
    params = {
        "key": "woos-c7283e70-7b4b-3c7d-bbfe-e65958b8769b",
        "query": '(user.publishOnEcommerce:1 AND user.status:"OPEN")',
        "page": 1,
    }
    try:
        while True:
            response = session.get(base, params=params, timeout=90)
            response.raise_for_status()
            payload = response.json()
            for feature in payload.get("features", []):
                props = feature.get("properties") or {}
                address = props.get("address") or {}
                coords = (feature.get("geometry") or {}).get("coordinates") or []
                if len(coords) < 2:
                    continue
                cc = clean(address.get("country_code")).upper()
                lines = address.get("lines") or []
                rows.append(make_row(
                    SourceRef=clean(props.get("store_id") or feature.get("id")),
                    StoreName=clean(props.get("name") or "Decathlon"),
                    Address=clean(lines), City=clean(address.get("city")),
                    Region=clean(address.get("state")), Postcode=clean(address.get("zipcode")),
                    Country=country_name(cc), CountryCode=cc,
                    Latitude=float(coords[1]), Longitude=float(coords[0]),
                    Phone=clean((props.get("contact") or {}).get("phone")),
                    Website=clean((props.get("contact") or {}).get("website")),
                    OpeningHours=clean(props.get("weekly_opening")),
                    Source="Decathlon Woosmap", SourceURL=response.url, SourcePriority=0,
                ))
            pagination = payload.get("pagination") or {}
            page = int(pagination.get("page", params["page"]))
            page_count = int(pagination.get("pageCount", page))
            if page >= page_count:
                break
            params["page"] = page + 1
        return rows, ""
    except Exception as exc:
        return rows, f"{type(exc).__name__}: {exc}"


def overpass_query(bbox: tuple[float, float, float, float]) -> str:
    south, west, north, east = bbox
    box = f"{south},{west},{north},{east}"
    return f'''[out:json][timeout:120];(
      nwr["brand:wikidata"="Q509349"]({box});
      nwr["brand"~"^Decathlon$",i]({box});
      nwr["name"~"^Decathlon($|\\s|-)",i]({box});
      nwr["operator"~"^Decathlon$",i]({box});
    );out center tags;'''


def fetch_overpass_zone(index: int, bbox: tuple[float, float, float, float]) -> tuple[list[dict[str, Any]], str]:
    query = overpass_query(bbox)
    last_error = ""
    for attempt in range(5):
        endpoint = OVERPASS_ENDPOINTS[(index + attempt) % len(OVERPASS_ENDPOINTS)]
        try:
            response = requests.post(
                endpoint, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=150
            )
            response.raise_for_status()
            return response.json().get("elements", []), ""
        except Exception as exc:
            last_error = f"{endpoint}: {type(exc).__name__}: {exc}"
            time.sleep(3 + attempt * 2)
    return [], last_error


def fetch_osm() -> tuple[list[dict[str, Any]], list[str]]:
    elements: list[dict[str, Any]] = []
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(fetch_overpass_zone, i, box): i for i, box in enumerate(ZONES)}
        for future in as_completed(futures):
            index = futures[future]
            batch, error = future.result()
            elements.extend(batch)
            if error:
                failures.append(f"zone {index}: {error}")

    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for element in elements:
        osm_ref = f"{element.get('type')}/{element.get('id')}"
        if osm_ref in seen_ids:
            continue
        seen_ids.add(osm_ref)
        tags = element.get("tags") or {}
        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            center = element.get("center") or {}
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue
        signature = " ".join(clean(tags.get(k)) for k in ("name", "brand", "operator", "brand:wikidata"))
        if "decathlon" not in signature.lower() and clean(tags.get("brand:wikidata")) != "Q509349":
            continue
        cc = clean(tags.get("addr:country") or tags.get("addr:country_code")).upper()
        street = " ".join(
            part for part in [clean(tags.get("addr:housenumber")), clean(tags.get("addr:street"))] if part
        )
        city = clean(tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village") or tags.get("addr:municipality"))
        region = clean(tags.get("addr:state") or tags.get("addr:province") or tags.get("addr:region"))
        rows.append(make_row(
            SourceRef=osm_ref, StoreName=clean(tags.get("name") or "Decathlon"),
            Address=clean(tags.get("addr:full") or street), City=city, Region=region,
            Postcode=clean(tags.get("addr:postcode")), Country=country_name(cc), CountryCode=cc,
            Latitude=float(lat), Longitude=float(lon),
            Phone=clean(tags.get("contact:phone") or tags.get("phone")),
            Website=clean(tags.get("contact:website") or tags.get("website")),
            OpeningHours=clean(tags.get("opening_hours")), Source="OpenStreetMap",
            SourceURL=f"https://www.openstreetmap.org/{osm_ref}", SourcePriority=2,
        ))
    return rows, failures


def enrich_geography(rows: list[dict[str, Any]]) -> None:
    targets = [r for r in rows if not r["CountryCode"] or not r["City"] or not r["Region"]]
    if not targets:
        return
    results = rg.search([(r["Latitude"], r["Longitude"]) for r in targets], mode=1)
    for row, geo in zip(targets, results):
        if not row["CountryCode"]:
            row["CountryCode"] = clean(geo.get("cc")).upper()
        if not row["Country"]:
            row["Country"] = country_name(row["CountryCode"])
        if not row["City"]:
            row["City"] = clean(geo.get("name"))
        if not row["Region"]:
            row["Region"] = clean(geo.get("admin1"))


def haversine_m(a: dict[str, Any], b: dict[str, Any]) -> float:
    lat1, lon1 = math.radians(a["Latitude"]), math.radians(a["Longitude"])
    lat2, lon2 = math.radians(b["Latitude"]), math.radians(b["Longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def names_compatible(a: str, b: str) -> bool:
    na, nb = norm_text(a), norm_text(b)
    generic = {"", "decathlon", "decathlon store"}
    if na in generic or nb in generic:
        return True
    return SequenceMatcher(None, na, nb).ratio() >= 0.42


def merge_row(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key in ["StoreName", "Address", "City", "Region", "Postcode", "Country", "CountryCode", "Phone", "Website", "OpeningHours"]:
        if not clean(target.get(key)) and clean(source.get(key)):
            target[key] = source[key]
    refs = [v for v in clean(target.get("SourceRef")).split(";") if v]
    if clean(source.get("SourceRef")) and clean(source.get("SourceRef")) not in refs:
        refs.append(clean(source.get("SourceRef")))
    target["SourceRef"] = ";".join(refs)
    sources = [v.strip() for v in clean(target.get("Source")).split(";") if v.strip()]
    if clean(source.get("Source")) and clean(source.get("Source")) not in sources:
        sources.append(clean(source.get("Source")))
    target["Source"] = "; ".join(sources)
    urls = [v.strip() for v in clean(target.get("SourceURL")).split(";") if v.strip()]
    if clean(source.get("SourceURL")) and clean(source.get("SourceURL")) not in urls:
        urls.append(clean(source.get("SourceURL")))
    target["SourceURL"] = "; ".join(urls)


def deduplicate(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = sorted(rows, key=lambda r: (r["SourcePriority"], r["CountryCode"], r["City"], r["StoreName"]))
    kept: list[dict[str, Any]] = []
    buckets: defaultdict[tuple[int, int], list[int]] = defaultdict(list)
    cell = 0.004  # roughly 440 m latitude
    for row in rows:
        x = math.floor(row["Latitude"] / cell)
        y = math.floor(row["Longitude"] / cell)
        duplicate_index = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for idx in buckets.get((x + dx, y + dy), []):
                    existing = kept[idx]
                    distance = haversine_m(row, existing)
                    if distance <= 80 or (distance <= 300 and names_compatible(row["StoreName"], existing["StoreName"])):
                        duplicate_index = idx
                        break
                if duplicate_index is not None:
                    break
            if duplicate_index is not None:
                break
        if duplicate_index is None:
            buckets[(x, y)].append(len(kept))
            kept.append(row)
        else:
            merge_row(kept[duplicate_index], row)
    return kept


def main() -> None:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

    atp_rows, atp_failures = fetch_alltheplaces(session)
    woos_rows, woos_error = fetch_woosmap(session)
    osm_rows, osm_failures = fetch_osm()

    raw_rows = woos_rows + atp_rows + osm_rows
    enrich_geography(raw_rows)
    rows = deduplicate(raw_rows)
    rows.sort(key=lambda r: (r["Country"], r["City"], r["StoreName"], r["Latitude"], r["Longitude"]))

    retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    fieldnames = [
        "StoreID", "StoreName", "Address", "City", "Region", "Postcode", "Country", "CountryCode",
        "Latitude", "Longitude", "Phone", "Website", "OpeningHours", "Source", "SourceRef", "SourceURL", "RetrievedAt",
    ]
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for index, row in enumerate(rows, start=1):
            writer.writerow({
                "StoreID": f"DEC-{index:05d}",
                "StoreName": row["StoreName"], "Address": row["Address"], "City": row["City"],
                "Region": row["Region"], "Postcode": row["Postcode"], "Country": row["Country"],
                "CountryCode": row["CountryCode"], "Latitude": f"{row['Latitude']:.7f}",
                "Longitude": f"{row['Longitude']:.7f}", "Phone": row["Phone"], "Website": row["Website"],
                "OpeningHours": row["OpeningHours"], "Source": row["Source"], "SourceRef": row["SourceRef"],
                "SourceURL": row["SourceURL"], "RetrievedAt": retrieved_at,
            })

    summary = {
        "retrieved_at": retrieved_at,
        "raw_counts": {"woosmap": len(woos_rows), "alltheplaces": len(atp_rows), "openstreetmap": len(osm_rows)},
        "deduplicated_store_count": len(rows),
        "country_count": len({r["CountryCode"] for r in rows if r["CountryCode"]}),
        "stores_by_country": dict(sorted(Counter(r["CountryCode"] or "UNKNOWN" for r in rows).items())),
        "alltheplaces_failures": atp_failures,
        "woosmap_error": woos_error,
        "overpass_failures": osm_failures,
        "methodology": "First-party Decathlon locator extracts via AllThePlaces and Woosmap, complemented by OpenStreetMap; 300 m spatial deduplication.",
        "caveat": "Best-effort open dataset, not an official exhaustive Decathlon master list. Locations can be missing, duplicated, closed or recently opened.",
    }
    SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
