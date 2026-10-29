// يمنع استدعاء المسارات من مواقع أخرى بمفاتيحك: يقبل الطلبات من نفس النطاق فقط.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

module.exports = { sameOrigin };
