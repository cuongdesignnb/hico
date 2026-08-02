import type { QueueResponse, SkuConflictGroup as SkuConflictGroupData } from '../../../../types/catalogQueue';
import SkuConflictGroup from './SkuConflictGroup';

const SkuConflictQueue = ({ data }: { data: QueueResponse<SkuConflictGroupData> | null }) => <div className="catalog-queue-list">{data?.items.length ? data.items.map((group) => <SkuConflictGroup key={group.groupId} group={group} />) : <span className="catalog-queue-empty">Không có nhóm SKU trùng.</span>}</div>;

export default SkuConflictQueue;
