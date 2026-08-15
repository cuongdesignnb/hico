import { Archive, Plus, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createCategory, setCategoryArchived, updateCategory } from '../../../services/catalogWriteApi';
import type { CatalogCategory, CatalogCategoryKind } from '../../../types/catalog';

interface CategoryManagerDialogProps {
  categories: CatalogCategory[];
  catalogVersionId: string;
  onClose: () => void;
  onChanged: (catalogVersionId: string) => void;
}

const kindLabels: Record<CatalogCategoryKind, string> = {
  esim: 'eSIM', physical_sim: 'SIM vật lý', topup: 'Nạp thêm', device: 'Thiết bị', accessory: 'Phụ kiện',
};

const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[Đđ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const CategoryManagerDialog = ({ categories, catalogVersionId, onClose, onChanged }: CategoryManagerDialogProps) => {
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [kind, setKind] = useState<CatalogCategoryKind>('esim');
  const [sortOrder, setSortOrder] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [versionId, setVersionId] = useState(catalogVersionId);
  const roots = useMemo(() => categories.filter((category) => category.parentId === null), [categories]);

  const reset = () => { setEditing(null); setName(''); setSlug(''); setParentId(''); setKind('esim'); setSortOrder('10'); setError(''); };
  const beginEdit = (category: CatalogCategory) => { setEditing(category); setName(category.name); setSlug(category.slug); setParentId(category.parentId ?? ''); setKind(category.kind ?? 'esim'); setSortOrder(String(category.sortOrder)); setError(''); };
  const submit = async () => {
    setSaving(true); setError('');
    const payload = { name: name.trim(), slug: slug.trim(), parentId: parentId || null, kind: parentId ? kind : null, sortOrder: Number(sortOrder) };
    try {
      const response = editing
        ? await updateCategory(editing.id, { idempotencyKey: `category-update-${editing.id}-${Date.now()}`, catalogVersionId: versionId, version: editing.version, changes: payload })
        : await createCategory({ idempotencyKey: `category-create-${Date.now()}`, catalogVersionId: versionId, category: payload });
      setVersionId(response.catalogVersionId); onChanged(response.catalogVersionId); reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu danh mục.'); }
    finally { setSaving(false); }
  };
  const toggleArchive = async (category: CatalogCategory) => {
    setSaving(true); setError('');
    try {
      const response = await setCategoryArchived(category.id, category.status === 'active', { idempotencyKey: `category-status-${category.id}-${Date.now()}`, catalogVersionId: versionId, version: category.version });
      setVersionId(response.catalogVersionId); onChanged(response.catalogVersionId); reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể đổi trạng thái danh mục.'); }
    finally { setSaving(false); }
  };

  return <div className="catalog-dialog-backdrop" role="presentation"><section className="catalog-dialog catalog-category-manager" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
    <div className="catalog-dialog-heading"><div><h3 id="category-manager-title">Quản lý danh mục</h3></div><button type="button" className="catalog-icon-button" onClick={onClose} aria-label="Đóng"><X size={16} /></button></div>
    <p className="catalog-dialog-subtitle">Cây tối đa hai cấp. Product chỉ được gán vào danh mục con.</p>
    {error && <div className="catalog-category-error" role="alert">{error}</div>}
    <div className="catalog-category-manager-layout">
      <div className="catalog-category-manager-list">
        {roots.map((root) => <div key={root.id}><button type="button" onClick={() => beginEdit(root)}><strong>{root.name}</strong><span>{root.status === 'active' ? 'Đang dùng' : 'Đã ngừng'}</span></button>{categories.filter((category) => category.parentId === root.id).map((category) => <button type="button" className="is-child" key={category.id} onClick={() => beginEdit(category)}><span>{category.name}</span><small>{category.kind ? kindLabels[category.kind] : ''}</small></button>)}</div>)}
      </div>
      <div className="catalog-category-form">
        <div className="catalog-category-form-heading"><strong>{editing ? 'Chỉnh sửa' : 'Thêm danh mục'}</strong>{editing && <button type="button" className="catalog-text-button" onClick={reset}><Plus size={14} /> Tạo mới</button>}</div>
        <label><span>Tên danh mục</span><input value={name} onChange={(event) => { setName(event.target.value); if (!editing) setSlug(slugify(event.target.value)); }} /></label>
        <label><span>Slug</span><input value={slug} onChange={(event) => setSlug(slugify(event.target.value))} /></label>
        <label><span>Danh mục cha</span><select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Danh mục gốc</option>{roots.filter((root) => root.id !== editing?.id).map((root) => <option value={root.id} key={root.id}>{root.name}</option>)}</select></label>
        {parentId && <label><span>Loại sản phẩm</span><select value={kind} onChange={(event) => setKind(event.target.value as CatalogCategoryKind)}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        <label><span>Thứ tự</span><input type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} /></label>
        <div className="catalog-category-form-actions">{editing && <button type="button" className="catalog-secondary-button" disabled={saving} onClick={() => void toggleArchive(editing)}>{editing.status === 'active' ? <Archive size={15} /> : <RotateCcw size={15} />}{editing.status === 'active' ? 'Ngừng dùng' : 'Khôi phục'}</button>}<button type="button" className="catalog-primary-button" disabled={saving || !name.trim() || !slug.trim()} onClick={() => void submit()}>{saving ? 'Đang lưu...' : 'Lưu danh mục'}</button></div>
      </div>
    </div>
  </section></div>;
};

export default CategoryManagerDialog;
