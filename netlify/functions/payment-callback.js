const E = require('./lib/ecpay');

// 綠界付款完成後的伺服器端通知（ReturnURL）。
// 綠界要求回應純文字 1|OK，否則會持續重送。
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (E.credentialsMissing()) return { statusCode: 500, body: '0|credentials missing' };

  try {
    const raw = event.body || '';
    const decoded = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
    const fields = Object.fromEntries(new URLSearchParams(decoded));

    const received = String(fields.CheckMacValue || '').toUpperCase();
    const expected = E.generateCheckMac(fields, 'sha256');
    if (received !== expected) {
      console.warn('CheckMacValue mismatch', { tradeNo: fields.MerchantTradeNo });
      return { statusCode: 400, body: '0|CheckMacValue error' };
    }

    // 訂單摘要寫進 Netlify function log，綠界後台也查得到同樣資料
    console.log('ECPay payment result', {
      tradeNo: fields.MerchantTradeNo,
      rtnCode: fields.RtnCode,
      amount: fields.TradeAmt,
      paidAt: fields.PaymentDate,
      recipient: fields.CustomField1,
      phone: fields.CustomField2,
      destination: fields.CustomField3,
      shipping: fields.CustomField4,
    });

    return { statusCode: 200, body: '1|OK' };
  } catch (err) {
    console.error('payment-callback failed', err);
    return { statusCode: 500, body: '0|' + err.message };
  }
};
