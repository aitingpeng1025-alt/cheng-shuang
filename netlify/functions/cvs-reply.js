const E = require('./lib/ecpay');

// 綠界電子地圖選完門市後，會把門市資料 POST 回這裡。
// 這頁再用 postMessage 把門市送回原本的結帳視窗，然後自己關掉。
exports.handler = async (event) => {
  const raw = event.body || '';
  const decoded = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
  const fields = Object.fromEntries(new URLSearchParams(decoded));

  const store = {
    id: fields.CVSStoreID || '',
    name: fields.CVSStoreName || '',
    address: fields.CVSAddress || '',
    subType: fields.LogisticsSubType || '',
  };

  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<title>門市已選擇</title>
<style>body{font-family:sans-serif;background:#F7F4EF;color:#6b5540;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px;text-align:center;padding:1rem;}</style>
</head><body>
<div><p>門市已選擇，正在回到結帳頁…</p><p id="fallback" style="font-size:12px;color:#b0a898;"></p></div>
<script>
var store = ${JSON.stringify(store)};
try {
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: 'ecpay-cvs-store', store: store }, ${JSON.stringify(E.SITE)});
    window.close();
  } else {
    document.getElementById('fallback').textContent = '請手動關閉此視窗並回到結帳頁重新選擇。';
  }
} catch (e) {
  document.getElementById('fallback').textContent = '無法回傳門市資料，請關閉此視窗後重試。';
}
</script>
</body></html>`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
};
