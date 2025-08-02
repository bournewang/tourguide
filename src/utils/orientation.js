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
