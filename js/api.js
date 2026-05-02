/**
 * API 璋冪敤灞?- API SERVICE
 * 閫氱敤璇锋眰妯″潡锛岃鍙?DATA_SOURCES 閰嶇疆
 * 鏀寔锛氬垪琛ㄣ€佽鎯呫€佹悳绱€佺粺璁? * 鍐呯疆 CORS 浠ｇ悊锛堝彲閰嶇疆/鍏抽棴锛? */

const ApiService = (() => {
  'use strict';

  // CORS 浠ｇ悊閰嶇疆 - 浣跨敤 Vercel 鍐呯疆浠ｇ悊
  const CORS_PROXY = '/api/cors-proxy?url=';

  // 澶勭悊 URL锛氭牴鎹暟鎹簮閰嶇疆鍐冲畾鏄惁浣跨敤浠ｇ悊
  function proxyUrl(url, sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    const sourceCors = source?.corsProxy;
    let useProxy;
    if (sourceCors !== undefined) {
      useProxy = sourceCors;
    } else {
      useProxy = !!CORS_PROXY;
    }
    if (!useProxy) return url;
    const proxy = CORS_PROXY || 'https://api.allorigins.win/raw?url=';
    return proxy + encodeURIComponent(url);
  }

  let currentController = null;

  function getSource(sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`鏁版嵁婧?"${sourceId}" 涓嶅瓨鍦╜);
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
    const targetUrl = proxyUrl(url, sourceId);
    const fetchOptions = {};
    if (controller?.signal) {
      fetchOptions.signal = controller.signal;
    }
    fetchOptions.headers = { 'Accept': 'application/json' };

    const response = await fetch(targetUrl, fetchOptions);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('璇锋眰杩囦簬棰戠箒锛岃绋嶅悗鍐嶈瘯');
      }
      throw new Error(`璇锋眰澶辫触 (${response.status})`);
    }
    return response.json();
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
