import { figureBits, glyphSvg } from "./glyph.js?v=8";

const madeEl = document.querySelector("#made");
const findForm = document.querySelector("#find-form");
const findInput = document.querySelector("#find");
const findResult = document.querySelector("#find-result");
const chainEl = document.querySelector("#chain");
const liveEl = document.querySelector("#live");
const feesEl = document.querySelector("#fees");
const form = document.querySelector("#look-form");
const heightInput = document.querySelector("#height");
const resultEl = document.querySelector("#look-result");
const stageEl = document.querySelector("#stage");

function rings(height) {
  return Math.max(1, 5 - Math.floor(Number(height) / 210000));
}

function ringLabel(height) {
  const count = rings(height);
  return count === 1 ? "1 circle" : `${count} circles`;
}

function halvingText(height) {
  const era = Math.floor(Number(height) / 210000);
  const start = era * 210000;
  const circles = ringLabel(height);
  if (era === 0) return `Era 0. No halving yet, before block 210,000. ${circles}.`;
  const at = start.toLocaleString("en-US");
  if (era >= 4) return `Era ${era.toLocaleString("en-US")}. Halving at block ${at}. 1 circle from here on.`;
  return `Era ${era}. Halving at block ${at}. ${circles}.`;
}

async function blockByHeight(height) {
  const signal = AbortSignal.timeout(20000);
  const hashResponse = await fetch(`https://mempool.space/api/block-height/${height}`, { signal });
  if (!hashResponse.ok) throw new Error("altezza");
  const hash = (await hashResponse.text()).trim();
  const blockResponse = await fetch(`https://mempool.space/api/block/${hash}`, { signal });
  if (!blockResponse.ok) throw new Error("blocco");
  return blockResponse.json();
}

function shortId(id) {
  return id.length <= 18 ? id : `${id.slice(0, 8)}…${id.slice(-8)}`;
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function storedBlock(seal) {
  if (typeof seal.hash !== "string" || !/^[0-9a-f]{64}$/i.test(seal.hash)) return null;
  const timestamp = Number(seal.timestamp);
  const txCount = Number(seal.tx_count);
  if (!Number.isFinite(timestamp) || !Number.isFinite(txCount)) return null;
  return { id: seal.hash, height: seal.height, timestamp, tx_count: txCount };
}

function glyphImage(block) {
  const svg = glyphSvg(block).replace(/\s+/g, " ").trim();
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const file = `${Number(block.height)}.seal.svg`;
  return `<img class="glyph" src="${src}" alt="${file}" width="160" height="160">`;
}

function sealCard(seal, block) {
  const inscription = `https://ordinals.com/inscription/${encodeURIComponent(seal.id)}`;
  return `
    <article class="seal" data-height="${block.height}" tabindex="0">
      ${glyphImage(block)}
      <div>
        <span>${block.height}.seal</span>
        <small>${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</small>
        <a href="${inscription}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
      </div>
    </article>
  `;
}

function countWays(lit) {
  let ways = 1n;
  const k = Math.min(lit, 45 - lit);
  for (let i = 1; i <= k; i += 1) ways = ways * BigInt(45 - k + i) / BigInt(i);
  return ways;
}

function oneIn(ways, total) {
  if (ways <= 0n || ways > total) return "";
  if (total % ways === 0n) {
    const exact = total / ways;
    const text = exact >= 1000n ? Number(exact).toLocaleString("en-US") : exact.toString();
    return `1 in ${text}`;
  }
  const tenths = (total * 10n + ways / 2n) / ways;
  if (tenths < 100n) {
    const whole = tenths / 10n;
    const frac = tenths % 10n;
    return frac === 0n ? `1 in ${whole}` : `1 in ${whole}.${frac}`;
  }
  const rounded = (total + ways / 2n) / ways;
  return `1 in ${Number(rounded).toLocaleString("en-US")}`;
}

function rowList(rows) {
  const labels = rows.map((row) => String(row));
  if (labels.length === 1) return `Row ${labels[0]}`;
  if (labels.length === 2) return `Rows ${labels[0]} and ${labels[1]}`;
  return `Rows ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

const confirmedTimes = new Map();

async function confirmedClock(height) {
  if (confirmedTimes.has(height)) return confirmedTimes.get(height);
  const hashResponse = await fetch(`https://mempool.space/api/block-height/${height}`, { signal: AbortSignal.timeout(20000) });
  if (!hashResponse.ok) throw new Error("height");
  const hash = (await hashResponse.text()).trim();
  const blockResponse = await fetch(`https://mempool.space/api/block/${encodeURIComponent(hash)}`, { signal: AbortSignal.timeout(20000) });
  if (!blockResponse.ok) throw new Error("block");
  const body = await blockResponse.json();
  const clock = blockClock(body.timestamp);
  confirmedTimes.set(height, clock);
  return clock;
}

function blockClock(unix) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Number(unix) * 1000));
  return `${formatted} UTC`;
}

