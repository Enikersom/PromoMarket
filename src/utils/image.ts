/**
 * Image processing utilities for Google Images link extraction and fallback handling
 */

export function extractDirectImageUrl(url: string): string {
  if (!url) return '';
  let trimmed = url.trim();

  try {
    // Check if it's a Google redirect link (from google image search result)
    if (trimmed.includes('google.') && (trimmed.includes('imgurl=') || trimmed.includes('url='))) {
      // Parse query string or full URL
      const matchImgUrl = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (matchImgUrl && matchImgUrl[1]) {
        return decodeURIComponent(matchImgUrl[1]);
      }

      const matchUrl = trimmed.match(/[?&]url=([^&]+)/);
      if (matchUrl && matchUrl[1]) {
        const decoded = decodeURIComponent(matchUrl[1]);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          return decoded;
        }
      }
    }
  } catch (err) {
    console.warn('Could not parse Google image URL redirect:', err);
  }

  return trimmed;
}

export function getCategoryFallbackImage(category?: string): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('acougue') || cat.includes('carne') || cat.includes('peix')) {
    return 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('horti') || cat.includes('fruta') || cat.includes('verdura')) {
    return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('padaria') || cat.includes('pao') || cat.includes('frio')) {
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('bebida') || cat.includes('cerveja') || cat.includes('refrigerante')) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('limpeza') || cat.includes('perfumaria')) {
    return 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=800&q=80';
  }
  // Default mercearia / supermarket
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80';
}
