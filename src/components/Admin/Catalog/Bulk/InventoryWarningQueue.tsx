import type { InventoryWarningItem, QueueResponse } from '../../../../types/catalogQueue';

const InventoryWarningQueue = ({ data }: { data: QueueResponse<InventoryWarningItem> | null }) => <div className="catalog-queue-list">{data?.items.length ? data.items.map((item) => <div className="catalog-queue-item" key={item.id}><strong>{item.productName ?? item.variantId}</strong><span>{item.sku ?? item.variantId}{item.stock !== undefined ? ` · còn ${item.stock}` : ''}</span><small>{item.message}</small></div>) : <span className="catalog-queue-empty">Không có cảnh báo tồn kho.</span>}</div>;

export default InventoryWarningQueue;
