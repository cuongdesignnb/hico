import { useEffect } from 'react';

export const JsonLd = ({ id, data }: { id: string; data: Record<string, unknown> | null }) => {
  useEffect(() => {
    const scriptId = `json-ld-${id}`;
    document.getElementById(scriptId)?.remove();
    if (!data) return undefined;
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => script.remove();
  }, [data, id]);
  return null;
};