function readingsOf(block) {
  const bits = figureBits(block.id);
  while (bits.length < 45) bits.push(0);
  const rows = Array.from({ length: 9 }, (_, y) => bits.slice(y * 5, y * 5 + 5));
  const lit = bits.reduce((sum, bit) => sum + bit, 0);
  const center = rows.reduce((sum, row) => sum + row[4], 0);
  const visual = rows.reduce((sum, row) => {
    let squares = 0;
    for (let x = 0; x < 5; x += 1) if (row[x]) squares += x === 4 ? 1 : 2;
    return sum + squares;
  }, 0);
  const emptyRows = [];
  const fullRows = [];
  rows.forEach((row, y) => {
    const sum = row.reduce((total, bit) => total + bit, 0);
    if (sum === 0) emptyRows.push(y + 1);
    if (sum === 5) fullRows.push(y + 1);
  });
  const mirrored = [0, 1, 2, 3].every((y) => rows[y].every((bit, x) => bit === rows[8 - y][x]));
  const second = Number(block.timestamp) % 3600;
  const rawTx = Number(block.tx_count) || 0;
  const clamped = Math.max(1, Math.min(7000, rawTx));
  const total = 1n << 45n;
  return {
    lit,
    visual,
    center,
    emptyRows,
    fullRows,
    mirrored,
    second,
    sweep: Math.round(Math.max(second / 3600, 0.04) * 100),
    rawTx,
    clamped,
    line: Math.round(((clamped - 1) / 6999) * 100),
    figure: oneIn(1n, total),
    count: oneIn(countWays(lit), total),
    tail: String(block.id).slice(-16),
  };
}

