/**
 * Platformdan bağımsız BLE taşıma arayüzü.
 *   web      — tarayıcı (Chrome/Edge, masaüstü ve Android): tarayıcının kendi cihaz seçicisi
 *   electron — masaüstü uygulaması: Web Bluetooth + uygulama içi cihaz listesi
 *   native   — Android uygulaması (Capacitor): yerel BLE, MTU isteği
 */
export type Channel = 'cmd' | 'data'

export interface Link {
  readonly id: string
  readonly name: string
  /** Anlaşılan ATT MTU; bilinmiyorsa null. */
  readonly mtu: number | null
  write(ch: Channel, data: Uint8Array): Promise<void>
  /** Kopmadan sonra aynı cihaza yeniden bağlanır. */
  reconnect(): Promise<void>
  disconnect(): Promise<void>
  onNotify: (data: Uint8Array) => void
  onDisconnect: () => void
}

export interface FoundDevice {
  id: string
  name: string
  rssi?: number
}

export interface Backend {
  readonly kind: 'web' | 'electron' | 'native'
  /** Uygulama içinde cihaz listesi gösterilebiliyor mu (tarayıcıda seçiciyi tarayıcı çizer). */
  readonly customPicker: boolean
  /** null: kullanılabilir; aksi halde kullanıcıya gösterilecek sebep anahtarı. */
  check(): Promise<null | 'no-bluetooth' | 'bt-off' | 'insecure'>
  startScan(onDevices: (list: FoundDevice[]) => void): Promise<void>
  stopScan(): Promise<void>
  /** id verilmezse (web) tarayıcının seçicisi açılır. */
  connect(id?: string, name?: string): Promise<Link>
  /** Uygulama açılışında son cihaza kendiliğinden bağlanmayı dener. */
  autoConnect?(id: string, name: string): Promise<Link | null>
}

export interface DesktopBridge {
  platform: string
  version: string
  onBluetoothDevices(cb: (list: { deviceId: string; deviceName: string }[]) => void): () => void
  selectBluetoothDevice(id: string): void
  /** Ana süreç bir sonraki cihaz listesinde bu kimliği görünce kendiliğinden seçer. */
  autoSelectBluetoothDevice(id: string): Promise<void>
  openExternal(url: string): void
}

declare global {
  interface Window {
    slqDesktop?: DesktopBridge
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string }
  }
}

export const isElectron = () => typeof window !== 'undefined' && !!window.slqDesktop
export const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

export async function getBackend(): Promise<Backend> {
  if (isNative()) return new (await import('./native')).NativeBackend()
  const { WebBackend } = await import('./web')
  return new WebBackend()
}
