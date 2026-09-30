import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeSettings = registerPlugin('NativeSettings');

window.openNativeLocationSettings = async () => {
  if (!Capacitor.isNativePlatform()) return false;
  if (Capacitor.getPlatform() === 'ios') {
    window.location.href = 'app-settings:';
    return true;
  }
  await NativeSettings.openLocationSettings();
  return true;
};