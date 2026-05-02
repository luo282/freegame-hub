/**
 * Cloudflare Pages Function - CORS Proxy
 * 用于处理跨域请求，避免浏览器 CORS 限制
 *
 * 用法：/functions/cors-proxy?url=ENCODED_TARGET_URL
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 设置 CORS 头
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // 获取目标 URL
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing ?url= parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 发起请求到目标 URL
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'FreeGameHub/1.0',
        'Accept': 'application/json',
      },
    });

    // 获取响应内容
    const contentType = response.headers.get('content-type');
    const text = await response.text();

    // 设置响应头
    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    // 返回响应
    return new Response(text, {
      status: response.status,
      headers,
    });

  } catch (error) {
    console.error('CORS Proxy Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
