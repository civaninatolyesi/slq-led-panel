import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.civaninatolyesi.slqstudio',
  appName: 'SLQ Studio',
  webDir: 'dist',
  backgroundColor: '#07080c',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Aranıyor…',
        cancel: 'Vazgeç',
        availableDevices: 'Paneller',
        noDeviceFound: 'Panel bulunamadı',
      },
    },
  },
}

export default config
