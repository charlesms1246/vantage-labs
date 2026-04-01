import { Router, Request, Response } from "express";
import { logger, LogEntry } from "../services/logger";

const router = Router();

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vantage Labs — Backend Logs</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #c0c0c0; font-family: 'Courier New', Courier, monospace; font-size: 13px; }
  #header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: #111; border-bottom: 1px solid #222;
    padding: 8px 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  #title { color: #00ff41; font-weight: bold; font-size: 14px; letter-spacing: 1px; }
  #live-indicator { font-size: 12px; }
  #live-indicator.live { color: #00ff41; }
  #live-indicator.disconnected { color: #ff5555; }
  #count { color: #555; font-size: 11px; margin-left: auto; }
  .btn {
    background: #1a1a1a; border: 1px solid #333; color: #aaa;
    padding: 3px 8px; cursor: pointer; font-family: inherit; font-size: 11px;
    border-radius: 2px;
  }
  .btn:hover { background: #222; color: #fff; }
  .cat-filter { }
  .cat-filter.active { border-color: #555; color: #fff; }
  .cat-filter[data-cat="WS"].active    { color: #00ffff; border-color: #00ffff44; }
  .cat-filter[data-cat="LLM"].active   { color: #ff00ff; border-color: #ff00ff44; }
  .cat-filter[data-cat="TOOL"].active  { color: #ffff00; border-color: #ffff0044; }
  .cat-filter[data-cat="ONCHAIN"].active { color: #ff8800; border-color: #ff880044; }
  .cat-filter[data-cat="IPFS"].active  { color: #4488ff; border-color: #4488ff44; }
  .cat-filter[data-cat="HTTP"].active  { color: #888888; border-color: #88888844; }
  .cat-filter[data-cat="SYSTEM"].active { color: #ffffff; border-color: #ffffff44; }
  #terminal {
    position: fixed; top: 46px; left: 0; right: 0; bottom: 0;
    overflow-y: auto; padding: 8px 12px;
  }
  .log-line { line-height: 1.6; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
  .ts { color: #444; }
  .level-INFO .level-badge { color: #00ff41; }
  .level-WARN .level-badge { color: #ffff00; }
  .level-ERROR .level-badge { color: #ff5555; }
  .cat-WS    .cat-badge { color: #00ffff; }
  .cat-LLM   .cat-badge { color: #ff00ff; }
  .cat-TOOL  .cat-badge { color: #ffff00; }
  .cat-ONCHAIN .cat-badge { color: #ff8800; }
  .cat-IPFS  .cat-badge { color: #4488ff; }
  .cat-HTTP  .cat-badge { color: #888888; }
  .cat-SYSTEM .cat-badge { color: #ffffff; }
  .msg { color: #c0c0c0; }
  .level-ERROR .msg { color: #ff8888; }
  .level-WARN  .msg { color: #ffff88; }
  .data-line { color: #555; padding-left: 20px; font-size: 11px; }
  .sep { color: #222; }
</style>
</head>
<body>
<div id="header">
  <span id="title">⬡ VANTAGE LABS LOGS</span>
  <span id="live-indicator" class="live">● LIVE</span>
  <button class="btn" id="btn-autoscroll">Auto-scroll: ON</button>
  <button class="btn" id="btn-clear">Clear</button>
  <span class="sep">|</span>
  <button class="btn cat-filter active" data-cat="ALL">ALL</button>
  <button class="btn cat-filter active" data-cat="WS">WS</button>
  <button class="btn cat-filter active" data-cat="LLM">LLM</button>
  <button class="btn cat-filter active" data-cat="TOOL">TOOL</button>
  <button class="btn cat-filter active" data-cat="ONCHAIN">ONCHAIN</button>
  <button class="btn cat-filter active" data-cat="IPFS">IPFS</button>
  <button class="btn cat-filter active" data-cat="HTTP">HTTP</button>
  <button class="btn cat-filter active" data-cat="SYSTEM">SYSTEM</button>
  <span id="count">0 entries</span>
</div>
<div id="terminal"></div>
<script>
  var autoScroll = true;
  var totalCount = 0;
  var activeFilters = new Set(['ALL','WS','LLM','TOOL','ONCHAIN','IPFS','HTTP','SYSTEM']);
  var ALL_CATS = ['WS','LLM','TOOL','ONCHAIN','IPFS','HTTP','SYSTEM'];

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    var hh = String(d.getHours()).padStart(2,'0');
    var mm = String(d.getMinutes()).padStart(2,'0');
    var ss = String(d.getSeconds()).padStart(2,'0');
    var ms = String(d.getMilliseconds()).padStart(3,'0');
    return hh+':'+mm+':'+ss+'.'+ms;
  }

  function isVisible(cat) {
    return activeFilters.has('ALL') || activeFilters.has(cat);
  }

  function appendEntry(entry) {
    totalCount++;
    document.getElementById('count').textContent = totalCount + ' entries';

    var terminal = document.getElementById('terminal');
    var line = document.createElement('div');
    line.className = 'log-line level-' + entry.level + ' cat-' + entry.category;
    line.dataset.cat = entry.category;
    if (!isVisible(entry.category)) line.style.display = 'none';

    var catPad = entry.category.padEnd(7);
    var html = '<span class="ts">' + fmtTime(entry.timestamp) + '</span>'
      + ' <span class="level-badge">[' + entry.level + ']</span>'
      + ' <span class="cat-badge">[' + catPad + ']</span>'
      + ' <span class="msg">' + escHtml(entry.message) + '</span>';
    line.innerHTML = html;

    if (entry.data !== undefined) {
      var dataEl = document.createElement('div');
      dataEl.className = 'data-line';
      try {
        dataEl.textContent = JSON.stringify(entry.data, null, 2)
          .split('\\n').map(function(l){ return '  ' + l; }).join('\\n');
      } catch(e) {
        dataEl.textContent = '  ' + String(entry.data);
      }
      line.appendChild(dataEl);
    }

    terminal.appendChild(line);
    if (autoScroll) terminal.scrollTop = terminal.scrollHeight;
  }

  var es = new EventSource('/logs/stream');
  es.onmessage = function(event) {
    try { appendEntry(JSON.parse(event.data)); } catch(e) {}
  };
  es.onerror = function() {
    var ind = document.getElementById('live-indicator');
    ind.className = 'disconnected';
    ind.textContent = '● DISCONNECTED';
  };
  es.onopen = function() {
    var ind = document.getElementById('live-indicator');
    ind.className = 'live';
    ind.textContent = '● LIVE';
  };

  document.getElementById('btn-autoscroll').addEventListener('click', function() {
    autoScroll = !autoScroll;
    this.textContent = 'Auto-scroll: ' + (autoScroll ? 'ON' : 'OFF');
    if (autoScroll) {
      var t = document.getElementById('terminal');
      t.scrollTop = t.scrollHeight;
    }
  });

  document.getElementById('btn-clear').addEventListener('click', function() {
    document.getElementById('terminal').innerHTML = '';
    totalCount = 0;
    document.getElementById('count').textContent = '0 entries';
  });

  document.querySelectorAll('.cat-filter').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cat = this.dataset.cat;
      if (cat === 'ALL') {
        var allActive = activeFilters.has('ALL');
        if (allActive) {
          activeFilters.clear();
          document.querySelectorAll('.cat-filter').forEach(function(b) { b.classList.remove('active'); });
        } else {
          activeFilters.add('ALL');
          ALL_CATS.forEach(function(c) { activeFilters.add(c); });
          document.querySelectorAll('.cat-filter').forEach(function(b) { b.classList.add('active'); });
        }
      } else {
        if (activeFilters.has(cat)) {
          activeFilters.delete(cat);
          this.classList.remove('active');
        } else {
          activeFilters.add(cat);
          this.classList.add('active');
        }
      }
      document.querySelectorAll('.log-line').forEach(function(line) {
        var lc = line.dataset.cat;
        line.style.display = isVisible(lc) ? '' : 'none';
      });
    });
  });
</script>
</body>
</html>`;

// GET /logs  → HTML terminal page
router.get("/", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(HTML_PAGE);
});

// GET /logs/stream  → SSE live stream
router.get("/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Replay buffered entries on connect
  const buffered = logger.getBuffer();
  for (const entry of buffered) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // Subscribe to live entries
  const unsubscribe = logger.onEntry((entry: LogEntry) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  // Heartbeat to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
});

// GET /logs/json  → raw buffer as JSON
router.get("/json", (_req: Request, res: Response) => {
  res.json(logger.getBuffer());
});

export default router;
