// GET /robots.txt and /sitemap.xml, built from the request's origin so they work on any domain.
// Only public pages are listed: case files are personal and marked noindex.
export const config = { runtime: 'edge' };

export default function handler(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  if (url.searchParams.get('f') === 'sitemap') {
    const pages = ['/', '/fr', '/privacy', '/fr/privacy', '/case/demo', '/case/demo?lang=fr'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}
</urlset>
`;
    return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
  }
  const txt = `User-agent: *
Allow: /
Disallow: /api/
Sitemap: ${origin}/sitemap.xml
`;
  return new Response(txt, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}
