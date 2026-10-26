(function installFiscalQr(global) {
  "use strict";

  // QR Model 2, byte mode, error correction M. This is deliberately local:
  // the URL is supplied by the QA fiscal RPC and is never replaced by an
  // external image. The QR is a rendering of the server contract, not proof
  // of a production AEAT submission.
  const RS_BLOCKS_M = {
    1: [{ count: 1, total: 26, data: 16 }],
    2: [{ count: 1, total: 44, data: 28 }],
    3: [{ count: 1, total: 70, data: 44 }],
    4: [{ count: 2, total: 50, data: 32 }],
    5: [{ count: 2, total: 67, data: 43 }],
    6: [{ count: 4, total: 43, data: 27 }],
    7: [{ count: 4, total: 49, data: 31 }],
    8: [{ count: 2, total: 60, data: 38 }, { count: 2, total: 61, data: 39 }],
    9: [{ count: 3, total: 58, data: 36 }, { count: 2, total: 59, data: 37 }],
    10: [{ count: 4, total: 69, data: 43 }, { count: 1, total: 70, data: 44 }]
  };
  const ALIGNMENT_POSITIONS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  const EXP = new Array(512);
  const LOG = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < EXP.length; i += 1) EXP[i] = EXP[i - 255];

  function gfMultiply(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function appendBits(bits, value, length) {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  }

  function bytesFor(value) {
    const input = String(value);
    if (typeof TextEncoder === "function") return Array.from(new TextEncoder().encode(input));
    const encoded = unescape(encodeURIComponent(input));
    return Array.from(encoded, (char) => char.charCodeAt(0));
  }

  function buildDataCodewords(bytes, version, dataCodewords) {
    const bits = [];
    appendBits(bits, 4, 4); // byte mode
    appendBits(bits, bytes.length, version < 10 ? 8 : 16);
    bytes.forEach((byte) => appendBits(bits, byte, 8));
    const capacity = dataCodewords * 8;
    if (bits.length > capacity) throw new Error("qr_payload_too_long");
    appendBits(bits, 0, Math.min(4, capacity - bits.length));
    while (bits.length % 8) bits.push(0);
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
      out.push(byte);
    }
    let pad = 0;
    while (out.length < dataCodewords) out.push((pad++ % 2) ? 0x11 : 0xec);
    return out;
  }

  function reedSolomon(data, ecLength) {
    let generator = [1];
    for (let i = 0; i < ecLength; i += 1) {
      const next = new Array(generator.length + 1).fill(0);
      for (let j = 0; j < generator.length; j += 1) {
        next[j] ^= generator[j];
        next[j + 1] ^= gfMultiply(generator[j], EXP[i]);
      }
      generator = next;
    }
    const remainder = new Array(ecLength).fill(0);
    data.forEach((value) => {
      const factor = value ^ remainder[0];
      remainder.shift();
      remainder.push(0);
      if (!factor) return;
      for (let i = 0; i < ecLength; i += 1) remainder[i] ^= gfMultiply(generator[i + 1], factor);
    });
    return remainder;
  }

  function interleaveCodewords(dataCodewords, version) {
    const blocks = [];
    let offset = 0;
    RS_BLOCKS_M[version].forEach((group) => {
      for (let i = 0; i < group.count; i += 1) {
        const data = dataCodewords.slice(offset, offset + group.data);
        offset += group.data;
        blocks.push({ data, ec: reedSolomon(data, group.total - group.data) });
      }
    });
    const interleaved = [];
    const maxData = Math.max(...blocks.map((block) => block.data.length));
    for (let i = 0; i < maxData; i += 1) blocks.forEach((block) => { if (i < block.data.length) interleaved.push(block.data[i]); });
    const maxEc = Math.max(...blocks.map((block) => block.ec.length));
    for (let i = 0; i < maxEc; i += 1) blocks.forEach((block) => { if (i < block.ec.length) interleaved.push(block.ec[i]); });
    return interleaved;
  }

  function setModule(matrix, row, col, value) {
    if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) matrix[row][col] = !!value;
  }

  function drawFinder(matrix, row, col) {
    for (let r = -1; r <= 7; r += 1) for (let c = -1; c <= 7; c += 1) {
      const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      setModule(matrix, row + r, col + c, dark);
    }
  }

  function drawAlignment(matrix, row, col) {
    for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) {
      if (matrix[row + r]?.[col + c] !== null && matrix[row + r]?.[col + c] !== undefined) return;
    }
    for (let r = -2; r <= 2; r += 1) for (let c = -2; c <= 2; c += 1) setModule(matrix, row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  }

  function reserveFormatAndVersion(matrix, version) {
    const size = matrix.length;
    for (let i = 0; i < 15; i += 1) {
      if (i < 6) matrix[i][8] = false;
      else if (i < 8) matrix[i + 1][8] = false;
      else matrix[size - 15 + i][8] = false;
      if (i < 8) matrix[8][size - i - 1] = false;
      else if (i < 9) matrix[8][15 - i] = false;
      else matrix[8][15 - i - 1] = false;
    }
    matrix[size - 8][8] = true;
    if (version >= 7) {
      for (let i = 0; i < 18; i += 1) {
        matrix[Math.floor(i / 3)][i % 3 + size - 11] = false;
        matrix[i % 3 + size - 11][Math.floor(i / 3)] = false;
      }
    }
  }

  function baseMatrix(version) {
    const size = 17 + version * 4;
    const matrix = Array.from({ length: size }, () => Array(size).fill(null));
    drawFinder(matrix, 0, 0);
    drawFinder(matrix, size - 7, 0);
    drawFinder(matrix, 0, size - 7);
    for (let i = 8; i < size - 8; i += 1) {
      if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
      if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
    }
    const positions = ALIGNMENT_POSITIONS[version] || [];
    positions.forEach((row) => positions.forEach((col) => drawAlignment(matrix, row, col)));
    reserveFormatAndVersion(matrix, version);
    if (version >= 7) {
      let bits = version;
      for (let i = 0; i < 12; i += 1) bits = (bits << 1) ^ (((bits >>> 11) & 1) ? 0x1f25 : 0);
      const versionBits = (version << 12) | (bits & 0xfff);
      for (let i = 0; i < 18; i += 1) {
        const dark = ((versionBits >>> i) & 1) === 1;
        matrix[Math.floor(i / 3)][i % 3 + size - 11] = dark;
        matrix[i % 3 + size - 11][Math.floor(i / 3)] = dark;
      }
    }
    return matrix;
  }

  function maskApplies(mask, row, col) {
    if (mask === 0) return (row + col) % 2 === 0;
    if (mask === 1) return row % 2 === 0;
    if (mask === 2) return col % 3 === 0;
    if (mask === 3) return (row + col) % 3 === 0;
    if (mask === 4) return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    if (mask === 5) return (row * col) % 2 + (row * col) % 3 === 0;
    if (mask === 6) return ((row * col) % 2 + (row * col) % 3) % 2 === 0;
    return ((row + col) % 2 + (row * col) % 3) % 2 === 0;
  }

  function placeData(matrix, codewords, mask) {
    const bits = [];
    codewords.forEach((byte) => appendBits(bits, byte, 8));
    let bitIndex = 0;
    let upward = true;
    for (let col = matrix.length - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (let step = 0; step < matrix.length; step += 1) {
        const row = upward ? matrix.length - 1 - step : step;
        for (let c = 0; c < 2; c += 1) {
          const currentCol = col - c;
          if (matrix[row][currentCol] !== null) continue;
          const value = bitIndex < bits.length ? bits[bitIndex++] === 1 : false;
          matrix[row][currentCol] = maskApplies(mask, row, currentCol) ? !value : value;
        }
      }
      upward = !upward;
    }
    if (bitIndex !== bits.length) throw new Error("qr_data_placement_incomplete");
  }

  function bchTypeInfo(value) {
    let data = value << 10;
    while (dataBits(data) - dataBits(0x537) >= 0) data ^= 0x537 << (dataBits(data) - dataBits(0x537));
    return ((value << 10) | data) ^ 0x5412;
  }

  function dataBits(value) {
    let bits = 0;
    while (value) { bits += 1; value >>>= 1; }
    return bits;
  }

  function applyFormat(matrix, mask) {
    const bits = bchTypeInfo(mask);
    const size = matrix.length;
    for (let i = 0; i < 15; i += 1) {
      const dark = ((bits >>> i) & 1) === 1;
      if (i < 6) matrix[i][8] = dark;
      else if (i < 8) matrix[i + 1][8] = dark;
      else matrix[size - 15 + i][8] = dark;
      if (i < 8) matrix[8][size - i - 1] = dark;
      else if (i < 9) matrix[8][15 - i] = dark;
      else matrix[8][15 - i - 1] = dark;
    }
    matrix[size - 8][8] = true;
  }

  function penalty(matrix) {
    const size = matrix.length;
    let score = 0;
    const linePenalty = (line) => {
      let runColor = line[0];
      let run = 1;
      for (let i = 1; i < line.length; i += 1) {
        if (line[i] === runColor) run += 1;
        else { if (run >= 5) score += 3 + run - 5; runColor = line[i]; run = 1; }
      }
      if (run >= 5) score += 3 + run - 5;
      const pattern = line.map((value) => value ? 1 : 0).join("");
      for (let i = 0; i <= pattern.length - 11; i += 1) {
        const part = pattern.slice(i, i + 11);
        if (part === "10111010000" || part === "00001011101") score += 40;
      }
    };
    for (let i = 0; i < size; i += 1) {
      linePenalty(matrix[i]);
      linePenalty(matrix.map((row) => row[i]));
    }
    for (let r = 0; r < size - 1; r += 1) for (let c = 0; c < size - 1; c += 1) {
      const value = matrix[r][c];
      if (matrix[r + 1][c] === value && matrix[r][c + 1] === value && matrix[r + 1][c + 1] === value) score += 3;
    }
    let dark = 0;
    matrix.forEach((row) => row.forEach((value) => { if (value) dark += 1; }));
    score += Math.floor(Math.abs((dark * 100 / (size * size)) - 50) / 5) * 10;
    return score;
  }

  function encode(url) {
    const bytes = bytesFor(url);
    let version = 1;
    while (version <= 10) {
      const dataCodewords = RS_BLOCKS_M[version].reduce((sum, group) => sum + group.count * group.data, 0);
      if (bytes.length + (version < 10 ? 2 : 3) <= dataCodewords) break;
      version += 1;
    }
    if (version > 10) throw new Error("qr_payload_too_long");
    const dataCodewords = RS_BLOCKS_M[version].reduce((sum, group) => sum + group.count * group.data, 0);
    const codewords = interleaveCodewords(buildDataCodewords(bytes, version, dataCodewords), version);
    let best = null;
    for (let mask = 0; mask < 8; mask += 1) {
      const matrix = baseMatrix(version);
      placeData(matrix, codewords, mask);
      applyFormat(matrix, mask);
      const score = penalty(matrix);
      if (!best || score < best.score) best = { matrix, score };
    }
    return best.matrix;
  }

  function svgForUrl(url, options) {
    const value = String(url || "").trim();
    if (!value) throw new Error("qr_url_required");
    const matrix = encode(value);
    const size = matrix.length;
    const pixels = Number(options?.size) || 220;
    const quiet = 4;
    let path = "";
    matrix.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }));
    const fullSize = size + quiet * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${pixels}" height="${pixels}" role="img" aria-label="Código QR fiscal"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  global.LA_FISCAL_QR = { svgForUrl };
})(typeof globalThis !== "undefined" ? globalThis : window);
