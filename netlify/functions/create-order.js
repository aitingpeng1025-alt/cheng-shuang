const E = require('./lib/ecpay');

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

function clean(value, max) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

// 結帳頁用一般表單送出，其他呼叫端可能送 JSON
function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
  if (contentType.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

function errorPage(message, statusCode) {
  const safe = String(message).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return {
    statusCode,
    headers: HTML_HEADERS,
    body: `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>無法建立訂單</title>
<style>body{font-family:'Noto Sans TC',sans-serif;background:#F7F4EF;color:#5a4535;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;}
.box{text-align:center;max-width:320px;}h1{font-size:17px;color:#a39179;font-weight:400;margin-bottom:0.8rem;}
p{font-size:13px;line-height:1.8;color:#6b5540;margin-bottom:1.4rem;}
a{display:inline-block;background:#6b5540;color:#fff;border-radius:50px;padding:0.7rem 1.8rem;font-size:13px;text-decoration:none;}</style>
</head><body><div class="box"><h1>無法建立訂單</h1><p>${safe}</p><a href="/checkout.html">返回結帳頁</a></div></body></html>`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HTML_HEADERS, body: 'Method Not Allowed' };
  if (E.credentialsMissing()) return errorPage('網站尚未完成金流設定，請透過 IG 私訊聯繫賣家。', 500);

  try {
    const body = parseBody(event);
    const product = E.PRODUCTS[body.productId];
    const shipping = E.SHIPPING[body.shipType];
    if (!product) return errorPage('找不到這個商品，請重新選擇。', 400);
    if (!shipping) return errorPage('配送方式不正確，請重新選擇。', 400);

    const name = clean(body.name, 20);
    const phone = clean(body.phone, 20);
    if (!name || !phone) return errorPage('請填寫收件人姓名與聯絡電話。', 400);

    // 宅配要地址，超商要門市
    let destination;
    if (body.shipType === 'home') {
      destination = clean(body.address, 50);
      if (!destination) return errorPage('請填寫收件地址。', 400);
    } else {
      const storeName = clean(body.storeName, 30);
      const storeId = clean(body.storeId, 10);
      if (!storeName || !storeId) return errorPage('請先選擇取貨門市。', 400);
      destination = `${storeName}(${storeId})`;
    }

    const shipFee = product.price >= E.FREE_SHIP_THRESHOLD ? 0 : shipping.fee;
    const total = product.price + shipFee;

    const params = {
      MerchantID: E.MERCHANT_ID,
      MerchantTradeNo: E.tradeNo(),
      MerchantTradeDate: E.tradeDate(),
      PaymentType: 'aio',
      TotalAmount: String(total),
      TradeDesc: 'ChengShuang',
      ItemName: `${product.name} x1${shipFee ? ` + ${shipping.name}運費` : ''}`,
      ReturnURL: `${E.SITE}/.netlify/functions/payment-callback`,
      ClientBackURL: `${E.SITE}/order-complete.html`,
      ChoosePayment: 'ALL',
      EncryptType: '1',
      // 收件資訊隨訂單帶入綠界後台，賣家在訂單查詢就看得到
      CustomField1: name,
      CustomField2: phone,
      CustomField3: destination,
      CustomField4: `${shipping.name}/運費${shipFee}`,
    };
    params.CheckMacValue = E.generateCheckMac(params, 'sha256');

    return {
      statusCode: 200,
      headers: HTML_HEADERS,
      body: E.autoSubmitForm('https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5', params),
    };
  } catch (err) {
    return errorPage('系統暫時無法處理訂單，請稍後再試。', 500);
  }
};
