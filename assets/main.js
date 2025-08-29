(() => {
  const $ = (sel) => document.querySelector(sel);
  const permStatus = $('#perm-status');
  const elHeading = $('#heading');
  const elAlpha = $('#alpha');
  const elBeta = $('#beta');
  const elGamma = $('#gamma');
  const elAcc = $('#acc');
  const btnEnable = $('#btn-enable');
  const secureWarn = $('#secure-warning');
  const startLink = $('#start-link');

  function formatDeg(v) {
    return (typeof v === 'number') ? `${v.toFixed(1)}°` : '–';
  }
  function formatAcc(ax, ay, az) {
    if ([ax, ay, az].every((v) => typeof v === 'number')) {
      return `${ax.toFixed(2)}, ${ay.toFixed(2)}, ${az.toFixed(2)}`;
    }
    return '–';
  }

  function setPermText(o, m) {
    const txt = `orientation: ${o} / motion: ${m}`;
    permStatus.textContent = txt;
  }

  async function enableSensorsFlow() {
    btnEnable.disabled = true;
    try {
      const { orientation, motion } = await window.NazoSensors.requestSensorPermission();
      setPermText(orientation, motion);
      // If granted (iOS) or not required (others), start listeners.
      if ((orientation === 'granted' || orientation === 'prompt') && (motion === 'granted' || motion === 'prompt')) {
        startListeners();
      }
    } catch (e) {
      console.warn('Permission request failed', e);
    } finally {
      btnEnable.disabled = false;
    }
  }

  let stopFn = null;
  function startListeners() {
    if (stopFn) return;
    stopFn = window.NazoSensors.startSensorListeners({
      onOrientation: ({ heading, alpha, beta, gamma }) => {
        elHeading.textContent = (typeof heading === 'number') ? `${heading.toFixed(1)}°` : '–';
        elAlpha.textContent = formatDeg(alpha);
        elBeta.textContent = formatDeg(beta);
        elGamma.textContent = formatDeg(gamma);
      },
      onMotion: ({ ax, ay, az }) => {
        elAcc.textContent = formatAcc(ax, ay, az);
      },
    });
  }

  function init() {
    // HTTPS note
    if (!window.NazoSensors.isSecure()) {
      secureWarn.classList.remove('hidden');
    }

    setPermText('未確認', '未確認');

    btnEnable.addEventListener('click', enableSensorsFlow);
    startLink.addEventListener('click', async (e) => {
      // Intercept navigation: request permissions first within the same gesture
      e.preventDefault();
      try {
        const { orientation, motion } = await window.NazoSensors.requestSensorPermission();
        setPermText(orientation, motion);
      } catch (_) {
        // ignore
      } finally {
        // Navigate regardless; game page also has enable button
        location.href = (startLink.getAttribute('href') || 'game.html');
      }
    });

    // On platforms that do not require explicit permission, we can start listeners immediately
    startListeners();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
