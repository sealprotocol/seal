import { glyphSvg } from "./glyph.js?v=7";

const madeEl = document.querySelector("#made");
const findForm = document.querySelector("#find-form");
const findInput = document.querySelector("#find");
const findResult = document.querySelector("#find-result");
const chainEl = document.querySelector("#chain");
const liveEl = document.querySelector("#live");
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

async function blockByHeight(height) {
  const hashResponse = await fetch(`https://mempool.space/api/block-height/${height}`);
  if (!hashResponse.ok) throw new Error("altezza");
  const hash = (await hashResponse.text()).trim();
  const blockResponse = await fetch(`https://mempool.space/api/block/${hash}`);
  if (!blockResponse.ok) throw new Error("blocco");
  return blockResponse.json();
}

function shortId(id) {
  return id.length <= 18 ? id : `${id.slice(0, 8)}…${id.slice(-8)}`;
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function sealCard(seal, block) {
  const inscription = `https://ordinals.com/inscription/${encodeURIComponent(seal.id)}`;
  return `
    <article class="seal" data-height="${block.height}">
      ${glyphSvg(block)}
      <div>
        <span>${block.height}.seal</span>
        <small>${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</small>
        <a href="${inscription}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
      </div>
    </article>
  `;
}

let made = [];
let madeState = "loading";
let era = "all";
let view = "grid";

function renderMade() {
  madeEl.className = view === "list" ? "gallery list" : "gallery";
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
    return;
  }
  if (made.length === 0) {
    findResult.className = "result";
    findResult.textContent = "";
    madeEl.innerHTML = `<p class="empty">No inscription in the list. When a text is confirmed, its id goes here.</p>`;
    return;
  }
  if (query && !heightOk) {
    findResult.className = "result bad";
    findResult.textContent = "Invalid height.";
    madeEl.innerHTML = "";
    return;
  }
  const shown = made.filter((item) => {
    if (query && String(item.height) === query) return true;
    if (era !== "all" && String(rings(item.height)) !== era) return false;
    if (query && !String(item.height).startsWith(query)) return false;
    return true;
  });
  if (query) {
    const exact = made.some((item) => String(item.height) === query);
    findResult.className = "result";
    const name = `${Number(query).toLocaleString("en-US")}.seal`;
    findResult.textContent = exact ? `${name} is inscribed.` : `${name} is not inscribed.`;
  } else {
    findResult.className = "result";
    findResult.textContent = "";
  }
  madeEl.innerHTML = shown.map((item) => {
    const hit = query && String(item.height) === query ? " hit" : "";
    return item.html.replace('class="seal"', `class="seal${hit}"`);
  }).join("");
}

async function paintMade() {
  let seals = [];
  try {
    const response = await fetch("/seals.json", { cache: "no-store" });
    if (response.ok) seals = await response.json();
    if (!response.ok || !Array.isArray(seals)) {
      madeState = "failed";
      made = [];
      renderMade();
      return;
    }
  } catch {
    madeState = "failed";
    made = [];
    renderMade();
    return;
  }
  const cards = await Promise.all(seals.map(async (seal) => {
    if (!seal || !Number.isInteger(seal.height) || seal.height < 0 || typeof seal.id !== "string" || !seal.id) {
      return null;
    }
    try {
      const block = await blockByHeight(seal.height);
      return { height: seal.height, html: sealCard(seal, block) };
    } catch {
      return {
        height: seal.height,
        html: `
          <article class="seal" data-height="${seal.height}">
            <div>
              <span>${seal.height}.seal</span>
              <small>Block unreachable.</small>
              <a href="https://ordinals.com/inscription/${encodeURIComponent(seal.id)}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
            </div>
          </article>
        `,
      };
    }
  }));
  made = cards.filter(Boolean);
  madeState = "ready";
  renderMade();
}

findInput.addEventListener("input", renderMade);
findForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderMade();
  const hit = madeEl.querySelector(".seal.hit");
  if (hit) hit.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.querySelector(".filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-era]");
  if (!button) return;
  era = button.dataset.era;
  document.querySelectorAll("[data-era]").forEach((item) => {
    const on = item === button;
    item.classList.toggle("on", on);
    item.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderMade();
});

document.querySelector(".view-switch").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  view = button.dataset.view;
  document.querySelectorAll("[data-view]").forEach((item) => {
    const on = item === button;
    item.classList.toggle("on", on);
    item.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderMade();
});

function showBlock(block) {
  stageEl.innerHTML = `
    <div class="stage">
      ${glyphSvg(block)}
      <div>
        <p class="only-name">${block.height}.seal</p>
        <p class="facts">${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</p>
      </div>
    </div>
  `;
  resultEl.className = "result";
  resultEl.textContent = "Picture of the block.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const typed = heightInput.value.trim();
  if (!/^(0|[1-9][0-9]*)$/.test(typed)) {
    resultEl.className = "result bad";
    resultEl.textContent = "Invalid height.";
    stageEl.innerHTML = "";
    return;
  }
  resultEl.className = "result";
  resultEl.textContent = "Reading the block…";
  try {
    showBlock(await blockByHeight(Number(typed)));
  } catch {
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
      ${glyphSvg(block)}
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
      const gate = chainEl.querySelector(".gate");
      if (!gate) return;
      const gateBox = gate.getBoundingClientRect();
      const chainBox = chainEl.getBoundingClientRect();
      chainEl.scrollLeft += gateBox.left - chainBox.left - (chainEl.clientWidth - gateBox.width) / 2;
      gateCentered = true;
    });
  }
}

chainEl.addEventListener("click", (event) => {
  const button = event.target.closest(".block");
  if (!button) return;
  const height = button.dataset.height;
  heightInput.value = height;
  const block = latestBlocks.find((item) => String(item.height) === height);
  if (block) showBlock(block);
  document.querySelector("#look-title").scrollIntoView({ behavior: "smooth", block: "start" });
});

let latestBlocks = [];
let seenTip = 0;
let gateCentered = false;

async function paintTip() {
  try {
    const [blockResponse, pendingResponse] = await Promise.all([
      fetch("https://mempool.space/api/v1/blocks"),
      fetch("https://mempool.space/api/v1/fees/mempool-blocks"),
    ]);
    if (!blockResponse.ok || !pendingResponse.ok) throw new Error("blocks");
    latestBlocks = await blockResponse.json();
    const pending = await pendingResponse.json();
    const tip = latestBlocks[0]?.height;
    liveEl.textContent = tip ? `latest block ${Number(tip).toLocaleString("en-US")}` : "blocks unreachable";
    paintChain(latestBlocks, Array.isArray(pending) ? pending : []);
  } catch {
    liveEl.textContent = "blocks unreachable";
  }
}

paintMade();
paintTip();
setInterval(paintTip, 20000);
