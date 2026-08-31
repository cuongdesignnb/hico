import type { PublicDeviceSpecs, PublicProduct, PublicVariant } from '../../types/publicCatalog';

const labels: Record<keyof PublicDeviceSpecs, string> = {
  brand: 'Thương hiệu', model: 'Model', networkGeneration: 'Thế hệ mạng', formFactor: 'Kiểu thiết bị', supportedBands: 'Băng tần', wifiStandard: 'Chuẩn Wi-Fi', maxConnectedDevices: 'Số thiết bị kết nối tối đa', batteryCapacity: 'Dung lượng pin', ethernetPorts: 'Cổng Ethernet', usbPorts: 'Cổng USB', simCompatibility: 'Tương thích SIM', dimensions: 'Kích thước', weight: 'Khối lượng', color: 'Màu sắc', warrantyMonths: 'Bảo hành (tháng)',
};

export const DeviceSpecifications = ({ product, variant }: { product: PublicProduct; variant: PublicVariant | null }) => {
  if (product.operation !== 'device_sale') return null;
  const specs = product.deviceSpecs || variant?.deviceSpecs;
  if (!specs) return <section className="canonical-product-description"><h2>Thông số thiết bị</h2><p>Thông số thiết bị đang chờ Admin review.</p></section>;
  return <section className="canonical-device-specs"><h2>Thông số thiết bị</h2><dl>{(Object.entries(specs) as [keyof PublicDeviceSpecs, PublicDeviceSpecs[keyof PublicDeviceSpecs]][]).map(([key, value]) => <div key={key}><dt>{labels[key]}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl></section>;
};
