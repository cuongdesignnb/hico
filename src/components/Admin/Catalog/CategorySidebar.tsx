import { CircleHelp, FolderTree, Settings2 } from 'lucide-react';
import type { CatalogCategory } from '../../../types/catalog';

export type CategorySelection = 'all' | 'unresolved' | string;

interface CategorySidebarProps {
  categories: CatalogCategory[];
  selected: CategorySelection;
  unresolvedCount: number;
  onSelect: (value: CategorySelection) => void;
  onManage: () => void;
}

const CategorySidebar = ({ categories, selected, unresolvedCount, onSelect, onManage }: CategorySidebarProps) => {
  const roots = categories.filter((category) => category.parentId === null && category.status === 'active');
  return (
    <aside className="catalog-category-sidebar" aria-label="Danh mục sản phẩm">
      <div className="catalog-category-sidebar-heading">
        <div><FolderTree size={16} /><strong>Danh mục</strong></div>
        <button type="button" onClick={onManage} aria-label="Quản lý danh mục" title="Quản lý danh mục"><Settings2 size={15} /></button>
      </div>
      <button type="button" className={selected === 'all' ? 'is-active' : ''} onClick={() => onSelect('all')}><span>Tất cả sản phẩm</span></button>
      {roots.map((root) => (
        <div className="catalog-category-group" key={root.id}>
          <button type="button" className={selected === root.id ? 'is-active' : ''} onClick={() => onSelect(root.id)}><strong>{root.name}</strong><small>{root.productCount ?? 0}</small></button>
          <div>
            {categories.filter((category) => category.parentId === root.id && category.status === 'active').map((category) => (
              <button type="button" className={selected === category.id ? 'is-active' : ''} key={category.id} onClick={() => onSelect(category.id)}><span>{category.name}</span><small>{category.productCount ?? 0}</small></button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className={`catalog-category-unresolved ${selected === 'unresolved' ? 'is-active' : ''}`} onClick={() => onSelect('unresolved')}><CircleHelp size={14} /><span>Chưa phân loại</span><small>{unresolvedCount}</small></button>
    </aside>
  );
};

export default CategorySidebar;
