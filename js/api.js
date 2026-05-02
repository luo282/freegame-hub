/**
 * ============================================================
 *  API 调用层 - API SERVICE
 * ============================================================
 *  通用请求模块，读取 DATA_SOURCES 配置
 *  支持：列表、详情、搜索、统计
 *  内置 CORS 代理（可配置/关闭）
 * ============================================================
 */

const ApiService = (() => {
  'use strict';

  /**
   * ⚙️ CORS 代理配置
   * 如果 API 不支持跨域请求，可以设置代理前缀
   * 设置为 null 或 '' 则直接请求（不使用代理）
   *
   * 常用免费代理：
   * - 'https://api.allorigins.win/raw?url='
   * - 'https://corsproxy.io/?'
   * - 'https://api.codetabs.com/v1/proxy?quest='
   * - Cloudflare Worker 自建代理
   *
   * 也可以在 data-sources.js 中为每个数据源设置 corsProxy: true/false
   */
  const CORS_PROXY = null; // 默认不使用代理，由数据源配置决定

  /**
   * 处理 URL：根据数据源配置决定是否使用代理
   */
  function proxyUrl(url, sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    const useProxy = source?.corsProxy === true || CORS_PROXY;
    if (!useProxy) return url;
    const proxy = CORS_PROXY || 'https://api.allorigins.win/raw?url=';
    return proxy + encodeURIComponent(url);
  }

  // 缓存当前请求的 AbortController 用于取消
  let currentController = null;

  /**
   * 根据数据源 ID 获取配置
   */
  function getSource(sourceId) {
    const source = DATA_SOURCES.find(s => s.id === sourceId);
    if (!source) throw new Error(`数据源 "${sourceId}" 不存在`);
    return source;
  }

  /**
   * 从嵌套对象中按路径取值
   * @param {Object} obj - 数据对象
   * @param {string|null} path - 取值路径，如 'data.games'，null 表示直接返回
   */
  function getByPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  /**
   * 构建请求 URL
   */
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

  /**
   * 通用 fetch 封装
   */
  async function request(url, controller, sourceId) {
    const targetUrl = proxyUrl(url, sourceId);
    const response = await fetch(targetUrl, {
      signal: controller?.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      }
      throw new Error(`请求失败 (${response.status})`);
    }

    return response.json();
  }

  /**
   * 获取游戏列表
   * @param {string} sourceId - 数据源 ID
   * @param {Object} filters - 筛选条件 { platform, sort, page, type }
   * @param {AbortSignal} signal - 取消信号
   * @returns {Promise<{ games: Array, pagination: Object|null }>}
   */
  async function fetchGames(sourceId, filters = {}, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;

    let url;
    let rawResponse;
    let games;

    // 构建请求参数
    const queryParams = { ...filters };

    // GamerPower 排序参数名特殊处理
    if (sourceId === 'gamerpower') {
      // GamerPower 用 sort-by 参数
      const sortValue = filters.sort || 'date';
      queryParams['sort-by'] = sortValue;
      delete queryParams.sort;
    }

    // OpenGames 排序映射
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

    // 调用列表 API
    const endpoint = source.endpoints.list;
    url = buildUrl(endpoint.url, endpoint.params, queryParams);
    rawResponse = await request(url, controller, sourceId);

    // 提取游戏数据
    const rawGames = getByPath(rawResponse, endpoint.dataPath);
    // 确保是数组
    games = Array.isArray(rawGames) ? rawGames : (rawGames ? [rawGames] : []);

    // 适配数据
    const adaptedGames = games.map(item => source.adapter(item));

    // 提取分页信息
    const pagination = endpoint.paginationPath
      ? getByPath(rawResponse, endpoint.paginationPath)
      : null;

    return {
      games: adaptedGames,
      pagination,
      rawTotal: pagination?.total || adaptedGames.length,
    };
  }

  /**
   * 搜索游戏
   * @param {string} sourceId - 数据源 ID
   * @param {string} query - 搜索关键词
   * @param {Object} filters - 其他筛选条件
   * @param {AbortSignal} signal - 取消信号
   */
  async function searchGames(sourceId, query, filters = {}, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;

    // 如果数据源不支持搜索 API，回退到客户端过滤
    if (!source.endpoints.search) {
      return null; // 返回 null 表示需要客户端过滤
    }

    const endpoint = source.endpoints.search;
    const queryParams = { query, ...filters };

    // OpenGames 搜索分页
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

  /**
   * 获取游戏详情
   * @param {string} sourceId
   * @param {string} gameId
   * @param {AbortSignal} signal
   */
  async function fetchDetail(sourceId, gameId, signal) {
    const source = getSource(sourceId);
    const controller = signal ? { signal } : null;

    const endpoint = source.endpoints.detail;

    // 构建详情 URL（可能用路径参数）
    let url;
    if (sourceId === 'opengames') {
      // OpenGames 用 URL 路径参数
      url = `${endpoint.url}/${gameId}`;
    } else {
      // 其他用查询参数
      url = buildUrl(endpoint.url, endpoint.params, { id: gameId });
    }

    // 包含相关游戏（OpenGames）
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

  /**
   * 获取统计数据
   * @param {string} sourceId
   * @param {Object} filters
   */
  async function fetchStats(sourceId, filters = {}) {
    const source = getSource(sourceId);
    const endpoint = source.endpoints.stats;

    if (!endpoint) return null;

    const url = buildUrl(endpoint.url, endpoint.params, filters);
    const rawResponse = await request(url, null, sourceId);
    const rawData = getByPath(rawResponse, endpoint.dataPath);

    return source.statsAdapter ? source.statsAdapter(rawData) : rawData;
  }

  /**
   * 客户端过滤（当 API 不支持搜索时使用）
   */
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

  // 公共 API
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
