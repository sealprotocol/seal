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
UNISAT = "https://open-api.unisat.io"
TOKEN = os.environ.get("SEAL_UNISAT_TOKEN", "").strip()
TEXT = re.compile(r"^(0|[1-9][0-9]*)\.seal\n?$")
TXID = re.compile(r"^[0-9a-f]{64}$")
UA = {"user-agent": "sealprotocol-pending/1", "accept": "*/*"}
PAUSE = 15
UNISAT_PAUSE = 90
SENT_FOR = 2 * 60 * 60
SAMPLE = (
    "20fae11cc0eb253263f093794d435c0ed49d8f5fc2aec54ac5abc72f3ad032d11e"
    "ac0063036f7264010118746578742f706c61696e3b636861727365743d7574662d"
    "380006302e7365616c68"
)


def fetch(url, timeout=40, headers=None):
    request = urllib.request.Request(url, headers=headers or UA)
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


def seal_from_event(item, tip):
    if not isinstance(item, dict) or item.get("isTransfer"):
        return None
    if not str(item.get("contentType") or "").startswith("text/plain"):
        return None
    body = item.get("contentBody")
    if not isinstance(body, str):
        return None
    body = body.replace("\r\n", "\n").replace("\r", "\n")
    match = TEXT.fullmatch(body)
    if not match:
        return None
    height = int(match.group(1))
    if tip is not None and height > tip:
        return None
    txid = str(item.get("txid") or "").lower()
    if not TXID.fullmatch(txid):
        return None
    return {
        "height": height,
        "txid": txid,
        "address": item.get("address") or "",
    }


def unisat_page(tip, cursor, size):
    headers = dict(UA)
    headers["authorization"] = f"Bearer {TOKEN}"
    raw = fetch(
        f"{UNISAT}/v1/indexer/inscription/events?start={tip}&end=0&cursor={cursor}&size={size}",
        headers=headers,
    )
    data = json.loads(raw)
    if data.get("code") not in (0, None):
        raise RuntimeError(data.get("msg") or "unisat")
    return data.get("data") or {}


def unisat_seals(tip, now, last):
    if not TOKEN or tip is None or now - last < UNISAT_PAUSE:
        return None, last
    try:
        # Mempool rows sit at the high end. One count, then the newest page.
        first = unisat_page(tip + 1, 0, 1)
        total = int(first.get("total") or 0)
        detail = list(unisat_page(tip + 1, max(0, total - 500), 500).get("detail") or [])
    except (RuntimeError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"unisat {error}", flush=True)
        return None, now
    rows = []
    seen = set()
    for item in detail:
        row = seal_from_event(item, tip)
        if not row:
            continue
        key = (row["txid"], row["height"])
        if key in seen:
            continue
        seen.add(key)
        rows.append(row)
    print(f"unisat {len(rows)}", flush=True)
    return rows, now


def remember(pending, known, row, now):
    key = (row["txid"], row["height"])
    if key not in known:
        if "since" not in row:
            row["since"] = int(now)
        pending.append(row)
        known.add(key)
        return
    current = next(item for item in pending if (item["txid"], item["height"]) == key)
    if row.get("address") and not current.get("address"):
        current["address"] = row["address"]
    if "fee" in row and "fee" not in current:
        current["fee"] = row["fee"]
    if "rate" in row and "rate" not in current:
        current["rate"] = row["rate"]


def waiting(item, current, now):
    if item.get("txid") in current:
        return True
    if "fee" in item:
        return False
    since = int(item.get("since") or 0)
    return since > 0 and now - since < SENT_FOR


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
    event = {
        "contentType": "text/plain;charset=utf-8",
        "contentBody": "10.seal",
        "txid": "ab" * 32,
        "address": "bc1qexample",
    }
    row = seal_from_event(event, 10)
    if not row or row["height"] != 10 or row["address"] != "bc1qexample":
        raise SystemExit("event")
    if seal_from_event({**event, "contentBody": "10.seal "}, 10):
        raise SystemExit("event space")
    if seal_from_event({**event, "isTransfer": True}, 10):
        raise SystemExit("event transfer")
    print("ok", flush=True)


def settle(pending, current, found, early, now):
    pending = [item for item in pending if waiting(item, current, now)]
    known = {(item["txid"], item["height"]) for item in pending}
    for row in early or []:
        remember(pending, known, row, now)
    for row in found:
        remember(pending, known, row, now)
    return pending


def enrich(pending, current, tip, now):
    missing = []
    seen = set()
    for item in pending:
        txid = item.get("txid")
        if txid in current and "fee" not in item and txid not in seen:
            seen.add(txid)
            missing.append(txid)
    if not missing:
        return pending
    with ThreadPoolExecutor(max_workers=4) as pool:
        opened = list(pool.map(lambda txid: inspect(txid, tip), missing))
    known = {(item["txid"], item["height"]) for item in pending}
    for rows in opened:
        if not rows:
            continue
        for row in rows:
            remember(pending, known, row, now)
    return pending


def main():
    if "--check" in sys.argv:
        check()
        return
    pending = load_pending()
    current = set(txids())
    seen = set(current)
    now = time.time()
    tip = tip_height(None)
    early, unisat_at = unisat_seals(tip, now, 0)
    pending = enrich(settle(pending, current, [], early, now), current, tip, now)
    write_pending(pending)
    print(f"snapshot {len(seen)} pending {len(pending)}", flush=True)
    if "--once" in sys.argv:
        return
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
        now = time.time()
        early, unisat_at = unisat_seals(tip, now, unisat_at)
        pending = enrich(settle(pending, current, found, early, now), current, tip, now)
        seen &= current
        write_pending(pending)
        print(f"round fresh {len(fresh)} pending {len(pending)}", flush=True)
        time.sleep(max(0, PAUSE - (time.time() - started)))


if __name__ == "__main__":
    main()