function linkLine(href, text) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeText(text)}</a>`;
}

function sheetHtml(item) {
  const { seal, block } = item;
  const txid = /^[0-9a-f]{64}i\d+$/i.test(seal.id) ? seal.id.slice(0, 64) : "";
  const inscription = linkLine(`https://ordinals.com/inscription/${encodeURIComponent(seal.id)}`, seal.id);
  const owner = seal.address
    ? linkLine(`https://mempool.space/address/${encodeURIComponent(seal.address)}`, seal.address)
    : "The holder is not in the list.";
  const transaction = txid
    ? linkLine(`https://mempool.space/tx/${txid}`, txid)
    : "The transaction is not in the id.";
  const number = Number.isInteger(seal.number) ? Number(seal.number).toLocaleString("en-US") : "";
  const confirmed = Number.isInteger(seal.confirmed) ? Number(seal.confirmed).toLocaleString("en-US") : "";
  const identity = `
    <p class="mono">${inscription}</p>
    ${number ? `<p class="mono muted">Inscription ${number}</p>` : ""}
    ${confirmed ? `<p class="mono muted" data-confirmed="${seal.confirmed}">Confirmed in block ${confirmed}</p>` : ""}
  `;
  if (!block) {
    return `
      <div class="seal-dialog-top">
        <div>
          <h3 id="seal-dialog-title">${seal.height}.seal</h3>
          <p class="facts">The block could not be read, so the picture is missing.</p>
        </div>
      </div>
      <h4>Owner</h4>
      <p class="mono">${owner}</p>
      <h4>Inscription</h4>
      ${identity}
      <h4>Transaction</h4>
      <p class="mono">${transaction}</p>
      <p class="mono muted">This transaction inscribed the text.</p>
    `;
  }
  const read = readingsOf(block);
  const extras = [];
  if (read.emptyRows.length) {
    const chance = oneIn(1n, 32n ** BigInt(read.emptyRows.length));
    const verb = read.emptyRows.length === 1 ? "is empty" : "are empty";
    extras.push(`${rowList(read.emptyRows)} ${verb}. ${chance}.`);
  }
  if (read.fullRows.length) {
    const chance = oneIn(1n, 32n ** BigInt(read.fullRows.length));
    const verb = read.fullRows.length === 1 ? "is full" : "are full";
    extras.push(`${rowList(read.fullRows)} ${verb}. ${chance}.`);
  }
  if (read.center === 0) extras.push("The center column is empty. 1 in 512.");
  if (read.center === 9) extras.push("The center column is full. 1 in 512.");
  if (read.mirrored) extras.push("The rows also mirror from top to bottom. 1 in 1,048,576.");
  const arc = `${read.second.toLocaleString("en-US")} seconds into the hour. The arc covers ${read.sweep}% of the circle.`;
  const floor = read.second < 144
    ? `<p class="mono">The arc is held at its shortest. That floor covers the first 144 seconds of an hour, 1 in 25.</p>`
    : "";
  let line = `${read.rawTx.toLocaleString("en-US")} ${read.rawTx === 1 ? "transaction" : "transactions"}. `;
  if (read.rawTx <= 1) line += "The line is at its shortest.";
  else if (read.rawTx >= 7000) line += "The line is at its longest.";
  else line += `The line is ${read.line}% of the way from short to long.`;
  if (read.rawTx > 7000) line += " It stops at 7,000.";
  const hash = linkLine(`https://mempool.space/block/${encodeURIComponent(block.id)}`, block.id);
  return `
    <div class="seal-dialog-top">
      ${glyphImage(block)}
      <div>
        <h3 id="seal-dialog-title">${Number(block.height).toLocaleString("en-US")}.seal</h3>
        <p class="facts">${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</p>
        <p class="facts">${blockClock(block.timestamp)}</p>
      </div>
    </div>
    <h4>Owner</h4>
    <p class="mono">${owner}</p>
    <h4>Inscription</h4>
    ${identity}
    <h4>Transaction</h4>
    <p class="mono">${transaction}</p>
    <p class="mono muted">This transaction inscribed the text.</p>
    <h4>Block</h4>
    <p class="mono">${hash}</p>
    <p class="mono muted">The last 16 hex digits draw the squares: ${escapeText(read.tail)}</p>
    <h4>The figure</h4>
    <p class="mono">${read.lit} of 45 bits are lit. The mirror draws ${read.visual} squares.</p>
    <p class="mono">This figure is ${read.figure.replace("1 in", "1 of")}.</p>
    <p class="mono muted">A figure with exactly ${read.lit} lit bits is ${read.count}.</p>
    ${extras.map((note) => `<p class="mono">${escapeText(note)}</p>`).join("")}
    <h4>Halving</h4>
    <p class="mono">${halvingText(block.height)}</p>
    <h4>The hour</h4>
    <p class="mono">${arc}</p>
    ${floor}
    <h4>The line</h4>
    <p class="mono">${line}</p>
  `;
}

let made = [];
let madeState = "loading";
let era = "all";
let view = "grid";
let page = 1;
let shownSize = 24;

function pageSize() {
  if (view === "list" || window.matchMedia("(max-width: 700px)").matches) return 24;
  const columns = getComputedStyle(madeEl).gridTemplateColumns.split(" ").filter(Boolean).length;
  return columns === 5 ? 25 : 24;
}

function pageCount(total) {
  return Math.max(1, Math.ceil(total / pageSize()));
}

function pageWindow(pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const nums = new Set([1, pages, page - 1, page, page + 1]);
  const ordered = [...nums].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const windowed = [];
  for (const n of ordered) {
    const prev = windowed[windowed.length - 1];
    if (typeof prev === "number" && n - prev > 1) windowed.push("…");
    windowed.push(n);
  }
  return windowed;
}

function pagerHtml(pages) {
  const nums = pageWindow(pages).map((n) => {
    if (n === "…") return `<span class="gap" aria-hidden="true">…</span>`;
    const on = n === page;
    return `<button type="button" class="chip${on ? " on" : ""}" data-page="${n}" aria-pressed="${on ? "true" : "false"}" aria-label="Page ${n}">${n}</button>`;
  }).join("");
  return `<button type="button" class="chip" data-page="prev"${page <= 1 ? " disabled" : ""}>Prev</button>${nums}<button type="button" class="chip" data-page="next"${page >= pages ? " disabled" : ""}>Next</button>`;
}

