import type { PublicProduct } from '../../types/publicCatalog';

const cleanHtml = (value: string) => {
  const documentFragment = new DOMParser().parseFromString(value, 'text/html');
  documentFragment.querySelectorAll('script,style,iframe,object,embed').forEach((node) => node.remove());
  documentFragment.querySelectorAll('*').forEach((element) => [...element.attributes].forEach((attribute) => { if (attribute.name.startsWith('on')) element.removeAttribute(attribute.name); }));
  return documentFragment.body.innerHTML;
};

export const ProductDescription = ({ product }: { product: PublicProduct }) => {
  const content = product.description || product.guide;
  return <section className="canonical-product-description"><h2>Thông tin sản phẩm</h2>{content ? <div dangerouslySetInnerHTML={{ __html: cleanHtml(content) }} /> : <p>Thông tin chi tiết đang được cập nhật.</p>}</section>;
};
