import { glyphSvg } from "./glyph.js?v=7";

const madeEl = document.querySelector("#made");
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
    <article class="seal">
      ${glyphSvg(block)}
      <span>${block.height}.seal</span>
      <small>${ringLabel(block.height)} · ${Number(block.tx_count).toLocaleString("en-US")} tx</small>
      <a href="${inscription}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
    </article>
  `;
}

async function paintMade() {
  let seals = [];
  try {
    const response = await fetch("/seals.json", { cache: "no-store" });
    if (response.ok) seals = await response.json();
  } catch {
    seals = [];
  }
  if (!Array.isArray(seals) || seals.length === 0) {
    madeEl.innerHTML = `<p class="empty">No inscription in the list. When a text is confirmed, its id goes here.</p>`;
    return;
  }
  const cards = await Promise.all(seals.map(async (seal) => {
    if (!seal || !Number.isInteger(seal.height) || seal.height < 0 || typeof seal.id !== "string" || !seal.id) {
      return `<article class="seal"><p class="empty">Invalid list entry.</p></article>`;
    }
    try {
      const block = await blockByHeight(seal.height);
      return sealCard(seal, block);
    } catch {
      return `
        <article class="seal">
          <p class="empty">${seal.height}.seal</p>
          <small>Block unreachable.</small>
          <a href="https://ordinals.com/inscription/${encodeURIComponent(seal.id)}" title="${escapeText(seal.id)}">${escapeText(shortId(seal.id))}</a>
        </article>
      `;
    }
  }));
  madeEl.innerHTML = cards.join("");
}

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

async function paintTip() {
  try {
    const response = await fetch("https://mempool.space/api/blocks/tip/height");
    if (!response.ok) throw new Error(String(response.status));
    const tip = Number(await response.text());
    liveEl.textContent = `latest block ${tip.toLocaleString("en-US")}`;
  } catch {
    liveEl.textContent = "blocks unreachable";
  }
}

paintMade();
paintTip();
setInterval(paintTip, 20000);
