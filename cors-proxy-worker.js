/**
 * FreeGame Hub CORS Proxy - Cloudflare Worker
 * 代理转发 RAWG 等 API 请求，绕过浏览器 CORS 限制
 *
 * 部署方法：
 * 1. 登录 https://dash.cloudflare.com → Workers & Pages → Create
 * 2. 粘贴此代码，部署
 * 3. 绑定自定义路由或使用 workers.dev 域名
 *
 * 安全：只允许代理到 rawg.io 和指定 API 域名
 */

export default {
  async fetch(request) {
    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 只允许 GET 请求
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400 });
    }

    // 安全校验：只允许代理到指定域名
    const allowedHosts = [
      'api.rawg.io',
      'www.freetogame.com',
      'gamerpower.com',
      'api.github.com',
    ];

    try {
      const target = new URL(targetUrl);
      if (!allowedHosts.includes(target.hostname)) {
        return new Response(`Host "${target.hostname}" is not allowed`, { status: 403 });
      }
    } catch {
      return new Response('Invalid target URL', { status: 400 });
    }

    try {
      const resp = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FreeGameHub/1.0',
        },
      });

      const data = await resp.text();

      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'public, max-age=300', // 缓存 5 分钟
          'X-Proxy-Target': targetUrl,
        },
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  },
};
