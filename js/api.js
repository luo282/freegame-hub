/**
 * API 调用层 - API SERVICE
 * 通用请求模块，读取 DATA_SOURCES 配置
 * 支持：列表、详情、搜索、统计
 * 内置 CORS 代理（多代理自动故障转移）
 */

const ApiService = (() => {
  'use strict';

  // CORS 代理列表 - 按优先级排列，自动故障转移
  const CORS_PROXIES = [
    'https://cors-proxy.1416272377.workers.dev/?url=',  // 你的 Cloudflare Worker
    'https://api.codetabs.com/v1/proxy?quest=',          // 免费公开代理
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

  function buildUrl(baseUrl, paramConfig, filters) {
    const url = new URL(baseUrl);
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

    const fetchOptions = {};
    if (controller?.signal) {
      fetchOptions.signal = controller.signal;
    }
    fetchOptions.headers = { 'Accept': 'application/json' };

    let lastError = null;
    for (let i = 0; i < urlsToTry.length; i++) {
      try {
        const response = await fetch(urlsToTry[i], fetchOptions);
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('请求过于频繁，请稍后再试');
          }
          lastError = new Error(`请求失败 (${response.status})`);
          continue;
        }
        // 成功了，记住这个代理
        if (needProxy && i < CORS_PROXIES.length) {
          const idx = (workingProxyIdx + i) % CORS_PROXIES.length;
          workingProxyIdx = idx;
          sessionStorage.setItem('workingProxyIdx', String(idx));
        }
        return response.json();
      } catch (e) {
        lastError = e;
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

    if (sourceId === 'opengames') {
      const sortMap = {
        stars: { sort: 'stars', order: 'desc' },
        updatedAt: { sort: 'updatedAt', order: 'desc' },
        createdAt: { sort: 'createdAt', order: 'desc' },
        downloadCount: { sort: 'downloadCount', order: 'desc' },
      };
      const mapped = sortMap[filters.sort] || sortMap.stars;
      queryParams.sort = mapped.sort;
      queryParams.order = mapped.order;
      queryParams.pageSize = source.pageSize;
      queryParams.page = filters.page || 1;
    }

    const endpoint = source.endpoints.list;
    url = buildUrl(endpoint.url, endpoint.params, queryParams);
    rawResponse = await request(url, controller, sourceId);

    const rawGames = getByPath(rawResponse, endpoint.dataPath);
    games = Array.isArray(rawGames) ? rawGames : (rawGames ? [rawGames] : []);
    const adaptedGames = games.map(item => source.adapter(item));

    const pagination = endpoint.paginationPath
      ? getByPath(rawResponse, endpoint.paginationPath)
      : null;

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
    const queryParams = { query, ...filters };

    if (sourceId === 'opengames') {
      queryParams.pageSize = source.pageSize;
      queryParams.page = filters.page || 1;
    }

    const url = buildUrl(endpoint.url, endpoint.params, queryParams);
    const rawResponse = await request(url, controller, sourceId);

    const rawResults = getByPath(rawResponse, endpoint.dataPath);
    const results = Array.isArray(rawResults) ? rawResults : (rawResults ? [rawResults] : []);
    const adaptedResults = results.map(item => source.adapter(item));

    const pagination = endpoint.paginationPath
      ? getByPath(rawResponse, endpoint.paginationPath)
      : null;

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
    if (sourceId === 'opengames') {
      url = `${endpoint.url}/${gameId}`;
    } else {
      const params = {};
      params[endpoint.params.id.param] = gameId;
      url = buildUrl(endpoint.url, endpoint.params, params);
    }

    if (sourceId === 'opengames') {
      url += '?include=related';
    }

    const rawResponse = await request(url, controller, sourceId);
    const rawData = getByPath(rawResponse, endpoint.dataPath);
    const relatedRaw = getByPath(rawResponse, 'data.related');

    return {
      game: source.adapter(rawData),
      related: relatedRaw ? relatedRaw.map(r => source.adapter(r)) : [],
    };
  }

  async function fetchStats(sourceId, filters = {}) {
    const source = getSource(sourceId);
    const endpoint = source.endpoints.stats;
    if (!endpoint) return null;

    const url = buildUrl(endpoint.url, endpoint.params, filters);
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
