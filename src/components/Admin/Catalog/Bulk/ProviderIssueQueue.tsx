import type { ProviderIssueItem, QueueResponse } from '../../../../types/catalogQueue';

const ProviderIssueQueue = ({ data }: { data: QueueResponse<ProviderIssueItem> | null }) => <div className="catalog-queue-list">{data?.items.length ? data.items.map((item) => <div className="catalog-queue-item" key={item.id}><strong>{item.productName ?? item.productId}</strong><span>{item.sku}</span><small>{item.issueMessage}</small></div>) : <span className="catalog-queue-empty">Không có lỗi nguồn cấp.</span>}</div>;

export default ProviderIssueQueue;
