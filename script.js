// script.js

// ─────────────────────────────────────────────────────────────────
// Helper: parse number strings (strip non-digits except . and -)
function parseNum(str) {
  if (str == null) return NaN;
  return parseFloat(String(str).replace(/[^\d.\-]/g, ''));
}

// Global state
let allData = [];
let playerName = "";
const COL = {};      // dynamic column map
let COLOR_MAP = {};  // per-pitch-type colors

// ─────────────────────────────────────────────────────────────────
// 1) Detect actual CSV headers from first row
function initColumnKeys(sample) {
  const keys = Object.keys(sample);

  COL.batter    = keys.find(k => /batter/i.test(k) && !/name/i.test(k));
  COL.pitcher   = keys.find(k => /pitcher/i.test(k) && !/count/i.test(k));
  COL.pitch     = keys.find(k => /^pitch$/i.test(k));
  COL.result    = keys.find(k => /result/i.test(k));
  COL.pitchType = keys.find(k => /pitch\s*type/i.test(k));

  COL.runner1 = keys.find(k => /runner[_ ]?1b/i.test(k));
  COL.runner2 = keys.find(k => /runner[_ ]?2b/i.test(k));
  COL.runner3 = keys.find(k => /runner[_ ]?3b/i.test(k));

  COL.hand = keys.find(k => /handedness/i.test(k) || /pitcher_throw/i.test(k));

  COL.exitVel = keys.find(k => /exit\s*velocity/i.test(k));

  // SUPER-ROBUST launch-angle detection:
  const norm = k => k.replace(/[^\w]/g, '').toLowerCase();
  COL.launchAng =
    keys.find(k => norm(k).includes('launchangle')) ||
    keys.find(k => /launch.*angle/i.test(k)) ||
    keys.find(k => /launch/i.test(k));

  COL.hitType  = keys.find(k => /hit\s*type/i.test(k));
  COL.distance = keys.find(k => /distance/i.test(k));

  COL.locX = keys.find(k => /location.*side/i.test(k));
  COL.locY = keys.find(k => /location.*height/i.test(k));

  COL.relX     = keys.find(k => /release.*side/i.test(k));
  COL.relY     = keys.find(k => /release.*height/i.test(k));
  COL.sumHoriz = keys.find(k => /movement.*horizontal/i.test(k));
  COL.sumVert  = keys.find(k => /induced.*vertical/i.test(k));

  // Fallback exact names
  if (!COL.relX && keys.includes('Release Side (ft)'))       COL.relX = 'Release Side (ft)';
  if (!COL.relY && keys.includes('Release Height (ft)'))     COL.relY = 'Release Height (ft)';

  console.log('Mapped columns:', COL);
}

// ─────────────────────────────────────────────────────────────────
// 2) Fetch & parse all CSVs in /data/, trim keys/values, parse dates
async function fetchAllCSVs() {
  // 1) If we already loaded once, return the cache immediately
  if (allData.length) return allData;

  // 2) Load the manifest of CSV filenames
  const files = await fetch('data/files.json')
                      .then(r => {
                        if (!r.ok) throw new Error(`Cannot load manifest: ${r.status}`);
                        return r.json();
                      });

  const year = new Date().getFullYear();
  let rows = [];

  // 3) For each filename in the manifest...
  for (const f of files) {
    // 3a) Fetch the raw CSV text
    const txt = await fetch(`data/${f}`)
                      .then(r => {
                        if (!r.ok) throw new Error(`Failed to fetch CSV ${f}: ${r.status}`);
                        return r.text();
                      });

    // 3b) Parse into objects
    const parsed = Papa.parse(txt, {
      header: true,
      skipEmptyLines: true
    }).data;

    // 3c) Trim keys & values, and attach a Date from the filename
    parsed.forEach(r => {
      Object.keys(r).forEach(k => {
        const tk = k.trim(), v = r[k];
        delete r[k];
        r[tk] = typeof v === 'string' ? v.trim() : v;
      });
      const m = f.match(/^(\d{2})-(\d{2})/);
      r.__gameDate = m
        ? new Date(year, +m[1] - 1, +m[2])
        : null;
    });

    // 3d) Accumulate all rows
    rows.push(...parsed);
  }

  // 4) Initialize column mappings on the very first row
  if (rows.length) initColumnKeys(rows[0]);

  // 5) Cache and return
  allData = rows;
  return allData;
}


