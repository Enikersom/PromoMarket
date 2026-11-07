import { SupermarketDetails } from '../types';

/**
 * Normalizes a string by converting to lowercase, removing accents and special characters
 */
export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]/g, '-');
}

/**
 * Robustly matches a target store identifier (ID, UID, name, or slug) against a list of supermarkets
 */
export function findSupermarketMatch(
  supermarkets: SupermarketDetails[] = [],
  targetIdOrSlug?: string | null
): SupermarketDetails | undefined {
  if (!targetIdOrSlug || targetIdOrSlug === 'all') return undefined;

  const raw = targetIdOrSlug.trim();
  const clean = raw.toLowerCase();
  const slug = slugify(raw);

  // 1. Direct ID or UID match
  const directMatch = supermarkets.find((s) => {
    if (s.supermercadoId && s.supermercadoId === raw) return true;
    if (s.uid && s.uid === raw) return true;
    return false;
  });
  if (directMatch) return directMatch;

  // 2. Case-insensitive ID or UID match
  const caseInsensitiveIdMatch = supermarkets.find((s) => {
    if (s.supermercadoId && s.supermercadoId.toLowerCase() === clean) return true;
    if (s.uid && s.uid.toLowerCase() === clean) return true;
    return false;
  });
  if (caseInsensitiveIdMatch) return caseInsensitiveIdMatch;

  // 3. Name or Razão Social match (exact or slug)
  const nameMatch = supermarkets.find((s) => {
    const nome = (s.nomeFantasia || '').trim().toLowerCase();
    const razao = (s.razaoSocial || '').trim().toLowerCase();
    if (nome === clean || razao === clean) return true;

    const slugNome = slugify(s.nomeFantasia || '');
    const slugRazao = slugify(s.razaoSocial || '');
    if (slugNome && (slugNome === slug || slugNome === clean)) return true;
    if (slugRazao && (slugRazao === slug || slugRazao === clean)) return true;

    return false;
  });
  if (nameMatch) return nameMatch;

  // 4. Substring / partial slug match (e.g. "vitoria" matches "Supermercado Vitória")
  if (slug.length >= 3) {
    const partialMatch = supermarkets.find((s) => {
      const slugNome = slugify(s.nomeFantasia || '');
      return slugNome.includes(slug) || slug.includes(slugNome);
    });
    if (partialMatch) return partialMatch;
  }

  return undefined;
}

/**
 * Extracts store parameter from query string or hash URL robustly
 */
export function getStoreFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const invalidValues = new Set(['all', 'undefined', 'null', 'false', '0', 'true', 'admin', 'geral', 'neutral']);
    const searchParams = new URLSearchParams(window.location.search);
    const storeParam = searchParams.get('store') || searchParams.get('supermarket') || searchParams.get('loja') || searchParams.get('tenant');
    if (storeParam && !invalidValues.has(storeParam.trim().toLowerCase())) {
      return storeParam.trim();
    }

    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const qIdx = hash.indexOf('?');
      const hashSearch = qIdx >= 0 ? hash.slice(qIdx) : (hash.includes('=') ? `?${hash}` : '');
      if (hashSearch) {
        const hashParams = new URLSearchParams(hashSearch);
        const fromHash = hashParams.get('store') || hashParams.get('supermarket') || hashParams.get('loja') || hashParams.get('tenant');
        if (fromHash && !invalidValues.has(fromHash.trim().toLowerCase())) {
          return fromHash.trim();
        }
      }
    }
  } catch (e) {}
  return null;
}

