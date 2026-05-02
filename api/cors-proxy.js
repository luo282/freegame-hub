/**
 * Vercel Serverless Function - CORS Proxy
 * 鐢ㄤ簬澶勭悊璺ㄥ煙璇锋眰锛岄伩鍏嶆祻瑙堝櫒 CORS 闄愬埗
 * 
 * 鐢ㄦ硶锛?api/cors-proxy?url=ENCODED_TARGET_URL
 */

export default async function handler(req, res) {
  // 璁剧疆 CORS 澶?  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 澶勭悊 OPTIONS 棰勬璇锋眰
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 鑾峰彇鐩爣 URL
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  try {
    // 鍙戣捣璇锋眰鍒扮洰鏍?URL
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'FreeGameHub/1.0',
        'Accept': 'application/json',
      },
    });

    // 鑾峰彇鍝嶅簲鍐呭
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    // 璁剧疆鍝嶅簲澶?    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // 杩斿洖鍝嶅簲
    return res.status(response.status).send(text);

  } catch (error) {
    console.error('CORS Proxy Error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
    });
  }
}