function renderPagers(total) {
  const pages = pageCount(total);
  page = Math.min(Math.max(page, 1), pages);
  const html = pages > 1 ? pagerHtml(pages) : "";
  for (const el of document.querySelectorAll(".pages")) {
    el.hidden = pages < 2;
    el.innerHTML = html;
  }
}

function clearPagers() {
  for (const el of document.querySelectorAll(".pages")) {
    el.hidden = true;
    el.innerHTML = "";
  }
}

function filtered(query) {
  return made.filter((item) => {
    if (query && String(item.height) === query) return true;
    if (era !== "all" && String(rings(item.height)) !== era) return false;
    if (query && !String(item.height).startsWith(query)) return false;
    return true;
  });
}

function renderMade() {
  madeEl.className = view === "list" ? "gallery list" : "gallery";
  shownSize = pageSize();
  const query = findInput.value.trim();
  const heightOk = /^(0|[1-9][0-9]*)$/.test(query);
  if (madeState === "loading") {
    findResult.className = "result";
    findResult.textContent = query ? "Reading the list…" : "";
    return;
  }
  if (madeState === "failed") {
    findResult.className = "result bad";
    findResult.textContent = "The list is unreachable.";
    madeEl.innerHTML = "";
    clearPagers();
    return;
  }
  if (made.length === 0) {
    findResult.className = "result";
    findResult.textContent = "";
    madeEl.innerHTML = `<p class="empty">No inscription in the list. When a text is confirmed, its id goes here.</p>`;
    clearPagers();
    return;
  }
  if (query && !heightOk) {
    findResult.className = "result bad";
    findResult.textContent = "Invalid height.";
    madeEl.innerHTML = "";
    clearPagers();
    return;
  }
  const shown = filtered(query);
  if (query) {
    const exact = made.some((item) => String(item.height) === query);
    findResult.className = "result";
    const name = `${Number(query).toLocaleString("en-US")}.seal`;
    findResult.textContent = exact ? `${name} is inscribed.` : `${name} is not inscribed.`;
  } else {
    findResult.className = "result";
    findResult.textContent = "";
  }
  if (shown.length === 0) {
    madeEl.innerHTML = `<p class="empty">No inscription in this list.</p>`;
    clearPagers();
    return;
  }
  renderPagers(shown.length);
  const size = pageSize();
  const start = (page - 1) * size;
  madeEl.innerHTML = shown.slice(start, start + size).map((item) => {
    const hit = query && String(item.height) === query ? " hit" : "";
    return item.html.replace('class="seal"', `class="seal${hit}"`);
  }).join("");
}

async function paintMade(seals) {
  if (!Array.isArray(seals)) {
    madeState = "failed";
    made = [];
    renderMade();
    return;
  }
  const ready = [];
  const missing = [];
  for (const seal of seals) {
    if (!seal || !Number.isInteger(seal.height) || seal.height < 0 || typeof seal.id !== "string" || !seal.id) continue;
    const stored = storedBlock(seal);
    if (stored) ready.push({ height: seal.height, html: sealCard(seal, stored), seal, block: stored });
    else missing.push(seal);
  }
  made = ready;
  madeState = "ready";
  renderMade();
  for (const seal of missing) {
    let html;
    let block = null;
    try {
      block = await blockByHeight(seal.height);
      html = sealCard(seal, block);
    } catch {
      html = `
        <article class="seal" data-height="${seal.height}" tabindex="0">
          <div>
            <span>${seal.height}.seal</span>
            <small>Block unreachable.</small>
            <a href="https://ordinals.com/inscription/${encodeURIComponent(seal.id)}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
          </div>
        </article>
      `;
    }
    made = made.concat([{ height: seal.height, html, seal, block }]);
    renderMade();
  }
  if (shownBlock) showBlock(shownBlock);
}

