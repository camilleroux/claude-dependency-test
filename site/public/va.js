// Vercel Web Analytics and Speed Insights (both cookieless). Loaded before their scripts in
// /_vercel/. Case file ids are redacted to /case/[id] and query strings dropped, except ref/utm_*
// for traffic sources. Speed Insights puts the page address in `href`, Web Analytics in `url`.
(function () {
  function redact(address) {
    var url = new URL(address, location.origin);
    if (/^\/case\/[^/]+/.test(url.pathname) && url.pathname !== '/case/demo') url.pathname = '/case/[id]';
    var keep = new URLSearchParams();
    url.searchParams.forEach(function (v, k) { if (k === 'ref' || k.indexOf('utm_') === 0) keep.set(k, v); });
    url.search = keep.toString();
    url.hash = '';
    return url.toString();
  }
  function clean(event) {
    var out = Object.assign({}, event);
    if (out.url) out.url = redact(out.url);
    if (out.href) out.href = redact(out.href);
    return out;
  }
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
  window.va('beforeSend', clean);
  window.si('beforeSend', clean);
})();
