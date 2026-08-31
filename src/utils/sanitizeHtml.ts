/**
 * Client-side HTML sanitizer for product detail tabs.
 *
 * Server uses `sanitize-html` (see server/package.json). Frontend cannot
 * import it without changing the bundle strategy, so we ship a narrow
 * allow-list scrubber that strips the highest-risk vectors:
 *
 * - <script>, <style>, <iframe>, <object>, <embed>, <link>, <meta>
 * - inline event handlers (onclick, onerror, ...)
 * - javascript: / data:text/html URIs
 */

const FORBIDDEN_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
]);

const EVENT_HANDLER_PATTERN = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URI_PATTERN = /\b(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;

const sanitizeHref = (value: string): string => value.replace(JAVASCRIPT_URI_PATTERN, '#');

const sanitizeTag = (tag: string): string => {
  if (FORBIDDEN_TAGS.has(tag.toLowerCase())) return '';
  return tag;
};

const stripDangerousAttrs = (html: string): string =>
  html.replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (_match, tag: string, attrs: string) => {
    const cleanedTag = sanitizeTag(tag);
    if (!cleanedTag) return '';
    const cleanedAttrs = attrs
      .replace(EVENT_HANDLER_PATTERN, '')
      .replace(/(\s(?:href|src|poster|cite)\s*=\s*("[^"]*"|'[^']*'))/gi, (_attrMatch, attr: string, quoted: string) => {
        const value = quoted.slice(1, -1);
        const safe = sanitizeHref(value);
        return attr.replace(quoted, `"${safe}"`);
      });
    return `<${cleanedTag}${cleanedAttrs}>`;
  });

const stripForbiddenBlocks = (html: string): string => {
  let result = html;
  for (const tag of FORBIDDEN_TAGS) {
    const openClose = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
    const selfClose = new RegExp(`<${tag}\b[^>]*/?>`, 'gi');
    result = result.replace(openClose, '').replace(selfClose, '');
  }
  return result;
};

export const sanitizeHtml = (html: string | undefined | null): string => {
  if (!html || typeof html !== 'string') return '';
  return stripForbiddenBlocks(stripDangerousAttrs(html)).trim();
};

export const stripHtml = (html: string | undefined | null): string => {
  const cleaned = sanitizeHtml(html);
  if (!cleaned) return '';
  return cleaned
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};