findInput.addEventListener("input", () => {
  page = 1;
  renderMade();
});
findForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = findInput.value.trim();
  if (/^(0|[1-9][0-9]*)$/.test(query)) {
    const index = filtered(query).findIndex((item) => String(item.height) === query);
    if (index >= 0) page = Math.floor(index / pageSize()) + 1;
  }
  renderMade();
  const hit = madeEl.querySelector(".seal.hit");
  if (hit) hit.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector(".filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-era]");
  if (!button) return;
  era = button.dataset.era;
  page = 1;
  document.querySelectorAll("[data-era]").forEach((item) => {
    const on = item === button;
    item.classList.toggle("on", on);
    item.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderMade();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".pages [data-page]");
  if (!button || button.disabled) return;
  const value = button.dataset.page;
  if (value === "prev") page -= 1;
  else if (value === "next") page += 1;
  else page = Number(value);
  renderMade();
  document.getElementById("made-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

const sealDialog = document.querySelector("#seal-dialog");
const sealDialogBody = document.querySelector("#seal-dialog-body");

function openSeal(height) {
  const item = made.find((entry) => entry.height === Number(height));
  if (!item) return;
  sealDialogBody.innerHTML = sheetHtml(item);
  if (!sealDialog.open) sealDialog.showModal();
  document.querySelector("#seal-dialog-close").focus();
  const slot = sealDialogBody.querySelector("[data-confirmed]");
  const confirmed = Number(slot?.dataset.confirmed);
  if (!slot || !Number.isInteger(confirmed)) return;
  confirmedClock(confirmed).then((clock) => {
    if (!slot.isConnected) return;
    slot.textContent = `Confirmed in block ${confirmed.toLocaleString("en-US")}, ${clock}`;
  }).catch(() => {});
}

madeEl.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const card = event.target.closest(".seal");
  if (!card) return;
  openSeal(card.dataset.height);
});

madeEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".seal");
  if (!card || event.target !== card) return;
  event.preventDefault();
  openSeal(card.dataset.height);
});

sealDialog.addEventListener("click", (event) => {
  if (event.target === sealDialog) sealDialog.close();
});

document.querySelector("#seal-dialog-close").addEventListener("click", () => {
  sealDialog.close();
});

document.querySelector(".view-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  const index = (page - 1) * shownSize;
  view = button.dataset.view;
  madeEl.className = view === "list" ? "gallery list" : "gallery";
  page = Math.floor(index / pageSize()) + 1;
  document.querySelectorAll("[data-view]").forEach((item) => {
    const on = item === button;
    item.classList.toggle("on", on);
    item.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderMade();
});

window.addEventListener("resize", () => {
  const next = pageSize();
  if (next === shownSize) return;
  const index = (page - 1) * shownSize;
  page = Math.floor(index / next) + 1;
  if (madeState === "ready") renderMade();
});

let shownBlock = null;
let shownKey = "";
let pending = [];

function shortAddress(address) {
  const text = String(address || "");
  return text.length <= 20 ? text : `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function lookupSeal(height) {
  return made.find((item) => item.height === height)?.seal || null;
}

function hasFee(item) {
  return Number.isFinite(Number(item.fee));
}

function pendingFor(height) {
  return pending.filter((item) => Number(item.height) === Number(height) && /^[0-9a-f]{64}$/i.test(item.txid || ""));
}

function satVb(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "";
  const text = value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return text.replace(/\.?0+$/, "");
}

function pendingHtml(rows) {
  if (!rows.length) return "";
  const priced = rows.every(hasFee);
  let head;
  if (priced) {
    head = rows.length === 1
      ? "In the mempool. Not a seal until it confirms."
      : "In the mempool. The first to confirm is the seal.";
  } else {
    head = rows.length === 1
      ? "Sent. Not a seal until it confirms."
      : "Sent. The first to confirm is the seal.";
  }
  const attempts = rows.map((item) => {
    const address = item.address
      ? `<p class="holder" title="${escapeText(item.address)}">${escapeText(shortAddress(item.address))}</p>`
      : "";
    const rate = satVb(item.rate);
    const fee = hasFee(item)
      ? `<p class="facts">${Number(item.fee).toLocaleString("en-US")} sat${rate ? ` · ${rate} sat/vB` : ""}</p>`
      : "";
    const tx = `https://mempool.space/tx/${item.txid}`;
    return `
      <div class="attempt">
        ${address}
        ${fee}
        <a class="seal-id" href="${tx}" target="_blank" rel="noopener noreferrer" title="${escapeText(item.txid)}">${escapeText(shortId(item.txid))}</a>
      </div>
    `;
  }).join("");
  return `<p class="facts">${head}</p>${attempts}`;
}

