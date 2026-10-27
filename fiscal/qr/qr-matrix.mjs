/**
 * Renderizador QR local, sin red y sin dependencias externas.
 *
 * Implementa byte mode, nivel de corrección M y versiones 1..10, suficiente
 * para el payload URL del QR tributario. El resultado es una matriz SVG; no
 * realiza ninguna llamada a AEAT ni cambia el estado fiscal de la venta.
 */

const RS_BLOCKS_M = [
  null,
  [[1, 26, 16]],
  [[1, 44, 28]],
  [[1, 70, 44]],
  [[2, 50, 32]],
  [[2, 33, 15], [2, 34, 16]],
  [[4, 43, 27]],
  [[4, 49, 31]],
  [[2, 60, 38], [2, 61, 39]],
  [[3, 58, 36], [2, 59, 37]],
  [[4, 69, 43], [1, 70, 44]],
];

const ALIGNMENT_POSITIONS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
];

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

function galoisMultiply(x, y) {
  let result = 0;
  while (y > 0) {
    if (y & 1) result ^= x;
    y >>>= 1;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  return result;
}

function reedSolomonDivisor(degree) {
  const result = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    result.push(0);
    for (let j = result.length - 1; j > 0; j -= 1) {
      result[j] = galoisMultiply(result[j], root) ^ result[j - 1];
    }
    result[0] = galoisMultiply(result[0], root);
    root = galoisMultiply(root, 2);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i += 1) {
      result[i] ^= galoisMultiply(divisor[i + 1], factor);
    }
  }
  return result;
}

function blocksFor(version) {
  const blocks = [];
  for (const [count, total, data] of RS_BLOCKS_M[version]) {
    for (let i = 0; i < count; i += 1) blocks.push({ total, data });
  }
  return blocks;
}

function byteData(text) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("QR_PAYLOAD_VACIO");
  }
  return [...new TextEncoder().encode(text)];
}

function appendBits(target, value, length) {
  if (length < 0 || length > 31 || value >>> length !== 0) {
    throw new Error("QR_BITS_INVALIDOS");
  }
  for (let i = length - 1; i >= 0; i -= 1) target.push((value >>> i) & 1);
}

function chooseVersion(bytes) {
  for (let version = 1; version <= 10; version += 1) {
    const capacity = blocksFor(version).reduce((sum, block) => sum + block.data, 0);
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= capacity * 8) return version;
  }
  throw new Error("QR_PAYLOAD_DEMASIADO_LARGO");
}

function makeCodewords(bytes, version) {
  const blocks = blocksFor(version);
  const capacity = blocks.reduce((sum, block) => sum + block.data, 0);
  const countBits = version < 10 ? 8 : 16;
  if (bytes.length >= 1 << countBits) throw new Error("QR_PAYLOAD_DEMASIADO_LARGO");

  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, countBits);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0xec; codewords.length < capacity; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }

  const dataBlocks = [];
  const errorBlocks = [];
  let offset = 0;
  let maxData = 0;
  let maxError = 0;
  for (const block of blocks) {
    const data = codewords.slice(offset, offset + block.data);
    offset += block.data;
    const error = reedSolomonRemainder(data, reedSolomonDivisor(block.total - block.data));
    dataBlocks.push(data);
    errorBlocks.push(error);
    maxData = Math.max(maxData, data.length);
    maxError = Math.max(maxError, error.length);
  }
  const result = [];
  for (let i = 0; i < maxData; i += 1) dataBlocks.forEach((block) => block[i] !== undefined && result.push(block[i]));
  for (let i = 0; i < maxError; i += 1) errorBlocks.forEach((block) => block[i] !== undefined && result.push(block[i]));
  return result;
}

function newMatrix(version) {
  const size = version * 4 + 17;
  return {
    size,
    modules: Array.from({ length: size }, () => Array(size).fill(false)),
    functionModules: Array.from({ length: size }, () => Array(size).fill(false)),
  };
}

function setFunction(matrix, row, col, value) {
  if (row < 0 || row >= matrix.size || col < 0 || col >= matrix.size) return;
  matrix.modules[row][col] = Boolean(value);
  matrix.functionModules[row][col] = true;
}

function drawFinder(matrix, row, col) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const edge = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const black = edge && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setFunction(matrix, row + dy, col + dx, black);
    }
  }
}

