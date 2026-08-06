const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;

const SITE = 'https://cheng-shuang.netlify.app';

// 商品定價由伺服器決定，避免前端竄改金額
const PRODUCTS = {
  write:        { name: '注音符號手寫板',       price: 1050 },
  pinyin_small: { name: '注音符號拼音板（小款）', price: 920 },
  pinyin_large: { name: '注音符號拼音板（大款）', price: 1180 },
};

const SHIPPING = {
  home: { name: '宅配到府', fee: 120 },
  cvs:  { name: '超商取貨', fee: 60 },
};

const FREE_SHIP_THRESHOLD = 3600;

function credentialsMissing() {
  return !MERCHANT_ID || !HASH_KEY || !HASH_IV;
}

// 綠界要求與 .NET HttpUtility.UrlEncode 相同的編碼結果。
// 差異只有三處：空白要變 +，而 ' 與 ~ 要編碼；( ) ! * - _ . 都保持原樣。
// 門市欄位是「門市名(代號)」，括號若被編碼會導致簽章不符。
function ecpayUrlEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/%20/g, '+')
    .replace(/'/g, '%27')
    .replace(/~/g, '%7e')
    .toLowerCase();
}

function generateCheckMac(params, algorithm) {
  const sortedKeys = Object.keys(params)
    .filter(k => k !== 'CheckMacValue')
    .sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
  let raw = 'HashKey=' + HASH_KEY;
  for (const key of sortedKeys) raw += '&' + key + '=' + params[key];
  raw += '&HashIV=' + HASH_IV;
  return crypto.createHash(algorithm).update(ecpayUrlEncode(raw)).digest('hex').toUpperCase();
}

function tradeNo() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
                pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'CS' + stamp + rand;
}

function tradeDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return now.getFullYear() + '/' + pad(now.getMonth() + 1) + '/' + pad(now.getDate()) + ' ' +
         pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}

function autoSubmitForm(action, params) {
  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('');
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<title>前往綠界付款…</title>
<style>body{font-family:sans-serif;background:#F7F4EF;color:#6b5540;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-size:14px;}</style>
</head><body><p>正在前往綠界安全付款頁面…</p>
<form id="ecpayForm" method="POST" action="${action}">${inputs}</form>
<script>document.getElementById('ecpayForm').submit();</script>
</body></html>`;
}

module.exports = {
  MERCHANT_ID, HASH_KEY, HASH_IV, SITE,
  PRODUCTS, SHIPPING, FREE_SHIP_THRESHOLD,
  credentialsMissing, ecpayUrlEncode, generateCheckMac,
  tradeNo, tradeDate, autoSubmitForm,
};
