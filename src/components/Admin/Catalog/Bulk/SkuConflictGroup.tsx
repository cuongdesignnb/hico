import type { SkuConflictGroup as SkuConflictGroupData } from '../../../../types/catalogQueue';

const SkuConflictGroup = ({ group }: { group: SkuConflictGroupData }) => <div className="catalog-queue-item"><strong>{group.sku}</strong><span>{group.variantCount.toLocaleString('vi-VN')} gói bán đang dùng cùng mã.</span><small>{group.variants.map((variant) => variant.productName ?? variant.productId).join(' · ')}</small></div>;

export default SkuConflictGroup;
