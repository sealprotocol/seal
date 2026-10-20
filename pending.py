#!/usr/bin/env python3
"""Watch the mempool for new {height}.seal texts.

The id list at startup is remembered and not opened. Only a transaction
that appears after that is read. A text already waiting stays unseen.
"""

import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PENDING = Path(os.environ.get("SEAL_PENDING", ROOT / "pending.json"))
MEMPOOL = "https://mempool.space/api"
TEXT = re.compile(r"^(0|[1-9][0-9]*)\.seal\n?$")
UA = {"user-agent": "sealprotocol-pending/1", "accept": "*/*"}
PAUSE = 15
SAMPLE = (
    "20fae11cc0eb253263f093794d435c0ed49d8f5fc2aec54ac5abc72f3ad032d11e"
    "ac0063036f7264010118746578742f706c61696e3b636861727365743d7574662d"
    "380006302e7365616c68"
)


def fetch(url, timeout=40):
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


def tokens(script):
    out = []
    index = 0
    size = len(script)
    while index < size:
        op = script[index]
        index += 1
        if op == 0:
            out.append((0, b""))
        elif 1 <= op <= 75 and index + op <= size:
            out.append((op, script[index:index + op]))
            index += op
        elif op == 76 and index < size:
            length = script[index]
            index += 1
            out.append((op, script[index:index + length]))
            index += length
        elif op == 77 and index + 2 <= size:
            length = int.from_bytes(script[index:index + 2], "little")
            index += 2
            out.append((op, script[index:index + length]))
            index += length
        elif op == 78 and index + 4 <= size:
            length = int.from_bytes(script[index:index + 4], "little")
            index += 4
            out.append((op, script[index:index + length]))
            index += length
        else:
            out.append((op, None))
    return out


def envelopes(script):
    found = []
    parts = tokens(script)
    index = 0
    while index < len(parts) - 1:
        if parts[index][0] != 0 or parts[index + 1][0] != 0x63:
            index += 1
            continue
        index += 2
        fields = []
        while index < len(parts) and parts[index][0] != 0x68:
            _op, data = parts[index]
            if data is not None:
                fields.append(data)
            index += 1
        parsed = read_fields(fields)
        if parsed:
            found.append(parsed)
    return found


def read_fields(fields):
    if not fields or fields[0] != b"ord":
        return None
    index = 1
    content_type = ""
    while index < len(fields):
        if fields[index] == b"":
            index += 1
            break
        tag = fields[index]
        index += 1
        if index >= len(fields):
            break
        data = fields[index]
        index += 1
        if tag == b"\x01":
            content_type = data.decode("utf-8", "replace")
    body = b"".join(fields[index:])
    return content_type, body


def carrier(tx, vin_index):
    offset = 0
    for vin in (tx.get("vin") or [])[:vin_index]:
        offset += int((vin.get("prevout") or {}).get("value") or 0)
    cursor = 0
    for vout in tx.get("vout") or []:
        value = int(vout.get("value") or 0)
        if value > 0 and cursor + value > offset:
            return vout.get("scriptpubkey_address") or ""
        cursor += value
    return ""


def seals_in(tx, tip):
    found = []
    seen = set()
    for vin_index, vin in enumerate(tx.get("vin") or []):
        for item in vin.get("witness") or []:
            if not isinstance(item, str):
                continue
            try:
                script = bytes.fromhex(item)
            except ValueError:
                continue
            for content_type, body in envelopes(script):
                if not str(content_type).startswith("text/plain"):
                    continue
                if not 6 <= len(body) <= 16:
                    continue
                match = TEXT.fullmatch(body.decode("utf-8", "replace"))
                if not match:
                    continue
                height = int(match.group(1))
                if tip is not None and height > tip:
                    continue
                if height in seen:
                    continue
                seen.add(height)
                found.append({
                    "height": height,
                    "address": carrier(tx, vin_index),
                })
    return found


def fee_rate(tx):
    fee = int(tx.get("fee") or 0)
    weight = int(tx.get("weight") or 0)
    if weight <= 0:
        return fee, None
    return fee, round(fee / (weight / 4), 2)


def load_pending():
    if not PENDING.exists():
        return []
    try:
        data = json.loads(PENDING.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict) and item.get("txid")]


def write_pending(rows):
    rows = sorted(rows, key=lambda item: (item["height"], -(item.get("rate") or 0)))
    payload = json.dumps(rows, indent=2) + "\n"
    temporary = PENDING.with_suffix(".json.tmp")
    temporary.write_text(payload)
    if PENDING.exists():
        stat = PENDING.stat()
        os.chown(temporary, stat.st_uid, stat.st_gid)
        os.chmod(temporary, stat.st_mode & 0o777)
    os.replace(temporary, PENDING)


def txids():
    return json.loads(fetch(f"{MEMPOOL}/mempool/txids"))


def tip_height(previous):
    try:
        return int(fetch(f"{MEMPOOL}/blocks/tip/height", timeout=20).decode().strip())
    except (RuntimeError, ValueError):
        return previous


def inspect(txid, tip):
    try:
        tx = json.loads(fetch(f"{MEMPOOL}/tx/{txid}", timeout=25))
    except RuntimeError:
        return None
    fee, rate = fee_rate(tx)
    rows = []
    for seal in seals_in(tx, tip):
        row = {
            "height": seal["height"],
            "txid": txid,
            "address": seal["address"],
            "fee": fee,
        }
        if rate is not None:
            row["rate"] = rate
        rows.append(row)
        print(f"mempool {seal['height']} {txid} {fee} sat", flush=True)
    return rows


def check():
    content_type, body = envelopes(bytes.fromhex(SAMPLE))[0]
    if content_type != "text/plain;charset=utf-8" or body != b"0.seal":
        raise SystemExit("sample did not read 0.seal")
    tx = {
        "vin": [{"prevout": {"value": 330}, "witness": []}, {"prevout": {"value": 500}}],
        "vout": [
            {"value": 200, "scriptpubkey_address": "first"},
            {"value": 400, "scriptpubkey_address": "second"},
        ],
    }
    if carrier(tx, 0) != "first" or carrier(tx, 1) != "second":
        raise SystemExit("carrier")
    print("ok", flush=True)


def main():
    if "--check" in sys.argv:
        check()
        return
    pending = load_pending()
    current = set(txids())
    pending = [item for item in pending if item["txid"] in current]
    seen = set(current)
    write_pending(pending)
    print(f"snapshot {len(seen)} pending {len(pending)}", flush=True)
    if "--once" in sys.argv:
        return
    tip = None
    while True:
        started = time.time()
        try:
            current = set(txids())
        except RuntimeError as error:
            print(f"list {error}", flush=True)
            time.sleep(PAUSE)
            continue
        tip = tip_height(tip)
        fresh = [txid for txid in current if txid not in seen]
        found = []
        if fresh:
            with ThreadPoolExecutor(max_workers=4) as pool:
                opened = list(pool.map(lambda txid: inspect(txid, tip), fresh))
            for txid, rows in zip(fresh, opened):
                if rows is None:
                    continue
                seen.add(txid)
                found.extend(rows)
        pending = [item for item in pending if item["txid"] in current]
        known = {(item["txid"], item["height"]) for item in pending}
        for row in found:
            key = (row["txid"], row["height"])
            if key not in known:
                pending.append(row)
                known.add(key)
        seen &= current
        write_pending(pending)
        print(f"round fresh {len(fresh)} pending {len(pending)}", flush=True)
        time.sleep(max(0, PAUSE - (time.time() - started)))


if __name__ == "__main__":
    main()
