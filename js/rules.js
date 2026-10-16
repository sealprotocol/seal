// Regole dell'indexer. La pagina le legge da qui: non ha una copia sua.

export const MAX_TICKER_CHARS = 7;
export const CAP = 2047;
export const SEALS_PER_HEIGHT = 1;
export const SECOND_MINT_SUPPLY = 0;
export const PROTOCOL = "element";

const TICKER = /^[a-z0-9]+$/;

export function normalizeTicker(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function checkTicker(value) {
  const tick = normalizeTicker(value);
  if (!tick) {
    return { ok: false, reason: "TICKER_EMPTY" };
  }
  if (tick.length > MAX_TICKER_CHARS) {
    return { ok: false, reason: "TICKER_TOO_LONG", tick };
  }
  if (!TICKER.test(tick)) {
    return { ok: false, reason: "TICKER_CHARSET", tick };
  }
  return { ok: true, tick };
}

const HEIGHT = /^(0|[1-9]\d*)$/;

export function checkHeight(value) {
  const height = String(value ?? "").trim();
  if (!HEIGHT.test(height)) {
    return { ok: false, reason: "HEIGHT_INVALID" };
  }
  return { ok: true, height };
}

// Un'altezza di blocco ha un solo sigillo valido: il primo.
// Il secondo, anche se il disegno è identico, ha supply 0.
export function classifyHeight(prior, height) {
  const checked = checkHeight(height);
  if (!checked.ok) {
    return { status: "rifiutato", supply: 0, reason: checked.reason };
  }
  const canonical = prior.find((row) => row.kind === "seal" && row.heightKey === checked.height && row.status === "valido");
  if (!canonical) {
    return { status: "valido", supply: SEALS_PER_HEIGHT, reason: "FIRST_HEIGHT" };
  }
  return { status: "azzerato", supply: SECOND_MINT_SUPPLY, reason: "SECOND_MINT_ZEROED" };
}

// Il primo genesis di un ticker è l'unica definizione.
// Ogni iscrizione successiva dello stesso ticker è un mint azzerato.
export function classify(prior, tick, op) {
  const ticker = checkTicker(tick);
  if (!ticker.ok) {
    return { status: "rifiutato", supply: 0, cap: 0, reason: ticker.reason };
  }
  const canonical = prior.find((row) => row.tick === ticker.tick && row.status === "valido");
  if (!canonical && op === "genesis") {
    return { status: "valido", supply: CAP, cap: CAP, reason: "FIRST_GENESIS" };
  }
  return {
    status: "azzerato",
    supply: SECOND_MINT_SUPPLY,
    cap: 0,
    reason: "SECOND_MINT_ZEROED",
  };
}