async function loadPending() {
  try {
    const response = await fetch("/pending.json", { cache: "no-store" });
    if (response.status === 404) {
      pending = [];
      return;
    }
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data)) pending = data;
  } catch {
    // Keep the last list. A missed fetch is not an empty mempool.
  }
}

function showBlock(block) {
  shownBlock = block;
  const seal = lookupSeal(block.height);
  const rows = seal ? [] : pendingFor(block.height);
  const key = `${block.id}|${seal?.id || ""}|${rows.map((item) => `${item.txid}:${item.fee ?? ""}:${item.rate ?? ""}`).join(",")}`;
  if (key === shownKey) return;
  shownKey = key;
  const name = `${Number(block.height).toLocaleString("en-US")}.seal`;
  const owner = seal?.address
    ? `<p class="holder" title="${escapeText(seal.address)}">${escapeText(shortAddress(seal.address))}</p>`
    : "";
  const inscription = seal
    ? `<a class="seal-id" href="https://ordinals.com/inscription/${encodeURIComponent(seal.id)}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>`
    : "";
  const waiting = seal ? "" : pendingHtml(rows);
  stageEl.innerHTML = `
    <div class="stage">
      ${glyphImage(block)}
      <div>
        <p class="only-name">${block.height}.seal</p>
        <p class="facts">${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</p>
        ${seal ? `<p class="facts">Inscribed.</p>` : rows.length ? "" : `<p class="facts">Not inscribed.</p>`}
        ${owner}
        ${inscription}
        ${waiting}
      </div>
    </div>
  `;
  resultEl.className = "result";
  if (seal) resultEl.textContent = `${name} is inscribed.`;
  else if (rows.some(hasFee)) resultEl.textContent = `${name} is in the mempool.`;
  else if (rows.length) resultEl.textContent = `${name} is sent.`;
  else resultEl.textContent = `${name} is not inscribed.`;
}

async function paintShown(block) {
  await loadPending();
  showBlock(block);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typed = heightInput.value.trim();
  if (!/^(0|[1-9][0-9]*)$/.test(typed)) {
    shownBlock = null;
    shownKey = "";
    resultEl.className = "result bad";
    resultEl.textContent = "Invalid height.";
    stageEl.innerHTML = "";
    return;
  }
  resultEl.className = "result";
  resultEl.textContent = "Reading the block…";
  shownKey = "";
  try {
    await paintShown(await blockByHeight(Number(typed)));
  } catch {
    shownBlock = null;
    shownKey = "";
    resultEl.className = "result bad";
    resultEl.textContent = "Height not found.";
    stageEl.innerHTML = "";
  }
});

function ago(unix) {
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - Number(unix));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

