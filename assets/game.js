(() => {
  const $ = (sel) => document.querySelector(sel);
  const elH = $('#g-heading');
  const elA = $('#g-alpha');
  const elB = $('#g-beta');
  const elG = $('#g-gamma');
  const btn = $('#g-enable');
  const note = $('#g-note');

  function deg(v) { return (typeof v === 'number') ? `${v.toFixed(1)}°` : '–'; }

  let stopFn = null;
  function start() {
    if (stopFn) return;
    stopFn = window.NazoSensors.startSensorListeners({
      onOrientation: ({ heading, alpha, beta, gamma }) => {
        elH.textContent = deg(heading);
        elA.textContent = deg(alpha);
        elB.textContent = deg(beta);
        elG.textContent = deg(gamma);
      },
      onMotion: () => {},
    });
  }

  async function ensurePermission() {
    btn.disabled = true;
    try {
      const { orientation, motion } = await window.NazoSensors.requestSensorPermission();
      note.textContent = `orientation: ${orientation} / motion: ${motion}`;
      if ((orientation === 'granted' || orientation === 'prompt') && (motion === 'granted' || motion === 'prompt')) {
        start();
      }
    } catch (e) {
      note.textContent = 'センサーの許可に失敗しました';
    } finally {
      btn.disabled = false;
    }
  }

  function init() {
    btn.addEventListener('click', ensurePermission);
    // Try start directly for platforms not needing explicit permission
    start();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
