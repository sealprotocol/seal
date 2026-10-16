import { classify, classifyHeight } from "./rules.js?v=3";

export function createIndex(rows = []) {
  return { rows: rows.map((row) => ({ ...row })) };
}

export function inscribe(index, input) {
  const prior = index.rows;
  const decision = classify(prior, input.tick, input.op);
  const row = {
    id: input.id,
    tick: String(input.tick ?? "").trim().toLowerCase(),
    op: input.op,
    height: input.height,
    at: input.at,
    status: decision.status,
    supply: decision.supply,
    cap: decision.cap,
    reason: decision.reason,
  };
  return { index: { rows: [...prior, row] }, row };
}

export function claimHeight(index, input) {
  const decision = classifyHeight(index.rows, input.heightKey);
  const row = {
    id: input.id,
    kind: "seal",
    heightKey: String(input.heightKey ?? "").trim(),
    op: "claim",
    height: input.blockHeight,
    at: input.at,
    status: decision.status,
    supply: decision.supply,
    cap: decision.supply,
    reason: decision.reason,
  };
  return { index: { rows: [...index.rows, row] }, row };
}

export function searchTicker(index, tick) {
  const name = String(tick ?? "").trim().toLowerCase();
  const rows = index.rows.filter((row) => row.tick === name);
  const canonical = rows.find((row) => row.status === "valido") ?? null;
  const zeroed = rows.filter((row) => row.status !== "valido");
  return { tick: name, canonical, zeroed, rows };
}
