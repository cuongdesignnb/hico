import type { CatalogCategory, ProductOperation } from '../../../../types/catalog';

interface ProductCategoryStepProps {
  categories: CatalogCategory[];
  categoryId: string;
  onChange: (categoryId: string, operation: ProductOperation) => void;
}

const operationByKind = (kind: CatalogCategory['kind']): ProductOperation => {
  if (kind === 'topup') return 'topup';
  if (kind === 'device' || kind === 'accessory') return 'device_sale';
  return 'new_subscription';
};

const ProductCategoryStep = ({ categories, categoryId, onChange }: ProductCategoryStepProps) => {
  const roots = categories.filter((category) => category.parentId === null && category.status === 'active');
  const selected = categories.find((category) => category.id === categoryId);
  const selectedOperation = selected ? operationByKind(selected.kind) : null;
  return <section className="product-wizard-step-content">
    <div className="product-wizard-section-heading"><span className="product-wizard-kicker">Bước 1</span><h3>Danh mục & loại sản phẩm</h3><p>Chọn đúng danh mục con. Quốc gia và vùng phủ được cấu hình ở bước tiếp theo.</p></div>
    <div className="product-wizard-category-grid">
      {roots.map((root) => <section className="product-wizard-category-group" key={root.id}><h4>{root.name}</h4><div>{categories.filter((category) => category.parentId === root.id && category.status === 'active' && category.kind !== 'topup').map((category) => <button type="button" className={categoryId === category.id ? 'is-selected' : ''} key={category.id} onClick={() => onChange(category.id, operationByKind(category.kind))}><strong>{category.name}</strong><span>{category.kind === 'esim' ? 'eSIM' : category.kind === 'physical_sim' ? 'SIM vật lý' : category.kind === 'device' ? 'Thiết bị' : 'Phụ kiện'}</span></button>)}</div></section>)}
    </div>
    {selected && selectedOperation && <div className="product-wizard-category-result"><span>Nghiệp vụ được suy ra</span><strong>{selectedOperation === 'new_subscription' ? 'Mua SIM mới' : selectedOperation === 'topup' ? 'Nạp thêm' : 'Bán thiết bị / phụ kiện'}</strong><small>{selected.name}</small></div>}
  </section>;
};

export default ProductCategoryStep;
