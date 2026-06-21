export interface SeoParams {
  title?: string;
  description?: string;
  keywords?: string;
}

export const updateSeoTags = (params: SeoParams) => {
  const defaultTitle = "HICO eSIM - Kết nối toàn cầu không giới hạn";
  const defaultDesc = "Nhanh chóng, dễ dàng và tin cậy tại 200+ quốc gia. Không cần SIM vật lý. Không roaming. Chỉ cần quét và kết nối.";
  const defaultKeywords = "esim, hico esim, esim du lich, lesim, esim viet nam, esim quoc te";

  // 1. Update Title
  document.title = params.title || defaultTitle;

  // 2. Update Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', params.description || defaultDesc);

  // 3. Update Keywords
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.setAttribute('name', 'keywords');
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.setAttribute('content', params.keywords || defaultKeywords);
};
