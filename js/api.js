/**
 * API 调用层 - API SERVICE
 * 通用请求模块，读取 DATA_SOURCES 配置
 * 支持：列表、详情、搜索、统计
 * 内置 CORS 代理（多代理自动故障转移）
 */

const ApiService = (() => {
  'use strict';

  // CORS 代理列表 - 按优先级排列，自动故障转移
  // 从浏览器跨域请求第三方 API 需要通过 CORS 代理
  const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',               // allorigins 公开代理（稳定）
    'https://corsproxy.io/?',                             // corsproxy.io 公开代理
    'https://api.codetabs.com/v1/proxy?quest=',          // 备用公开代理
  ];

  // 记录上次成功的代理索引（持久化到 sessionStorage）
  let workingProxyIdx = parseInt(sessionStorage.getItem('workingProxyIdx') || '0', 10);

  // 处理 URL：根据数据源配置决定是否使用代理
  function proxyUrl(url, sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    const sourceCors = source?.corsProxy;
    let useProxy;
    if (sourceCors !== undefined) {
      useProxy = sourceCors;
    } else {
      useProxy = CORS_PROXIES.length > 0;
    }
    if (!useProxy) return url;
    const proxy = CORS_PROXIES[workingProxyIdx % CORS_PROXIES.length];
    return proxy + encodeURIComponent(url);
  }

  let currentController = null;

  function getSource(sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`数据源 "${sourceId}" 不存在`);
    return source;
  }

  function getByPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  function buildUrl(baseUrl, paramConfig, filters, source) {
    let urlStr = baseUrl;

    // 支持路径参数如 {id}，例如 https://api.rawg.io/api/games/{id}
    if (urlStr.includes('{')) {
      for (const [urlParam, config] of Object.entries(paramConfig)) {
        const placeholder = `{${config.param}}`;
        if (urlStr.includes(placeholder)) {
          const value = filters[config.param];
          if (value !== undefined && value !== null && value !== '') {
            urlStr = urlStr.replace(placeholder, encodeURIComponent(value));
          }
        }
      }
    }

    const url = new URL(urlStr);

    // 从数据源配置注入 API Key
    if (source?.apiKey) {
      for (const [urlParam, config] of Object.entries(paramConfig)) {
        if (config.param === 'key' && !filters['key']) {
          url.searchParams.set(urlParam, source.apiKey);
          break;
        }
      }
    }

    for (const [urlParam, config] of Object.entries(paramConfig)) {
      const filterKey = config.param;
      const value = filters[filterKey];
      if (value !== undefined && value !== null && value !== '' && value !== 'all') {
        url.searchParams.set(urlParam, value);
      } else if (config.default !== undefined) {
        url.searchParams.set(urlParam, config.default);
      }
    }
    return url.toString();
  }

  // 请求超时时间（毫秒）
  const FETCH_TIMEOUT = 15000;

  async function request(url, controller, sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    const sourceCors = source?.corsProxy;
    const needProxy = sourceCors === undefined ? CORS_PROXIES.length > 0 : sourceCors;

    // 构建所有尝试的 URL 列表
    const urlsToTry = [];
    if (needProxy && CORS_PROXIES.length > 0) {
      // 从上次成功的代理开始尝试
      for (let i = 0; i < CORS_PROXIES.length; i++) {
        const idx = (workingProxyIdx + i) % CORS_PROXIES.length;
        urlsToTry.push(CORS_PROXIES[idx] + encodeURIComponent(url));
      }
    }
    // 最后尝试直接请求（不走代理）
    urlsToTry.push(url);

    let lastError = null;
    for (let i = 0; i < urlsToTry.length; i++) {
      // 为每次尝试创建独立的 AbortController（支持超时和取消）
      const attemptController = new AbortController();
      const timeoutId = setTimeout(() => attemptController.abort(), FETCH_TIMEOUT);

      // 如果外部传入了 signal，在取消时也中止当前尝试
      if (controller?.signal) {
        controller.signal.addEventListener('abort', () => attemptController.abort());
      }

      try {
        const response = await fetch(urlsToTry[i], {
          signal: attemptController.signal,
          headers: { 'Accept': 'application/json' },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('请求过于频繁，请稍后再试');
          }
          lastError = new Error(`请求失败 (${response.status})`);
          continue;
        }

        // 检查返回的内容类型，过滤掉 HTML 错误页面
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          lastError = new Error('返回了非 JSON 内容（可能是代理错误页面）');
          continue;
        }

        const text = await response.text();
        // 尝试解析 JSON，过滤掉非 JSON 响应
        let json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          lastError = new Error('返回的内容不是有效的 JSON');
          continue;
        }

        // 成功了，记住这个代理
        if (needProxy && i < CORS_PROXIES.length) {
          const idx = (workingProxyIdx + i) % CORS_PROXIES.length;
          workingProxyIdx = idx;
          sessionStorage.setItem('workingProxyIdx', String(idx));
        }
        return json;
      } catch (e) {
        lastError = e;
        // 区分超时错误
        if (e.name === 'AbortError') {
          lastError = new Error('请求超时，请检查网络连接');
        }
        continue;
      }
    }
    throw lastError || new Error('所有代理均失败');
  }

  async function fetchGames(sourceId, filters = {}, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;
    let url;
    let rawResponse;
    let games;
    const queryParams = { ...filters };

    if (sourceId === 'gamerpower') {
      const sortValue = filters.sort || 'date';
      queryParams['sort-by'] = sortValue;
      delete queryParams.sort;
    }

    if (sourceId === 'freetogame') {
      // FreeToGame API 参数映射
      queryParams.platform = filters.platform || 'all';
      queryParams['sort-by'] = filters.sort || 'release-date';
      if (filters.genre) {
        queryParams.category = filters.genre;
      }
    }

    // RAWG 参数映射：sort → ordering，platform → platforms
    if (sourceId === 'rawg') {
      if (filters.sort) {
        queryParams.ordering = filters.sort;
        delete queryParams.sort;
      }
      if (filters.platform) {
        queryParams.platforms = filters.platform;
        delete queryParams.platform;
      }
      queryParams.page_size = source.pageSize;
      queryParams.page = filters.page || 1;
    }

    const endpoint = source.endpoints.list;
    url = buildUrl(endpoint.url, endpoint.params, queryParams, source);
    rawResponse = await request(url, controller, sourceId);

    const rawGames = getByPath(rawResponse, endpoint.dataPath);
    games = Array.isArray(rawGames) ? rawGames : (rawGames ? [rawGames] : []);
    const adaptedGames = games.map(item => source.adapter(item));

    // 分页处理
    let pagination = null;
    if (endpoint.paginationPath) {
      const totalCount = getByPath(rawResponse, endpoint.paginationPath);
      // RAWG: count 是总数，next 为 null 表示没有更多
      if (sourceId === 'rawg') {
        pagination = {
          total: totalCount || adaptedGames.length,
          hasMore: !!rawResponse.next,  // next 不为 null 表示有下一页
        };
      } else {
        pagination = getByPath(rawResponse, endpoint.paginationPath);
      }
    }

    return {
      games: adaptedGames,
      pagination,
      rawTotal: pagination?.total || adaptedGames.length,
    };
  }

  async function searchGames(sourceId, query, filters = {}, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;

    if (!source.endpoints.search) {
      return null;
    }

    const endpoint = source.endpoints.search;
    const queryParams = { ...filters };

    if (sourceId === 'freetogame') {
      queryParams.pageSize = source.pageSize;
      queryParams.page = filters.page || 1;
    }

    // RAWG 搜索：使用 search 参数
    if (sourceId === 'rawg') {
      queryParams.search = query;
      queryParams.page_size = source.pageSize;
      queryParams.page = filters.page || 1;
    } else {
      queryParams.query = query;
    }

    const url = buildUrl(endpoint.url, endpoint.params, queryParams, source);
    const rawResponse = await request(url, controller, sourceId);

    const rawResults = getByPath(rawResponse, endpoint.dataPath);
    const results = Array.isArray(rawResults) ? rawResults : (rawResults ? [rawResults] : []);
    const adaptedResults = results.map(item => source.adapter(item));

    // 分页处理
    let pagination = null;
    if (endpoint.paginationPath) {
      const totalCount = getByPath(rawResponse, endpoint.paginationPath);
      if (sourceId === 'rawg') {
        pagination = {
          total: totalCount || adaptedResults.length,
          hasMore: !!rawResponse.next,
        };
      } else {
        pagination = getByPath(rawResponse, endpoint.paginationPath);
      }
    }

    return {
      games: adaptedResults,
      pagination,
      rawTotal: pagination?.total || adaptedResults.length,
    };
  }

  async function fetchDetail(sourceId, gameId, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;
    const endpoint = source.endpoints.detail;

    let url;
    if (sourceId === 'freetogame') {
      // FreeToGame 使用 ?id= 查询参数
      url = buildUrl(endpoint.url, endpoint.params, { id: gameId }, source);
    } else if (sourceId === 'rawg') {
      // RAWG 使用路径参数 /games/{id}
      url = buildUrl(endpoint.url, endpoint.params, { id: gameId }, source);
    } else {
      const params = {};
      params[endpoint.params.id.param] = gameId;
      url = buildUrl(endpoint.url, endpoint.params, params, source);
    }

    const rawResponse = await request(url, controller, sourceId);

    // RAWG 详情响应直接是游戏对象（不包裹在 data 中）
    let rawData;
    if (sourceId === 'rawg') {
      rawData = rawResponse;  // 直接就是游戏数据
    } else {
      rawData = getByPath(rawResponse, endpoint.dataPath);
    }

    const relatedRaw = sourceId === 'rawg'
      ? null  // RAWG 没有 related 字段
      : getByPath(rawResponse, 'data.related');

    return {
      game: source.adapter(rawData),
      related: relatedRaw ? relatedRaw.map(r => source.adapter(r)) : [],
    };
  }

  async function fetchStats(sourceId, filters = {}) {
    const source = getSource(sourceId);
    const endpoint = source.endpoints.stats;
    if (!endpoint) return null;

    const url = buildUrl(endpoint.url, endpoint.params, filters, source);
    const rawResponse = await request(url, null, sourceId);
    const rawData = getByPath(rawResponse, endpoint.dataPath);
    return source.statsAdapter ? source.statsAdapter(rawData) : rawData;
  }

  function clientFilter(games, query) {
    if (!query) return games;
    const lowerQuery = query.toLowerCase();
    return games.filter(game =>
      game.title.toLowerCase().includes(lowerQuery) ||
      (game.description && game.description.toLowerCase().includes(lowerQuery)) ||
      (game.platform && game.platform.toLowerCase().includes(lowerQuery)) ||
      (game.genre && game.genre.toLowerCase().includes(lowerQuery))
    );
  }

  return {
    fetchGames,
    searchGames,
    fetchDetail,
    fetchStats,
    clientFilter,
    getSource,
    DATA_SOURCES,
  };
})();
