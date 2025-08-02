export const requestOrientationPermission = async () => {
  if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const result = await window.DeviceOrientationEvent.requestPermission();
      return result === 'granted';
    } catch (err) {
      console.error('Device orientation permission denied', err);
      return false;
    }
  }
  return true;
};

// Calculate compass heading from generic orientation event
const calculateCompassHeading = (alpha, beta, gamma) => {
  const degToRad = Math.PI / 180;
  const x = beta * degToRad;
  const y = gamma * degToRad;
  const z = alpha * degToRad;

  const cY = Math.cos(y);
  const cZ = Math.cos(z);
  const sX = Math.sin(x);
  const sY = Math.sin(y);
  const sZ = Math.sin(z);

  const rA = -cZ * sY - sZ * sX * cY;
  const rB = -sZ * sY + cZ * sX * cY;
  let heading = Math.atan2(rA, rB);
  if (heading < 0) heading += Math.PI * 2;
  return heading * (180 / Math.PI);
};

export const getCompassHeading = (event) => {
  let heading = null;
  if (typeof event.webkitCompassHeading === 'number') {
    heading = event.webkitCompassHeading;
  } else if (event.absolute && typeof event.alpha === 'number') {
    heading = event.alpha;
  } else if (
    typeof event.alpha === 'number' &&
    typeof event.beta === 'number' &&
    typeof event.gamma === 'number'
  ) {
    heading = calculateCompassHeading(event.alpha, event.beta, event.gamma);
  }

  if (typeof heading === 'number') {
    const orientation = window.screen?.orientation?.angle || window.orientation || 0;
    heading = (heading + orientation) % 360;
  }

  return heading;
};
