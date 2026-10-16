#!/usr/bin/env python3
"""Read new {height}.seal inscriptions and record the current holder."""

import json
import os
import re
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SEALS = Path(os.environ.get("SEAL_FILE", ROOT / "seals.json"))
STATE = Path(os.environ.get("SEAL_STATE", ROOT / ".watch-state.json"))
ORD = "https://ordinals.com"
CHAIN = "https://blockstream.info/api"
TEXT = re.compile(r"^(0|[1-9][0-9]*)\.seal\n?$")
UA = {"user-agent": "sealprotocol-watch/1", "accept": "*/*"}


def fetch(url, timeout=25):
    request = urllib.request.Request(url, headers=UA)
    delay = 1
    last = None
    for _ in range(4):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as error:
            last = error
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(url) from last


def fetch_text(url):
    return fetch(url).decode("utf-8", "replace")


def inscription_ids(html):
    return list(dict.fromkeys(re.findall(r"/inscription/([0-9a-f]{64}i\d+)", html)))


def block_pages(height):
    page = 0
    while True:
        path = f"{ORD}/inscriptions/block/{height}" + (f"/{page}" if page else "")
        try:
            html = fetch_text(path)
        except RuntimeError:
            return
        ids = inscription_ids(html)
        if not ids:
            return
        yield ids
        if f"/inscriptions/block/{height}/{page + 1}" not in html:
            return
        page += 1


def read_json(path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text())


def block_fields(height):
    block_hash = fetch_text(f"{CHAIN}/block-height/{height}").strip()
    block = json.loads(fetch(f"{CHAIN}/block/{block_hash}"))
    return {
        "hash": block["id"],
        "timestamp": block["timestamp"],
        "tx_count": block["tx_count"],
    }


LOCK = threading.Lock()


def keep(found, item):
    with LOCK:
        current = found.get(item["height"])
        if current is not None and int(current.get("number") or 0) <= item["number"]:
            return
        if current:
            for key in ("hash", "timestamp", "tx_count"):
                if current.get(key) is not None:
                    item[key] = current[key]
        found[item["height"]] = item
    print(f"seal {item['height']} {item['id']}", flush=True)


def inspect(found, inscription_id):
    info = json.loads(fetch(f"{ORD}/r/inscription/{inscription_id}"))
    content_type = str(info.get("content_type") or "")
    length = int(info.get("content_length") or 0)
    if not content_type.startswith("text/plain") or not 6 <= length <= 16:
        return
    body = fetch(f"{ORD}/content/{inscription_id}").decode("utf-8", "replace")
    match = TEXT.fullmatch(body)
    if not match:
        return
    named = int(match.group(1))
    confirmed = int(info.get("height") or 0)
    if named > confirmed:
        return
    keep(found, {
        "height": named,
        "id": info["id"],
        "address": info.get("address") or "",
        "number": int(info.get("number") or 0),
        "confirmed": confirmed,
    })


def write_seals(found):
    ordered = []
    for height in sorted(found):
        seal = dict(found[height])
        if not seal.get("hash"):
            seal.update(block_fields(height))
        ordered.append(seal)
    payload = json.dumps(ordered, indent=2) + "\n"
    temporary = SEALS.with_suffix(".json.tmp")
    temporary.write_text(payload)
    if SEALS.exists():
        stat = SEALS.stat()
        os.chown(temporary, stat.st_uid, stat.st_gid)
        os.chmod(temporary, stat.st_mode & 0o777)
    os.replace(temporary, SEALS)
    print(f"wrote {len(ordered)}", flush=True)


def main():
    found = {seal["height"]: seal for seal in read_json(SEALS, [])}
    state = read_json(STATE, {})
    start = int(state.get("block", 971632)) + 1
    tip = int(fetch_text(f"{CHAIN}/blocks/tip/height").strip())
    print(f"scan {start}..{tip}", flush=True)
    for height in range(start, tip + 1):
        checked = 0
        for ids in block_pages(height):
            with LOCK:
                known = {seal.get("id") for seal in found.values()}
            fresh = [inscription_id for inscription_id in ids if inscription_id not in known]
            checked += len(ids)
            with ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(lambda inscription_id: inspect(found, inscription_id), fresh))
        state["block"] = height
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state) + "\n")
        print(f"block {height} checked {checked}", flush=True)
    for seal in found.values():
        info = json.loads(fetch(f"{ORD}/r/inscription/{seal['id']}"))
        seal["address"] = info.get("address") or seal.get("address") or ""
        seal["number"] = int(info.get("number") or seal.get("number") or 0)
        seal["confirmed"] = int(info.get("height") or seal.get("confirmed") or 0)
    write_seals(found)


if __name__ == "__main__":
    main()
