/**
 * Android (Capacitor) taşıması: @capacitor-community/bluetooth-le.
 * Eklenti bağlanınca MTU 512 ister; parça boyutu buna göre 446 bayt kalır.
 */
import { BleClient, ConnectionPriority, type ScanResult } from '@capacitor-community/bluetooth-le'
import { ADV_SIGNATURE, CMD_CHAR, DATA_CHAR, MFR_ID, NAME_PREFIX, NOTIFY_CHAR, SERVICE_UUID } from '../core/protocol'
import type { Backend, Channel, FoundDevice, Link } from './transport'

const CHAR: Record<Channel, string> = { cmd: CMD_CHAR, data: DATA_CHAR }

function isPanel(r: ScanResult): boolean {
  const name = r.localName ?? r.device.name ?? ''
  if (name.startsWith(NAME_PREFIX)) return true
  const m = r.manufacturerData?.[String(MFR_ID)]
  return !!m && m.byteLength >= 3 && ADV_SIGNATURE.every((b, i) => m.getUint8(i) === b)
}

class NativeLink implements Link {
  onNotify: (d: Uint8Array) => void = () => {}
  onDisconnect: () => void = () => {}
  mtu: number | null = null
  private closing = false

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  async open(): Promise<this> {
    this.closing = false
    await BleClient.connect(this.id, () => !this.closing && this.onDisconnect(), { timeout: 20000 })
    await BleClient.requestConnectionPriority(this.id, ConnectionPriority.CONNECTION_PRIORITY_HIGH).catch(() => {})
    this.mtu = await BleClient.getMtu(this.id).catch(() => null)
    await BleClient.startNotifications(this.id, SERVICE_UUID, NOTIFY_CHAR, (v) =>
      this.onNotify(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))),
    )
    return this
  }

  async write(ch: Channel, d: Uint8Array): Promise<void> {
    await BleClient.write(this.id, SERVICE_UUID, CHAR[ch], new DataView(d.buffer, d.byteOffset, d.byteLength))
  }

  async reconnect(): Promise<void> {
    await this.open()
  }

  async disconnect(): Promise<void> {
    this.closing = true
    await BleClient.disconnect(this.id).catch(() => {})
  }
}

export class NativeBackend implements Backend {
  readonly kind = 'native' as const
  readonly customPicker = true
  private ready = false

  private async init() {
    if (!this.ready) {
      await BleClient.initialize({ androidNeverForLocation: false })
      this.ready = true
    }
  }

  async check() {
    try {
      await this.init()
    } catch {
      return 'no-bluetooth' as const
    }
    if (!(await BleClient.isEnabled())) {
      await BleClient.requestEnable().catch(() => {})
      if (!(await BleClient.isEnabled())) return 'bt-off' as const
    }
    return null
  }

  async startScan(onDevices: (list: FoundDevice[]) => void): Promise<void> {
    await this.init()
    const found = new Map<string, FoundDevice>()
    await BleClient.requestLEScan({ allowDuplicates: true }, (r) => {
      if (!isPanel(r)) return
      found.set(r.device.deviceId, {
        id: r.device.deviceId,
        name: r.localName ?? r.device.name ?? r.device.deviceId,
        rssi: r.rssi,
      })
      onDevices([...found.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)))
    })
  }

  async stopScan(): Promise<void> {
    await BleClient.stopLEScan().catch(() => {})
  }

  async connect(id?: string, name?: string): Promise<Link> {
    if (!id) throw new Error('cihaz seçilmedi')
    await this.init()
    await this.stopScan()
    return new NativeLink(id, name ?? id).open()
  }

  async autoConnect(id: string, name: string): Promise<Link | null> {
    try {
      await this.init()
      if (!(await BleClient.isEnabled())) return null
      return await new NativeLink(id, name).open()
    } catch {
      return null
    }
  }
}
