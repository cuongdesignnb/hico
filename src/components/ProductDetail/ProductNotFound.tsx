import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { defaultMetadata } from '../../seo/buildMetadata';

export const ProductNotFound = ({ retry }: { retry?: () => void }) => <main className="route-state"><SeoHead path="/404" metadata={{ ...defaultMetadata(), title: 'Không tìm thấy sản phẩm | HICO eSIM', indexable: false }} noindex /><h1>Không tìm thấy sản phẩm</h1><p>Slug sản phẩm không tồn tại hoặc sản phẩm chưa được publish.</p>{retry && <button type="button" onClick={retry}>Thử lại</button>}<Link to="/san-pham">Quay lại danh mục</Link></main>;
