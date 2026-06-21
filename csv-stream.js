// csv-stream.js — chunked streaming CSV parser. Fixes iOS Safari "A problem
// repeatedly occurred" OOM crash on the ~50 MB data.csv.
//
// Why this exists: Papa.parse({ download: true }) downloads the entire CSV
// into a single ~50 MB JS string, then tokenizes every column (~170) for
// every row. WebKit on iPhone caps WebContent memory aggressively and kills
// the page. This parser uses fetch() + ReadableStream so chunks are consumed
// and discarded as they arrive, and a KEEP_COLS set drops unused columns at
// parse time so only what the page needs is materialized.
//
// Usage:
//   const rows = await streamParseCSV('./data.csv', KEEP_COLS, (bytes, total) => {
//     // optional progress callback
//   });
//   // or load all CSVs at once:
//   const rows = await streamLoadAllCSVs(KEEP_COLS, onProgress);
//
// KEEP_COLS: Set<string> of column names to retain. Pass null to keep all
//            (defeats the memory savings — usually you want to pass a set).
// onProgress: optional fn(bytesRead, totalBytes) — totalBytes is 0 if the
//            server omits Content-Length.

async function streamParseCSV(url, KEEP_COLS = null, onProgress = null) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const total = parseInt(res.headers.get('Content-Length') || '0', 10);

  // Browsers lacking ReadableStream (very old) fall back to whole-text parse.
  if (!res.body || typeof res.body.getReader !== 'function') {
    return _parseTextFallback(await res.text(), KEEP_COLS);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const out = [];

  let headers = null;
  let keepIdx = null;
  let field = '';
  let col = 0;
  let inQuote = false;
  let keep = true;
  let obj = null;
  let headerRow = null;
  let bytesRead = 0;

  function beginRow() {
    field = ''; col = 0;
    if (headers) { obj = {}; keep = !keepIdx || keepIdx.has(0); }
    else { headerRow = []; keep = true; }
  }
  function endField() {
    if (headers) {
      if (keep) {
        const name = keepIdx ? keepIdx.get(col) : headers[col];
        if (name) obj[name] = field.trim();
      }
    } else {
      headerRow.push(field);
    }
    field = ''; col++;
    keep = headers ? (!keepIdx || keepIdx.has(col)) : true;
  }
  function endRow() {
    endField();
    if (!headers) {
      headers = headerRow.map(h => h.trim());
      if (KEEP_COLS) {
        keepIdx = new Map();
        headers.forEach((h, i) => { if (KEEP_COLS.has(h)) keepIdx.set(i, h); });
      }
      headerRow = null;
    } else {
      out.push(obj);
      obj = null;
    }
    beginRow();
  }

  function feed(text) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { if (keep) field += '"'; i++; }
          else inQuote = false;
        } else if (keep) { field += ch; }
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ',') endField();
        else if (ch === '\n') endRow();
        else if (ch === '\r') { /* swallow; \n terminates */ }
        else if (keep) { field += ch; }
      }
    }
  }

  beginRow();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.length;
    feed(decoder.decode(value, { stream: true }));
    if (onProgress) onProgress(bytesRead, total);
  }
  feed(decoder.decode());
  if (field !== '' || col > 0) endRow();
  return out;
}

// Load BOTH data.csv + data25.csv with the same KEEP_COLS, concatenated.
// Missing files are tolerated (warned, not thrown) so a page still works if
// only one source is present.
async function streamLoadAllCSVs(KEEP_COLS = null, onProgress = null) {
  const sources = ['./data.csv', './data25.csv'];
  const results = await Promise.allSettled(sources.map(src =>
    streamParseCSV(src, KEEP_COLS,
      onProgress ? (b, t) => onProgress(src, b, t) : null)
  ));
  const out = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'fulfilled') {
      for (const r of results[i].value) out.push(r);
    } else {
      console.warn('CSV load failed:', sources[i], results[i].reason);
    }
  }
  return out;
}

// ===== fallback ===========================================================
function _parseTextFallback(text, KEEP_COLS) {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const headers = _splitCSVLine(lines[0]).map(h => h.trim());
  const keepIdx = KEEP_COLS
    ? new Map(headers.map((h, i) => [i, h]).filter(([, h]) => KEEP_COLS.has(h)))
    : null;
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = _splitCSVLine(lines[i]);
    const obj = {};
    if (keepIdx) {
      for (const [idx, name] of keepIdx) obj[name] = (cells[idx] || '').trim();
    } else {
      headers.forEach((h, idx) => { obj[h] = (cells[idx] || '').trim(); });
    }
    out.push(obj);
  }
  return out;
}

function _splitCSVLine(line) {
  const out = [];
  let f = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(f); f = ''; }
    else f += c;
  }
  out.push(f);
  return out;
}
