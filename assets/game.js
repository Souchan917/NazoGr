(() => {
  const $ = (sel) => document.querySelector(sel);
  const elH = $('#g-heading');
  const elA = $('#g-alpha');
  const elB = $('#g-beta');
  const elG = $('#g-gamma');
  const btn = $('#g-enable');
  const note = $('#g-note');
  // Stage select elements
  const overlay = $('#stage-overlay');
  const scroller = $('#stage-scroller');
  const title = $('#puzzle-title');
  const stageRoot = document.querySelector('#stage-root');

  function deg(v) { return (typeof v === 'number') ? `${v.toFixed(1)}°` : '–'; }

  let stopFn = null;
  function start() {
    if (stopFn) return;
    stopFn = window.NazoSensors.startSensorListeners({
      onOrientation: ({ heading, alpha, beta, gamma }) => {
        if (elH) elH.textContent = deg(heading);
        if (elA) elA.textContent = deg(alpha);
        if (elB) elB.textContent = deg(beta);
        if (elG) elG.textContent = deg(gamma);
      },
      onMotion: () => {},
    });
  }

  async function ensurePermission() {
    if (!btn) return start();
    btn.disabled = true;
    try {
      const { orientation, motion } = await window.NazoSensors.requestSensorPermission();
      if (note) note.textContent = `orientation: ${orientation} / motion: ${motion}`;
      if ((orientation === 'granted' || orientation === 'prompt') && (motion === 'granted' || motion === 'prompt')) {
        start();
      }
    } catch (e) {
      if (note) note.textContent = 'センサーの許可に失敗しました';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function buildStageSelector() {
    if (!scroller) return;
    // Create 1..30 stage buttons
    for (let i = 1; i <= 30; i++) {
      const btn = document.createElement('button');
      btn.className = 'stage-item';
      btn.type = 'button';
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('aria-label', `ステージ ${i}`);
      btn.dataset.stage = String(i);
      btn.innerHTML = `\n        <div class="stage-num">${i}</div>\n        <div class="stage-label">STAGE</div>\n      `;
      btn.addEventListener('click', () => selectStage(i));
      scroller.appendChild(btn);
    }
  }

  function selectStage(n) {
    try { localStorage.setItem('nazogram-stage', String(n)); } catch(_) {}
    if (title) title.textContent = `ステージ ${n}`;
    if (overlay) overlay.classList.add('hidden');
    // Mount stage-specific logic
    mountStage(n);
  }

  let unmount = null;
  function mountStage(n) {
    if (!stageRoot) return;
    // Cleanup previous
    if (typeof unmount === 'function') {
      try { unmount(); } catch(_) {}
      unmount = null;
    }
    // Clear root
    stageRoot.innerHTML = '';
    // Route by stage number
    if (n === 1 && window.NazoStages && window.NazoStages.stage1) {
      unmount = window.NazoStages.stage1.init(stageRoot);
    } else {
      // Placeholder for other stages
      const msg = document.createElement('div');
      msg.className = 'note';
      msg.style.padding = '16px';
      msg.textContent = `ステージ ${n} は準備中です`;
      stageRoot.appendChild(msg);
    }
  }

  function init() {
    // Build stage picker first
    buildStageSelector();
    // Sensor permission flow
    if (btn) btn.addEventListener('click', ensurePermission);
    // Try start directly for platforms not needing explicit permission
    start();

    // If URL has ?stage= or #stage=, preselect but keep overlay until explicit tap? -> select immediately if provided
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    let s = Number(params.get('stage') || hash.get('stage'));
    if (!Number.isFinite(s)) {
      try {
        const saved = Number(localStorage.getItem('nazogram-stage'));
        if (Number.isFinite(saved)) s = saved;
      } catch(_) {}
    }
    if (Number.isFinite(s) && s >= 1 && s <= 30) {
      selectStage(s);
      // Try to scroll to that index visually if overlay still visible
      if (scroller && overlay && !overlay.classList.contains('hidden')) {
        const idx = s - 1;
        const child = scroller.children[idx];
        if (child) child.scrollIntoView({ inline: 'center', behavior: 'auto', block: 'center' });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