// ─────────────────────────────────────────────────────────────────
// INDEX PAGE FUNCTIONS
// ─────────────────────────────────────────────────────────────────

// Populate player dropdown without duplicates
async function loadPlayerOptions() {
  const sel = document.getElementById('playerSelect');
  if (!sel) return;
  sel.innerHTML = `<option value="">-- Select Player --</option>`;

  const data = await fetchAllCSVs();
  const names = [...new Set(data.map(d => d[COL.batter]).filter(Boolean))];
  names.forEach(n => sel.append(new Option(n, n)));
}

// Navigate to dashboard for selected player
function goToDashboard() {
  const sel = document.getElementById('playerSelect');
  if (sel && sel.value) {
    window.location.href = `dashboard.html?player=${encodeURIComponent(sel.value)}`;
  }
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD PAGE FUNCTIONS
// ─────────────────────────────────────────────────────────────────

async function startDashboard() {
  const hdr = document.getElementById('playerName');
  if (!hdr) return;  // not on dashboard.html

  if (!allData.length) allData = await fetchAllCSVs();

  playerName = new URLSearchParams(location.search).get('player') || '';
  hdr.textContent = playerName;

  setupFilters();

  // Guarded Show-All checkbox listener
  const sa = document.getElementById('showAllDates');
  if (sa) {
    sa.addEventListener('change', () => {
      document.getElementById('startDate').disabled = sa.checked;
      document.getElementById('endDate').disabled   = sa.checked;
      applyFilters();
    });
  }

  applyFilters();
}

function setupFilters() {
  const data = allData.filter(d => d[COL.batter] === playerName);

  // Pitcher filter
  const ps = document.getElementById('pitcherFilter');
  ps.innerHTML = `<option value="">All</option>`;
  [...new Set(data.map(d => d[COL.pitcher]).filter(Boolean))]
    .forEach(p => ps.append(new Option(p, p)));

  // Pitch Type filter
  const pt = document.getElementById('pitchTypeFilter');
  pt.innerHTML = `<option value="">All</option>`;
  [...new Set(data.map(d => d[COL.pitchType]).filter(Boolean))]
    .forEach(t => pt.append(new Option(t, t)));
}

function applyFilters() {
  let f = allData.filter(d => d[COL.batter] === playerName);

  const sa = document.getElementById('showAllDates');
  if (!sa.checked) {
    const sv = document.getElementById('startDate').value;
    if (sv) f = f.filter(d => d.__gameDate >= new Date(sv));
    const ev = document.getElementById('endDate').value;
    if (ev) f = f.filter(d => d.__gameDate <= new Date(ev));
  }

  const hand = document.getElementById('handFilter').value;
  if (hand) f = f.filter(d => d[COL.hand] === hand);

  const runVal = document.getElementById('runnersFilter').value;
  if (runVal === 'true') {
    f = f.filter(d => d[COL.runner1] === '1' || d[COL.runner2] === '1' || d[COL.runner3] === '1');
  }

  const pit = document.getElementById('pitcherFilter').value;
  if (pit) f = f.filter(d => d[COL.pitcher] === pit);

  const ptVal = document.getElementById('pitchTypeFilter').value;
  if (ptVal) f = f.filter(d => d[COL.pitchType] === ptVal);

  plotPlate(f);
}

// ─────────────────────────────────────────────────────────────────
// Plate chart + legend + table + trajectory
function plotPlate(data) {
  if (!data.length) {
    document.getElementById('plateChart').innerHTML = '<em>No data</em>';
    return;
  }

  // Number batted balls
  let hitNum = 0;
  data.forEach(d => {
    const ev = parseNum(d[COL.exitVel]), la = parseNum(d[COL.launchAng]);
    d.__hitNumber = (!isNaN(ev) && !isNaN(la)) ? ++hitNum : null;
  });

  // Swing vs Took logic
  function isSwing(d) {
    const res = (d[COL.result] || '').toLowerCase(),
          pit = (d[COL.pitch]  || '').toLowerCase();
    if (res.includes("walk")) return false;
    if (pit === "swinging strike" || pit === "foul") return true;
    if (res && res !== "strike out") return true;
    return false;
  }

  // Color map per pitch type
  const types = [...new Set(data.map(d => d[COL.pitchType]))];
  COLOR_MAP = {};
  types.forEach((t, i) => COLOR_MAP[t] = `hsl(${(i*45)%360},70%,50%)`);

  // Hover text
  const hover = data.map(d =>
    `Pitch Type: ${d[COL.pitchType]}<br>` +
    `Pitch: ${d[COL.pitch]}<br>` +
    `Result: ${d[COL.result]}<br>` +
    `Pitcher: ${d[COL.pitcher]}`
  );

  // Plotly trace
  const trace = {
    x: data.map(d => parseNum(d[COL.locX])),
    y: data.map(d => parseNum(d[COL.locY])),
    text: data.map(d => d.__hitNumber || ''),
    textposition: 'middle center',
    mode: 'markers+text',
    type: 'scatter',
    marker: {
      size: 12,
      symbol: data.map(d => isSwing(d) ? 'square' : 'circle'),
      color: data.map(d => COLOR_MAP[d[COL.pitchType]] || 'gray'),
      line: { color: 'black', width: 1 }
    },
    hoverinfo: 'text',
    hovertext: hover
  };

  const layout = {
    title: 'Plate Location (Squares=Swung, Circles=Took)',
    height: 750,
    xaxis: { title: 'Horizontal (ft)', range: [-1.5, 1.5] },
    yaxis: { title: 'Vertical (ft)',   range: [0.25, 5]   },
    shapes: [{
      type: 'rect', x0: -0.708, x1: 0.708,
      y0: 1.5,      y1: 3.5,
      line: { color: 'black' }
    }],
    clickmode: 'event+select'
  };

  Plotly.newPlot('plateChart', [trace], layout);
  renderLegends(types);
  renderTable(data);

  document.getElementById('plateChart')
    .on('plotly_click', e => plotTrajectory(e.points[0].customdata));
}

function renderLegends(types) {
  const div = document.getElementById('legendDiv');
  div.innerHTML = `<strong>Pitch Types:</strong><br>`;
  types.forEach(t => {
    div.innerHTML +=
      `<span style="display:inline-block;width:12px;height:12px;
                   background:${COLOR_MAP[t]};margin-right:5px;
                   vertical-align:middle;"></span>${t}<br>`;
  });
  div.innerHTML += `<br><strong>Action:</strong><br>` +
    `<span style="display:inline-block;width:12px;height:12px;
                  border:2px solid black;margin-right:5px;
                  vertical-align:middle;"></span>Swung<br>` +
    `<span style="display:inline-block;width:12px;height:12px;
                  border:2px solid black;border-radius:50%;
                  margin-right:5px;vertical-align:middle;"></span>Took`;
}

function renderTable(data) {
  const rows = data.filter(d => d.__hitNumber)
                   .sort((a,b) => a.__hitNumber - b.__hitNumber);
  const div = document.getElementById('battedBallTable');
  if (!rows.length) {
    div.innerHTML = '<em>No batted-ball data</em>';
    return;
  }
  let html = `<table><thead><tr>
    <th>#</th><th>${COL.hitType}</th><th>${COL.exitVel}</th>
    <th>${COL.launchAng}</th><th>${COL.distance}</th><th>${COL.result}</th>
  </tr></thead><tbody>`;
  rows.forEach(d => {
    html += `<tr>
      <td>${d.__hitNumber}</td>
      <td>${d[COL.hitType]  || ''}</td>
      <td>${parseNum(d[COL.exitVel])}</td>
      <td>${parseNum(d[COL.launchAng])}</td>
      <td>${parseNum(d[COL.distance]) || ''}</td>
      <td>${d[COL.result]   || ''}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  div.innerHTML = html;
}

function plotTrajectory(d) {
  const fr = 50,
        rx = parseNum(d[COL.relX]), ry = parseNum(d[COL.relY]),
        px = parseNum(d[COL.locX]), py = parseNum(d[COL.locY]),
        dx = parseNum(d[COL.sumHoriz]) / 12,
        dy = parseNum(d[COL.sumVert ]) / 12;
  const xs = [], ys = [];
  for (let i = 0; i < fr; i++) {
    const t = i/(fr-1), ang = Math.PI*t;
    xs.push(rx + (px-rx)*t + Math.cos(ang)*dx);
    ys.push(ry + (py-ry)*t + Math.sin(ang)*dy);
  }
  Plotly.newPlot('trajectoryChart', [{
    x: xs, y: ys, mode: 'lines', type: 'scatter',
    line: { color: COLOR_MAP[d[COL.pitchType]] || 'gray', width: 2 }
  }], {
    title: `Trajectory for ${d[COL.pitchType]}`,
    xaxis: { title: 'Horizontal (ft)' },
    yaxis: { title: 'Vertical (ft)', scaleanchor: 'x', scaleratio: 1 },
    shapes: [{
      type: 'rect', x0: -0.71, x1: 0.71, y0: 1.5, y1: 3.5,
      line: { color: 'green', width: 2 }
    }]
  });
}

// ─────────────────────────────────────────────────────────────────
// LEADERBOARDS FUNCTIONS
// ─────────────────────────────────────────────────────────────────

async function startLeaderboards() {
  await fetchAllCSVs();
  const bf = document.getElementById('leaderBatterFilter');
  bf.innerHTML = `<option value="">All</option>`;
  const batters = [...new Set(allData.map(d => d[COL.batter]).filter(Boolean))];
  batters.forEach(b => bf.append(new Option(b, b)));
  bf.addEventListener('change', renderLeaderboards);
  renderLeaderboards();
}

function renderLeaderboards() {
  const selected = document.getElementById('leaderBatterFilter').value;
  const data = selected
    ? allData.filter(d => d[COL.batter] === selected)
    : allData;

  // ── Average Exit Velocity ──
  const evStats = {};
  allData.forEach(d => {
    const b = d[COL.batter], ev = parseNum(d[COL.exitVel]);
    if (!b || isNaN(ev)) return;
    evStats[b] = evStats[b] || { sum: 0, count: 0 };
    evStats[b].sum   += ev;
    evStats[b].count += 1;
  });
  const avgEV = Object.entries(evStats)
    .map(([b,s]) => ({ batter: b, avg: s.sum / s.count }))
    .sort((a,b) => b.avg - a.avg);
  let htmlAvg = `<thead><tr><th>Batter</th><th>Avg Exit Vel (mph)</th></tr></thead><tbody>`;
  avgEV.forEach(r => {
    htmlAvg += `<tr><td>${r.batter}</td><td>${r.avg.toFixed(1)}</td></tr>`;
  });
  htmlAvg += `</tbody>`;
  document.getElementById('leaderboard-avgexit').innerHTML = htmlAvg;

  // ── Hardest-Hit Balls ──
  const hardHits = data
    .filter(d => !isNaN(parseNum(d[COL.exitVel])))
    .map(d => ({
      batter:    d[COL.batter],
      exitVel:   parseNum(d[COL.exitVel]),
      distance:  parseNum(d[COL.distance]),
      pitcher:   d[COL.pitcher],
      pitchType: d[COL.pitchType],
      result:    d[COL.result]
    }))
    .sort((a,b) => b.exitVel - a.exitVel)
    .slice(0,10);
  let html = `<thead><tr><th>Batter</th><th>Exit Vel (mph)</th><th>Distance (ft)</th>
    <th>Pitcher</th><th>Pitch Type</th><th>Result</th></tr></thead><tbody>`;
  hardHits.forEach(r => {
    html += `<tr><td>${r.batter}</td><td>${r.exitVel.toFixed(1)}</td>
      <td>${isNaN(r.distance)?'':r.distance.toFixed(1)}</td><td>${r.pitcher}</td>
      <td>${r.pitchType}</td><td>${r.result}</td></tr>`;
  });
  html += `</tbody>`;
  document.getElementById('leaderboard-hardest').innerHTML = html;

  // ── Longest Home Runs ──
  const hrHits = data
    .filter(d => (d[COL.result]||'').toLowerCase().includes('home run'))
    .map(d => ({
      batter:    d[COL.batter],
      distance:  parseNum(d[COL.distance]),
      exitVel:   parseNum(d[COL.exitVel]),
      launchAng: parseNum(d[COL.launchAng]),
      pitcher:   d[COL.pitcher],
      pitchType: d[COL.pitchType],
      result:    d[COL.result]
    }))
    .filter(r => !isNaN(r.distance))
    .sort((a,b) => b.distance - a.distance)
    .slice(0,10);
  html = `<thead><tr><th>Batter</th><th>Distance (ft)</th><th>Exit Vel (mph)</th>
    <th>Launch Ang (°)</th><th>Pitcher</th><th>Pitch Type</th><th>Result</th></tr></thead><tbody>`;
  hrHits.forEach(r => {
    html += `<tr><td>${r.batter}</td><td>${r.distance.toFixed(1)}</td>
      <td>${isNaN(r.exitVel)?'':r.exitVel.toFixed(1)}</td>
      <td>${isNaN(r.launchAng)?'':r.launchAng.toFixed(1)}</td>
      <td>${r.pitcher}</td><td>${r.pitchType}</td><td>${r.result}</td></tr>`;
  });
  html += `</tbody>`;
  document.getElementById('leaderboard-hr').innerHTML = html;

  // ── Lowest Chase Rate ──
  const zone = { L:-0.708, R:0.708, bottom:1.5, top:3.5 };
  const stats = {};
  allData.forEach(d => {
    const x = parseNum(d[COL.locX]), y = parseNum(d[COL.locY]);
    if (isNaN(x)||isNaN(y)) return;
    if (x<zone.L||x>zone.R||y<zone.bottom||y>zone.top) {
      const b = d[COL.batter];
      stats[b] = stats[b]||{ out:0, ch:0 };
      stats[b].out++;
      const pit = (d[COL.pitch]||'').toLowerCase();
      if (pit==='swinging strike' || pit==='foul') stats[b].ch++;
    }
  });
  const arrChase = Object.entries(stats)
    .filter(([b,s]) => s.out>=10)
    .map(([b,s])=>({ player:b, rate:s.ch/s.out, outside:s.out }))
    .sort((a,b)=>a.rate - b.rate);
  html = `<thead><tr><th>Player</th><th>Chase Rate (%)</th><th>Outside Pitches</th></tr></thead><tbody>`;
  arrChase.forEach(r => {
    html += `<tr><td>${r.player}</td><td>${(r.rate*100).toFixed(1)}</td><td>${r.outside}</td></tr>`;
  });
  html += `</tbody>`;
  document.getElementById('leaderboard-chase').innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────
// Wire up on all pages
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('playerSelect')) loadPlayerOptions();
  if (location.pathname.endsWith('dashboard.html')) startDashboard();
  if (location.pathname.endsWith('leaderboard.html')) startLeaderboards();
});