function formatSats(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("en-US")} sat`;
}

function formatRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "—";
  if (rate >= 100) return Math.round(rate).toLocaleString("en-US");
  if (rate >= 10) return rate.toFixed(1);
  return rate.toFixed(2);
}

function feeColor(satVb) {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(Number(satVb) || 0.2, 0.2) / 0.2) / 2.3));
  return `hsl(32 85% ${22 + t * 36}%)`;
}

function feeStack(range) {
  const bands = (Array.isArray(range) ? range : []).slice().reverse();
  const marks = bands.map((rate) => `<i style="background:${feeColor(rate)}"></i>`).join("");
  return `<div class="fee-stack" aria-hidden="true">${marks}</div>`;
}

function paintChain(blocks, pending) {
  const tip = Number(blocks[0]?.height) || 0;
  const arrived = seenTip !== 0 && tip > seenTip;
  if (tip) seenTip = tip;
  const waiting = pending.slice(0, 4).reverse().map((block, index, list) => {
    const ahead = list.length - 1 - index;
    const name = ahead === 0 ? "Next" : `+${ahead}`;
    return `
      <article class="block wait">
        ${feeStack(block.feeRange)}
        <b>${name}</b>
        <small>${formatSats(block.totalFees)}</small>
        <small>${formatRate(block.medianFee)} sat/vB · ${Number(block.nTx).toLocaleString("en-US")} tx</small>
      </article>
    `;
  }).join("");
  const mined = blocks.slice(0, 6).map((block, index) => `
    <button type="button" class="block${arrived && index === 0 ? " arriving" : ""}" data-height="${block.height}">
      ${glyphImage(block)}
      <b>${Number(block.height).toLocaleString("en-US")}</b>
      <small>${formatSats(block.extras?.totalFees)}</small>
      <small>${formatRate(block.extras?.medianFee)} sat/vB · ${ago(block.timestamp)}</small>
    </button>
  `).join("");
  chainEl.innerHTML = `
    <div class="lane waiting">${waiting}</div>
    <div class="gate" aria-hidden="true"></div>
    <div class="lane mined">${mined}</div>
  `;
  if (!gateCentered || arrived) {
    requestAnimationFrame(() => {
      centerGate();
      gateCentered = true;
    });
  }
}

function centerGate() {
  const gate = chainEl.querySelector(".gate");
  if (!gate) return;
  const fits = chainEl.scrollWidth <= chainEl.clientWidth + 1;
  chainEl.style.justifyContent = fits ? "center" : "flex-start";
  if (fits) {
    chainEl.scrollLeft = 0;
    return;
  }
  chainEl.scrollLeft = gate.offsetLeft - (chainEl.clientWidth - gate.offsetWidth) / 2;
}

chainEl.addEventListener("click", (event) => {
  const button = event.target.closest(".block");
  if (!button) return;
  const height = button.dataset.height;
  heightInput.value = height;
  const block = latestBlocks.find((item) => String(item.height) === height);
  if (block) paintShown(block);
  document.querySelector("#look-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

let latestBlocks = [];
let seenTip = 0;
let gateCentered = false;
let tipBusy = false;

async function paintTip() {
  if (tipBusy) return;
  tipBusy = true;
  try {
    const [blockResponse, pendingResponse] = await Promise.all([
      fetch("https://mempool.space/api/v1/blocks", { signal: AbortSignal.timeout(20000) }),
      fetch("https://mempool.space/api/v1/fees/mempool-blocks", { signal: AbortSignal.timeout(20000) }),
    ]);
    if (!blockResponse.ok || !pendingResponse.ok) throw new Error("blocks");
    latestBlocks = await blockResponse.json();
    const pending = await pendingResponse.json();
    const tip = latestBlocks[0]?.height;
    liveEl.textContent = tip ? `latest block ${Number(tip).toLocaleString("en-US")}` : "blocks unreachable";
    paintChain(latestBlocks, Array.isArray(pending) ? pending : []);
  } catch {
    if (!latestBlocks.length) liveEl.textContent = "blocks unreachable";
  } finally {
    tipBusy = false;
  }
}

let sealFile = "";

async function reloadSeals() {
  try {
    const response = await fetch("/seals.json", { cache: "no-store" });
    if (!response.ok) throw new Error("list");
    const text = await response.text();
    if (text === sealFile) return;
    sealFile = text;
    await paintMade(JSON.parse(text));
  } catch {
    if (!sealFile) {
      madeState = "failed";
      made = [];
      renderMade();
    }
  }
}

function feeLine(value, label) {
  const rate = Number(value);
  const shown = Number.isFinite(rate) ? Math.round(rate).toLocaleString("en-US") : "—";
  return `<span><b>${shown}</b><span class="k">${label}</span></span>`;
}

let feesReady = false;

async function reloadFees() {
  try {
    const response = await fetch("https://mempool.space/api/v1/fees/recommended", { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("fees");
    const fees = await response.json();
    feesEl.innerHTML = [
      feeLine(fees.fastestFee, "next"),
      feeLine(fees.halfHourFee, "30m"),
      feeLine(fees.hourFee, "1h"),
      `<span class="unit">sat/vB</span>`,
    ].join("");
    feesReady = true;
  } catch {
    if (!feesReady) feesEl.textContent = "—";
  }
}

reloadSeals();
paintTip();
reloadFees();
setInterval(paintTip, 20000);
setInterval(() => {
  if (shownBlock) paintShown(shownBlock);
}, 20000);
setInterval(reloadFees, 20000);
setInterval(reloadSeals, 30000);
window.addEventListener("resize", centerGate);
