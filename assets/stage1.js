(() => {
  // Stage 1: Hourglass sand sim on canvas (precise, grid-based CA)
  const DPR = () => Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1)));

  function makeHourglassMask(W, H, neckCells) {
    const mask = new Uint8Array(W * H);
    const halfH = H / 2;
    const cx = W / 2;
    const topHalfWidth = Math.max(6, Math.floor(W * 0.42));
    const neck = Math.max(4, Math.min(neckCells, Math.floor(W * 0.10)));
    for (let y = 0; y < H; y++) {
      const isTop = y < halfH;
      const t = isTop ? (y / halfH) : ((y - halfH) / halfH);
      const halfW = isTop
        ? (topHalfWidth * (1 - t) + (neck / 2) * t)
        : ((neck / 2) * (1 - t) + topHalfWidth * t);
      const minX = Math.ceil(cx - halfW);
      const maxX = Math.floor(cx + halfW);
      const wy = y | 0;
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < W) mask[wy * W + x] = 1;
      }
    }
    return { mask, neck: Math.max(2, Math.floor(neck)) };
  }

  function createSand(W, H, mask) {
    const sand = new Uint8Array(W * H);
    const halfH = Math.floor(H / 2);
    // Fill upper bulb nearly full (leave a small air cap at the very top)
    for (let y = 2; y < halfH - 1; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (mask[i]) sand[i] = 1;
      }
    }
    return sand;
  }

  function stepSand(sand, mask, W, H, parity) {
    // Simple granular automata: move one cell down if empty, else diagonals
    const next = sand.slice();
    // Iterate bottom-up so grains fall into next frame correctly
    for (let y = H - 2; y >= 0; y--) {
      const base = y * W;
      for (let x = 0; x < W; x++) {
        const i = base + x;
        if (!sand[i]) continue;
        // Already moved by a cell above? Keep only original grains
        // Try down
        const y1 = y + 1;
        let moved = false;
        if (y1 < H) {
          const iDown = i + W;
          if (mask[iDown] && !sand[iDown] && !next[iDown]) {
            next[i] = 0;
            next[iDown] = 1;
            moved = true;
          }
        }
        if (moved) continue;
        // Try diagonals, alternate bias by parity and x
        const biasRight = ((x + parity) & 1) === 1;
        const tryDirs = biasRight ? [1, -1] : [-1, 1];
        for (let d = 0; d < 2 && !moved; d++) {
          const dx = tryDirs[d];
          const nx = x + dx;
          const ny = y + 1;
          if (nx >= 0 && nx < W && ny < H) {
            const j = ny * W + nx;
            if (mask[j] && !sand[j] && !next[j]) {
              next[i] = 0;
              next[j] = 1;
              moved = true;
              break;
            }
          }
        }
      }
    }
    return next;
  }

  function drawHourglass(ctx, W, H, cell, neck) {
    const dpr = DPR();
    ctx.save();
    ctx.scale(cell, cell);
    ctx.lineWidth = Math.max(1 / dpr, 0.75 / dpr);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    const cx = W / 2;
    const topHalfWidth = Math.max(6, Math.floor(W * 0.42));
    const halfH = H / 2;
    ctx.beginPath();
    // Left wall (top to neck to bottom)
    ctx.moveTo(cx - topHalfWidth, 0);
    ctx.lineTo(cx - neck / 2, halfH);
    ctx.lineTo(cx - topHalfWidth, H);
    // Right wall
    ctx.moveTo(cx + topHalfWidth, 0);
    ctx.lineTo(cx + neck / 2, halfH);
    ctx.lineTo(cx + topHalfWidth, H);
    ctx.stroke();
    ctx.restore();
  }

  function drawSand(ctx, sand, mask, W, H, cell) {
    ctx.save();
    ctx.scale(cell, cell);
    ctx.fillStyle = '#e6d39a'; // sand color
    // Draw by cells (only filled)
    for (let y = 0; y < H; y++) {
      const base = y * W;
      for (let x = 0; x < W; x++) {
        const i = base + x;
        if (sand[i]) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.restore();
  }

  function init(root) {
    const canvas = document.createElement('canvas');
    canvas.className = 'stage-canvas';
    root.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });

    let W = 120, H = 200; // simulation grid
    let mask = null;
    let sand = null;
    let cell = 3; // pixels per cell (computed on layout)
    let parity = 0;
    let running = true;
    let last = performance.now();
    let acc = 0;
    const stepDt = 1000 / 60; // 60Hz sim
    let tTotal = 0;

    // Bullet-hell like garnish (foreground)
    const bullets = [];
    const spawn = {
      cooldown: 0,
      pattern: 0,
    };
    const player = { x: 0, y: 0, r: 6 };

    function spawnRadial(cx, cy, count, speed, radius = 3) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        bullets.push({ x: cx, y: cy, vx, vy, r: radius });
      }
    }

    function spawnSweep(y, dir, speed = 140, gap = 28, radius = 2.6) {
      const startX = dir > 0 ? -20 : canvas.width + 20;
      for (let i = -40; i < canvas.width + 40; i += gap) {
        bullets.push({ x: startX, y: y + ((i % (gap * 4)) - gap * 2) * 0.05, vx: dir * speed, vy: 0, r: radius });
      }
    }

    function updateBullets(dtMs) {
      const dt = dtMs / 1000;
      spawn.cooldown -= dtMs;
      if (spawn.cooldown <= 0) {
        if (spawn.pattern === 0) {
          // Ring burst from the neck
          const cx = (W * 0.5) * cell;
          const cy = (H * 0.5) * cell;
          spawnRadial(cx, cy, 28, 120);
          spawn.cooldown = 1200; // ms
          spawn.pattern = 1;
        } else {
          // Horizontal sweeps
          const yMid = (H * 0.75 + (Math.sin(tTotal / 700) * H * 0.1)) * cell;
          spawnSweep(yMid, Math.random() < 0.5 ? 1 : -1);
          spawn.cooldown = 800; // ms
          spawn.pattern = 0;
        }
      }
      // Move and cull
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -40 || b.x > canvas.width + 40 || b.y < -40 || b.y > canvas.height + 40) {
          bullets.splice(i, 1);
        }
      }
    }

    function layout() {
      const dpr = DPR();
      const rect = root.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      // Choose grid size relative to canvas size for performance & sharpness
      const targetCell = Math.max(2, Math.min(4, Math.floor((rect.width / 120) * dpr)));
      cell = targetCell;
      // keep aspect ~ (W/H) ~= rect
      const gridW = Math.max(80, Math.min(160, Math.floor(rect.width * dpr / cell)));
      const gridH = Math.max(140, Math.min(260, Math.floor(rect.height * dpr / cell)));
      W = gridW; H = gridH;
      const hg = makeHourglassMask(W, H, Math.floor(W * 0.08));
      mask = hg.mask;
      sand = createSand(W, H, mask);
      // Place player near bottom center
      player.x = canvas.width / 2;
      player.y = Math.max(20, canvas.height - 40);
    }

    function render() {
      // Clear
      ctx.fillStyle = '#07090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Hourglass walls
      drawHourglass(ctx, W, H, cell, Math.floor(W * 0.08));
      // Sand
      drawSand(ctx, sand, mask, W, H, cell);
      // Bullets (foreground)
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Player
      ctx.fillStyle = '#6cf';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function frame(t) {
      if (!running) return;
      const dt = t - last; last = t; tTotal += dt;
      acc += dt;
      // cap to avoid spiral of death
      if (acc > 250) acc = 250;
      while (acc >= stepDt) {
        sand = stepSand(sand, mask, W, H, parity);
        parity ^= 1;
        acc -= stepDt;
      }
      // Update bullets
      updateBullets(dt);
      render();
      requestAnimationFrame(frame);
    }

    const onResize = () => {
      layout();
      render();
    };
    window.addEventListener('resize', onResize);
    layout();
    // Pointer control for player
    let ptrActive = false;
    function setPlayerFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const dpr = DPR();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;
      player.x = Math.max(0, Math.min(canvas.width, x));
      player.y = Math.max(0, Math.min(canvas.height, y));
    }
    canvas.addEventListener('pointerdown', (e) => {
      ptrActive = true; canvas.setPointerCapture(e.pointerId); setPlayerFromEvent(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (ptrActive) setPlayerFromEvent(e); });
    canvas.addEventListener('pointerup', (e) => { ptrActive = false; try { canvas.releasePointerCapture(e.pointerId); } catch(_) {} });

    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

    // Return cleanup
    return () => {
      running = false;
      window.removeEventListener('resize', onResize);
    };
  }

  window.NazoStages = window.NazoStages || {};
  window.NazoStages.stage1 = { init };
})();
