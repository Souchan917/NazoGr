(() => {
  const isSecure = () => (window.isSecureContext !== false) && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');

  const canRequestOrientationPermission = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
  const canRequestMotionPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';

  // Must be called directly from a user gesture on iOS.
  // Both permission requests are kicked off synchronously before any await
  // to keep "user activation" alive for both.
  async function requestSensorPermission() {
    let orientation = 'unknown';
    let motion = 'unknown';

    let oPromise = null;
    let mPromise = null;

    try {
      if (canRequestOrientationPermission()) {
        oPromise = DeviceOrientationEvent.requestPermission();
      } else {
        orientation = 'granted';
      }
    } catch (_) {
      orientation = 'denied';
    }

    try {
      if (canRequestMotionPermission()) {
        mPromise = DeviceMotionEvent.requestPermission();
      } else {
        motion = 'granted';
      }
    } catch (_) {
      motion = 'denied';
    }

    // Await after both calls have been initiated
    try {
      if (oPromise) orientation = await oPromise;
    } catch (_) {
      orientation = 'denied';
    }
    try {
      if (mPromise) motion = await mPromise;
    } catch (_) {
      motion = 'denied';
    }

    return { orientation, motion };
  }

  // Prefer native webkitCompassHeading on iOS; fall back to alpha.
  function extractHeadingFromEvent(e) {
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      return e.webkitCompassHeading; // 0 = 北
    }
    // Fallback: many Android devices expose alpha with 0 ~= 北 (clockwise increasing).
    if (typeof e.alpha === 'number') {
      // Normalize 0-360
      let h = e.alpha % 360;
      if (h < 0) h += 360;
      return h;
    }
    return null;
  }

  function startSensorListeners({ onOrientation, onMotion } = {}) {
    const opts = { passive: true };
    const handleOrientation = (e) => {
      const heading = extractHeadingFromEvent(e);
      if (onOrientation) {
        onOrientation({
          alpha: (typeof e.alpha === 'number') ? e.alpha : null,
          beta: (typeof e.beta === 'number') ? e.beta : null,
          gamma: (typeof e.gamma === 'number') ? e.gamma : null,
          absolute: !!e.absolute,
          heading,
          rawEvent: e,
        });
      }
    };
    const handleMotion = (e) => {
      if (onMotion) {
        const acc = e.accelerationIncludingGravity || e.acceleration || {};
        onMotion({
          ax: (typeof acc.x === 'number') ? acc.x : null,
          ay: (typeof acc.y === 'number') ? acc.y : null,
          az: (typeof acc.z === 'number') ? acc.z : null,
          rawEvent: e,
        });
      }
    };

    // Some Chrome/Android expose more accurate absolute event
    const hasAbsolute = 'ondeviceorientationabsolute' in window;
    if (hasAbsolute) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, opts);
    }
    window.addEventListener('deviceorientation', handleOrientation, opts);
    window.addEventListener('devicemotion', handleMotion, opts);

    const stop = () => {
      if (hasAbsolute) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation, opts);
      }
      window.removeEventListener('deviceorientation', handleOrientation, opts);
      window.removeEventListener('devicemotion', handleMotion, opts);
    };
    return stop;
  }

  // Expose to global in a light-touch namespace
  window.NazoSensors = {
    isSecure,
    requestSensorPermission,
    startSensorListeners,
  };
})();
