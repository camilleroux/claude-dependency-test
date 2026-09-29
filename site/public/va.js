// Vercel Web Analytics (cookieless). Loaded before /_vercel/insights/script.js.
// Case file ids are redacted to /case/[id] and query strings dropped, except ref/utm_* for sources.
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
window.va('beforeSend', function (event) {
  var url = new URL(event.url);
  if (/^\/case\/[^/]+/.test(url.pathname) && url.pathname !== '/case/demo') url.pathname = '/case/[id]';
  var keep = new URLSearchParams();
  url.searchParams.forEach(function (v, k) { if (k === 'ref' || k.indexOf('utm_') === 0) keep.set(k, v); });
  url.search = keep.toString();
  return Object.assign({}, event, { url: url.toString() });
});
