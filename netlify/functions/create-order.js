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
  return crypto.createHash('sha256').update(str).digest('hex').toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ECPay credentials are not configured' }) };
  }
  try {
    const body = JSON.parse(event.body);
    const { productName, price, payMethod } = body;
    const now = new Date();
    const pad = n => String(n).padStart(2,'0');
    const tradeNo = 'CS' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const tradeDate = now.getFullYear() + '/' + pad(now.getMonth()+1) + '/' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    const params = {
      MerchantID: MERCHANT_ID,
      MerchantTradeNo: tradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: String(price),
      TradeDesc: 'ChengShuang教材',
      ItemName: productName,
      ReturnURL: 'https://cheng-shuang.netlify.app/order-complete.html',
      ClientBackURL: 'https://cheng-shuang.netlify.app/order-complete.html',
      ChoosePayment: payMethod,
      EncryptType: '1',
    };
    params.CheckMacValue = generateCheckMac(params);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, action: 'https://payment.ecpay.com.tw/Checkout/Index' })
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