function drawAlignment(matrix, row, col) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      setFunction(matrix, row + dy, col + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(matrix, mask) {
  let data = mask;
  let remainder = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((remainder >>> i) & 1) remainder ^= 0x537 << (i - 10);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;
  for (let i = 0; i <= 5; i += 1) setFunction(matrix, i, 8, (bits >>> i) & 1);
  setFunction(matrix, 7, 8, (bits >>> 6) & 1);
  setFunction(matrix, 8, 8, (bits >>> 7) & 1);
  setFunction(matrix, 8, 7, (bits >>> 8) & 1);
  for (let i = 9; i < 15; i += 1) setFunction(matrix, 8, 14 - i, (bits >>> i) & 1);
  for (let i = 0; i < 8; i += 1) setFunction(matrix, 8, matrix.size - 1 - i, (bits >>> i) & 1);
  for (let i = 8; i < 15; i += 1) setFunction(matrix, matrix.size - 15 + i, 8, (bits >>> i) & 1);
  setFunction(matrix, matrix.size - 8, 8, true);
}

function drawVersionBits(matrix, version) {
  if (version < 7) return;
  let remainder = version << 12;
  for (let i = 0; i < 12; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  const bits = (version << 12) | (remainder & 0xfff);
  for (let i = 0; i < 18; i += 1) {
    const bit = (bits >>> i) & 1;
    const row = Math.floor(i / 3);
    const col = i % 3 + matrix.size - 11;
    setFunction(matrix, row, col, bit);
    setFunction(matrix, col, row, bit);
  }
}

function drawFunctionPatterns(matrix, version) {
  drawFinder(matrix, 0, 0);
  drawFinder(matrix, matrix.size - 7, 0);
  drawFinder(matrix, 0, matrix.size - 7);
  for (let i = 8; i < matrix.size - 8; i += 1) {
    setFunction(matrix, 6, i, i % 2 === 0);
    setFunction(matrix, i, 6, i % 2 === 0);
  }
  const positions = ALIGNMENT_POSITIONS[version - 1] || [];
  for (const row of positions) {
    for (const col of positions) {
      if (!matrix.functionModules[row][col]) drawAlignment(matrix, row, col);
    }
  }
  setFunction(matrix, matrix.size - 8, 8, true);
  drawFormatBits(matrix, 0);
  drawVersionBits(matrix, version);
}

function drawCodewords(matrix, codewords, mask) {
  let bitIndex = 0;
  let upward = true;
  for (let right = matrix.size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let count = 0; count < matrix.size; count += 1) {
      const row = upward ? matrix.size - 1 - count : count;
      for (let offset = 0; offset < 2; offset += 1) {
        const col = right - offset;
        if (matrix.functionModules[row][col]) continue;
        const bit = bitIndex < codewords.length * 8 ? ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0 : false;
        matrix.modules[row][col] = Boolean(bit ^ MASKS[mask](row, col));
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function penalty(matrix) {
  let score = 0;
  const size = matrix.size;
  const get = (r, c) => matrix.modules[r][c];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (r + 1 < size && c + 1 < size && get(r, c) === get(r + 1, c) && get(r, c) === get(r, c + 1) && get(r, c) === get(r + 1, c + 1)) score += 3;
    }
  }
  const scan = (values) => {
    let run = 1;
    for (let i = 1; i <= values.length; i += 1) {
      if (i < values.length && values[i] === values[i - 1]) run += 1;
      else {
        if (run >= 5) score += 3 + run - 5;
        run = 1;
      }
    }
  };
  for (let r = 0; r < size; r += 1) scan(matrix.modules[r]);
  for (let c = 0; c < size; c += 1) scan(Array.from({ length: size }, (_v, r) => matrix.modules[r][c]));
  const pattern = [true, false, true, true, true, false, true];
  const match = (values, start) => pattern.every((value, i) => values[start + i] === value);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c <= size - 7; c += 1) {
      if (match(matrix.modules[r], c)) score += 40;
    }
  }
  for (let c = 0; c < size; c += 1) {
    for (let r = 0; r <= size - 7; r += 1) {
      if (match(Array.from({ length: 7 }, (_v, i) => matrix.modules[r + i][c]), 0)) score += 40;
    }
  }
  const dark = matrix.modules.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}

function cloneMatrix(matrix) {
  return {
    size: matrix.size,
    modules: matrix.modules.map((row) => row.slice()),
    functionModules: matrix.functionModules.map((row) => row.slice()),
  };
}

export function encodeQrMatrix(text) {
  const bytes = byteData(text);
  const version = chooseVersion(bytes);
  const codewords = makeCodewords(bytes, version);
  let best = null;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = newMatrix(version);
    drawFunctionPatterns(candidate, version);
    drawCodewords(candidate, codewords, mask);
    drawFormatBits(candidate, mask);
    const score = penalty(candidate);
    if (!best || score < best.score) best = { matrix: candidate, score, mask };
  }
  return Object.freeze({ version, mask: best.mask, size: best.matrix.size, modules: best.matrix.modules.map((row) => Object.freeze(row.slice())) });
}

export function renderQrSvg(text, { quietZone = 4 } = {}) {
  if (!Number.isInteger(quietZone) || quietZone < 2 || quietZone > 16) throw new Error("QR_QUIET_ZONE_INVALIDA");
  const qr = encodeQrMatrix(text);
  const view = qr.size + quietZone * 2;
  const rectangles = [];
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (qr.modules[row][col]) rectangles.push(`<rect x="${col + quietZone}" y="${row + quietZone}" width="1" height="1"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" role="img" aria-label="QR tributario" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><g fill="#000">${rectangles.join("")}</g></svg>`;
}
