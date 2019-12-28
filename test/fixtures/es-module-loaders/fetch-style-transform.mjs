/**
 * @param {string} urlString
 * @param {string} fileExtension
 */
function isFileExtensionURL(urlString, fileExtension) {
  const url = new URL(urlString);
  return url.protocol === 'file:' && url.pathname.endsWith(fileExtension);
}

/**
 * @param {Response} res
 * @param {string} mimeType
 * @param {string} fileExtension
 */
function isType(res, mimeType, fileExtension) {
  const contentType = (res.headers.get('content-type') || '').toLocaleLowerCase(
    'en'
  );
  if (contentType === mimeType) {
    return true;
  }
  return !contentType && isFileExtensionURL(res.url, fileExtension);
}

function compile(source) {
  return `\
const data = ${JSON.stringify(source)};
console.log(import.meta.url, data);
export default data;
`;
}

function isCustomScript(res) {
  return isType(res, 'application/vnd.customscript', '.custom');
}

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).then(async res => {
      if (res.status !== 200 || !isCustomScript(res)) {
        return res;
      }
      const source = await res.text();
      const body = compile(source);
      const headers = new Headers(res.headers);
      headers.set('content-type', 'text/javascript');
      return new Response(body, { headers });
    })
  );
});
