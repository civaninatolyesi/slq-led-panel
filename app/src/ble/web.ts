/**
 * Web Bluetooth taşıması. Tarayıcıda (Chrome/Edge) ve Electron masaüstü uygulamasında kullanılır.
 * Electron'da cihaz seçimini ana süreç yakalar (select-bluetooth-device) ve listeyi arayüze iletir.
 */
import { ADV_SIGNATURE, CMD_CHAR, DATA_CHAR, MFR_ID, NAME_PREFIX, NOTIFY_CHAR, SERVICE_UUID } from '../core/protocol'
import { isElectron, type Backend, type Channel, type FoundDevice, type Link } from './transport'

const REQUEST: RequestDeviceOptions = {
  filters: [
    { namePrefix: NAME_PREFIX },
    { manufacturerData: [{ companyIdentifier: MFR_ID, dataPrefix: new Uint8Array(ADV_SIGNATURE) }] },
  ],
  optionalServices: [SERVICE_UUID],
}

const withTimeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${what}: zaman aşımı`)), ms))])

class WebLink implements Link {
  onNotify: (d: Uint8Array) => void = () => {}
  onDisconnect: () => void = () => {}
  readonly mtu = null
  private chars: Record<Channel, BluetoothRemoteGATTCharacteristic> | null = null
  private closing = false

  constructor(private device: BluetoothDevice) {
    device.addEventListener('gattserverdisconnected', this.handleDisconnect)
  }

  get id() {
    return this.device.id
  }
  get name() {
    return this.device.name ?? 'SLQ'
  }

  private handleDisconnect = () => {
    this.chars = null
    if (!this.closing) this.onDisconnect()
  }

  private handleNotify = (e: Event) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (v) this.onNotify(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)))
  }

  async open(): Promise<this> {
    this.closing = false
    const server = await withTimeout(this.device.gatt!.connect(), 20000, 'bağlantı')
    const svc = await server.getPrimaryService(SERVICE_UUID)
    const [cmd, data, notify] = await Promise.all([
      svc.getCharacteristic(CMD_CHAR),
      svc.getCharacteristic(DATA_CHAR),
      svc.getCharacteristic(NOTIFY_CHAR),
    ])
    // Aynı fonksiyon referansı tekrar eklenmez; yeniden bağlanınca bildirimler çiftlenmez.
    notify.addEventListener('characteristicvaluechanged', this.handleNotify)
    await notify.startNotifications()
    this.chars = { cmd, data }
    return this
  }

  async write(ch: Channel, data: Uint8Array): Promise<void> {
    if (!this.chars) throw new Error('bağlı değil')
    await this.chars[ch].writeValueWithResponse(data as BufferSource)
  }

  async reconnect(): Promise<void> {
    await this.open()
  }

  async disconnect(): Promise<void> {
    this.closing = true
    this.chars = null
    if (this.device.gatt?.connected) this.device.gatt.disconnect()
  }
}

export class WebBackend implements Backend {
  readonly kind = isElectron() ? ('electron' as const) : ('web' as const)
  readonly customPicker = isElectron()
  private pending: Promise<BluetoothDevice | null> | null = null
  private unsub: (() => void) | null = null

  async check() {
    if (!window.isSecureContext) return 'insecure' as const
    if (!navigator.bluetooth) return 'no-bluetooth' as const
    const avail = await navigator.bluetooth.getAvailability?.().catch(() => true)
    return avail === false ? ('bt-off' as const) : null
  }

  private request(): Promise<BluetoothDevice | null> {
    this.pending = navigator.bluetooth.requestDevice(REQUEST).catch(() => null)
    return this.pending
  }

  async startScan(onDevices: (list: FoundDevice[]) => void): Promise<void> {
    const desk = window.slqDesktop
    if (!desk) return
    this.unsub?.()
    this.unsub = desk.onBluetoothDevices((list) =>
      onDevices(list.map((d) => ({ id: d.deviceId, name: d.deviceName || d.deviceId }))),
    )
    void this.request()
  }

  async stopScan(): Promise<void> {
    this.unsub?.()
    this.unsub = null
    if (this.pending && window.slqDesktop) window.slqDesktop.selectBluetoothDevice('')
  }

  async connect(id?: string): Promise<Link> {
    let device: BluetoothDevice | null
    if (window.slqDesktop && id) {
      const p = this.pending ?? this.request()
      window.slqDesktop.selectBluetoothDevice(id)
      device = await p
      this.unsub?.()
      this.unsub = null
    } else {
      device = await navigator.bluetooth.requestDevice(REQUEST).catch((e: Error) => {
        if (e.name === 'NotFoundError') return null // kullanıcı seçiciyi kapattı
        throw e
      })
    }
    this.pending = null
    if (!device) throw new Error('cancelled')
    return new WebLink(device).open()
  }

  async autoConnect(id: string): Promise<Link | null> {
    try {
      if (window.slqDesktop) {
        // requestDevice kullanıcı etkileşimi ister; ana süreç çağrıyı "kullanıcı hareketi" olarak çalıştırır.
        const got = new Promise<BluetoothDevice | null>((resolve) => {
          ;(window as unknown as { __slqGestureRequest: () => void }).__slqGestureRequest = () => {
            this.request().then(resolve)
          }
        })
        await window.slqDesktop.autoSelectBluetoothDevice(id)
        const device = await withTimeout(got, 20000, 'otomatik bağlantı')
        this.pending = null
        return device ? await new WebLink(device).open() : null
      }
      const devices = (await navigator.bluetooth.getDevices?.()) ?? []
      const device = devices.find((d) => d.id === id)
      return device ? await new WebLink(device).open() : null
    } catch {
      return null
    }
  }
}
