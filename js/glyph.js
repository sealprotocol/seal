// Ricetta del sigillo. Stessa per ogni atomo. Cambia solo l'hash del blocco.
// Griglia 9×9, metà sinistra letta dai bit dell'hash, metà destra specchiata.

const GRID = 9;

function bitsFromHash(hash) {
  // La coda dell'hash mostrato da Bitcoin è la parte uniforme.
  // L'inizio sono gli zeri della proof-of-work: lì il segno uscirebbe vuoto.
  const clean = hash.trim().toLowerCase().slice(-16);
  const bits = [];
  for (let i = 0; i < clean.length; i += 1) {
    const value = Number.parseInt(clean[i], 16);
    if (Number.isNaN(value)) continue;
    bits.push((value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1);
  }
  return bits;
}

export function figureBits(hash) {
  return bitsFromHash(hash).slice(0, GRID * 5);
}

function litCells(hash) {
  const bits = bitsFromHash(hash);
  const cells = new Set();
  let cursor = 0;
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      if (bits[cursor] !== 1) {
        cursor += 1;
        continue;
      }
      cells.add(`${x},${y}`);
      cells.add(`${GRID - 1 - x},${y}`);
      cursor += 1;
    }
  }
  return cells;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// L'arco è il minuto del timestamp: quanto è avanti il blocco dentro l'ora.
function timeArc(timestamp) {
  const minute = (Number(timestamp) % 3600) / 3600;
  const start = -Math.PI / 2;
  const end = start + Math.max(minute, 0.04) * Math.PI * 2;
  const x1 = 80 + Math.cos(start) * 72;
  const y1 = 80 + Math.sin(start) * 72;
  const x2 = 80 + Math.cos(end) * 72;
  const y2 = 80 + Math.sin(end) * 72;
  const large = minute > 0.5 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A 72 72 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export function glyphSvg(block) {
  const cells = litCells(block.id);
  const origin = 28;
  const step = 14;
  const marks = [...cells].map((key) => {
    const [x, y] = key.split(",").map(Number);
    const cx = origin + x * step + 6;
    const cy = origin + y * step + 6;
    return `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" rx="1" fill="#f7931a"/>`;
  }).join("");

  const tx = clamp(Number(block.tx_count) || 1, 1, 7000);
  const half = 8 + ((tx - 1) / 6999) * 54;
  const rings = subsidyRings(block.height);
  const innerRings = Array.from({ length: rings - 1 }, (_, index) => {
    const radius = 60 - index * 10;
    return `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="#c9a227" stroke-width="1.5"/>`;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 160 160" role="img" aria-label="Seal of the block">
      <rect width="160" height="160" fill="#171b22"/>
      <circle cx="80" cy="80" r="72" fill="none" stroke="#3a2a16" stroke-width="2"/>
      ${innerRings}
      <path d="${timeArc(block.timestamp)}" fill="none" stroke="#f7931a" stroke-width="3" stroke-linecap="round"/>
      <line x1="80" y1="${(80 - half).toFixed(1)}" x2="80" y2="${(80 + half).toFixed(1)}" stroke="#c9a227" stroke-width="2"/>
      ${marks}
    </svg>
  `;
}

function subsidyRings(height) {
  const era = Math.floor(Number(height) / 210000);
  return Math.max(1, 5 - era);
}
