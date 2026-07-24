/* Fidelize Migrator - floating launcher + persistent panel
 *
 * Injeta um botão flutuante animado (cyan/magenta) e um painel iframe que
 * carrega popup.html. O painel permanece aberto até o usuário clicar no
 * botão flutuante novamente ou no X. O estado (aberto/posição) é persistido
 * em chrome.storage.local, então sobrevive à navegação entre páginas.
 *
 * Instala apenas no top frame e apenas uma vez por página. Evita ativar em
 * páginas internas do próprio Chrome (about:, chrome:, etc — bloqueadas
 * pelo manifest, mas garantimos aqui).
 */
(() => {
  if (window.top !== window.self) return;
  if (window.__fidelizeMigratorInstalled) return;
  window.__fidelizeMigratorInstalled = true;

  const HOST_ID = "fidelize-migrator-host";
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.top = "0";
  host.style.left = "0";
  host.style.width = "0";
  host.style.height = "0";
  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    :host, * { box-sizing: border-box; }
    .fab {
      position: fixed; right: 24px; bottom: 24px;
      width: 60px; height: 60px; border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #22d3ee, #0891b2 60%, #164e63);
      color: #0b0f1a; font: 700 22px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; user-select: none;
      box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 0 rgba(34,211,238,.6);
      animation: pulse 2.2s ease-out infinite;
      transition: transform .18s ease;
      border: 2px solid rgba(255,255,255,.25);
    }
    .fab:hover { transform: scale(1.08); }
    .fab.active {
      background: radial-gradient(circle at 30% 30%, #d946ef, #a21caf 60%, #4a044e);
      animation: none;
      box-shadow: 0 8px 24px rgba(0,0,0,.5), 0 0 0 3px rgba(217,70,239,.35);
    }
    .fab .ring {
      position: absolute; inset: -6px; border-radius: 50%;
      border: 2px solid rgba(34,211,238,.55);
      animation: ring 2.2s ease-out infinite;
      pointer-events: none;
    }
    .fab.active .ring { display: none; }
    @keyframes pulse {
      0%   { box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 0 rgba(34,211,238,.55); }
      70%  { box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 18px rgba(34,211,238,0); }
      100% { box-shadow: 0 8px 24px rgba(0,0,0,.35), 0 0 0 0 rgba(34,211,238,0); }
    }
    @keyframes ring {
      0%   { transform: scale(0.9); opacity: .8; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    .panel {
      position: fixed; right: 24px; bottom: 96px;
      width: 480px; height: 660px; max-height: calc(100vh - 120px); max-width: calc(100vw - 32px);
      background: #0b0f1a; color: #e5e7eb;
      border-radius: 14px; overflow: hidden;
      box-shadow: 0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(34,211,238,.25);
      display: none; flex-direction: column;
      border: 1px solid rgba(34,211,238,.3);
    }
    .panel.open { display: flex; animation: slide-in .22s ease-out; }
    @keyframes slide-in {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; background: linear-gradient(135deg, rgba(34,211,238,.15), rgba(217,70,239,.15));
      border-bottom: 1px solid rgba(255,255,255,.08);
      font: 600 12px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
      cursor: move; user-select: none;
    }
    .bar .title { display: flex; align-items: center; gap: 8px; letter-spacing: .3px; }
    .bar .dot { width: 8px; height: 8px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 8px #22d3ee; }
    .bar .actions { display: flex; gap: 4px; }
    .bar button {
      all: unset; cursor: pointer; padding: 4px 8px; border-radius: 6px;
      color: #cbd5e1; font-size: 14px; line-height: 1;
    }
    .bar button:hover { background: rgba(255,255,255,.08); color: #fff; }
    iframe { flex: 1; width: 100%; border: 0; background: #0b0f1a; }
  `;
  root.appendChild(style);

  const fab = document.createElement("div");
  fab.className = "fab";
  fab.title = "Fidelize Migrator (clique para abrir/fechar)";
  fab.innerHTML = `<span>F</span><span class="ring"></span>`;
  root.appendChild(fab);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="bar" id="fmBar">
      <div class="title"><span class="dot"></span>Fidelize Migrator</div>
      <div class="actions">
        <button id="fmClose" title="Fechar">✕</button>
      </div>
    </div>
    <iframe id="fmFrame" src="${chrome.runtime.getURL("popup.html")}"></iframe>
  `;
  root.appendChild(panel);

  const closeBtn = panel.querySelector("#fmClose");
  const bar = panel.querySelector("#fmBar");

  function setOpen(open) {
    panel.classList.toggle("open", open);
    fab.classList.toggle("active", open);
    try { chrome.storage.local.set({ fmPanelOpen: open }); } catch {}
  }
  function toggle() { setOpen(!panel.classList.contains("open")); }

  fab.addEventListener("click", toggle);
  closeBtn.addEventListener("click", () => setOpen(false));

  // Restore last state (persistent across navigations)
  try {
    chrome.storage.local.get(["fmPanelOpen", "fmFabPos"], (v) => {
      if (v && v.fmPanelOpen) setOpen(true);
      if (v && v.fmFabPos) applyFabPos(v.fmFabPos);
    });
  } catch {}

  /* Drag the FAB (vertical/horizontal) */
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
  function applyFabPos(pos) {
    fab.style.right = "auto"; fab.style.bottom = "auto";
    fab.style.left = pos.x + "px"; fab.style.top = pos.y + "px";
  }
  fab.addEventListener("mousedown", (e) => {
    dragging = true; moved = false;
    const r = fab.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const nx = Math.max(4, Math.min(window.innerWidth - 64, ox + dx));
    const ny = Math.max(4, Math.min(window.innerHeight - 64, oy + dy));
    applyFabPos({ x: nx, y: ny });
  });
  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    if (moved) {
      const r = fab.getBoundingClientRect();
      try { chrome.storage.local.set({ fmFabPos: { x: r.left, y: r.top } }); } catch {}
      // Prevent the click event from also toggling right after a drag
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); fab.removeEventListener("click", stop, true); };
      fab.addEventListener("click", stop, true);
    }
  });

  /* Drag the panel via its title bar */
  let pdrag = false, psx = 0, psy = 0, pox = 0, poy = 0;
  bar.addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    pdrag = true;
    const r = panel.getBoundingClientRect();
    psx = e.clientX; psy = e.clientY; pox = r.left; poy = r.top;
    panel.style.right = "auto"; panel.style.bottom = "auto";
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!pdrag) return;
    const dx = e.clientX - psx, dy = e.clientY - psy;
    const nx = Math.max(4, Math.min(window.innerWidth - panel.offsetWidth - 4, pox + dx));
    const ny = Math.max(4, Math.min(window.innerHeight - panel.offsetHeight - 4, poy + dy));
    panel.style.left = nx + "px"; panel.style.top = ny + "px";
  });
  window.addEventListener("mouseup", () => { pdrag = false; });
})();
