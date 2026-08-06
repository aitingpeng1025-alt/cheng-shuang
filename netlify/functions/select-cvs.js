const crypto = require('crypto');

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;

function generateCheckMac(params) {
  const sorted = Object.keys(params).sort().reduce((obj, key) => {
    obj[key] = params[key];
    return obj;
  }, {});
  let str = 'HashKey=' + HASH_KEY;
  for (const [k, v] of Object.entries(sorted)) str += '&' + k + '=' + v;
  str += '&HashIV=' + HASH_IV;
  str = encodeURIComponent(str)
    .replace(/%2d/gi,'-').replace(/%5f/gi,'_').replace(/%2e/gi,'.')
    .replace(/%21/gi,'!').replace(/%2a/gi,'*').replace(/%28/gi,'(').replace(/%29/gi,')').toLowerCase();
  return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };
  if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ECPay credentials are not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { cvsType, returnUrl } = body;

    // 產生訂單編號
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const merchantTradeNo = 'CS' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

    const params = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: merchantTradeNo,
      LogisticsType: 'CVS',
      LogisticsSubType: cvsType || 'FAMI',
      IsCollection: 'Y',
      ServerReplyURL: 'https://cheng-shuang.netlify.app/order-complete.html',
      ExtraData: '',
      Device: '0',
    };

    params.CheckMacValue = generateCheckMac(params);

    // 建立表單 HTML 讓前端自動送出
    const formHtml = `
      <html><body>
      <form id="f" method="POST" action="https://logistics.ecpay.com.tw/Express/map">
        ${Object.entries(params).map(([k,v]) => `<input type="hidden" name="${k}" value="${v}">`).join('')}
      </form>
      <script>document.getElementById('f').submit();</script>
      </body></html>
    `;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ formHtml, merchantTradeNo, params })
    };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
