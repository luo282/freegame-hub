/**
 * ============================================================
 *  数据源配置文件 - DATA SOURCES CONFIG
 * ============================================================
 *
 *  如何更换/添加数据源：
 *  1. 在 DATA_SOURCES 数组中修改现有数据源 或 添加新对象
 *  2. 每个数据源必须提供：
 *     - id          : 唯一标识（英文）
 *     - name        : 显示名称
 *     - description : 简短描述
 *     - icon        : emoji 图标
 *     - endpoints   : API 端点配置
 *     - adapter     : 数据适配器（将原始 API 响应转为统一格式）
 *     - platforms   : 可筛选的平台列表
 *     - sortOptions : 可排序的选项列表
 *     - pageSize    : 每页数量
 *
 *  修改后提交推送即可自动生效（GitHub Pages）
 * ============================================================
 */

const DATA_SOURCES = [
  // ========================
  // 数据源 1：GamerPower - 限时免费游戏
  // ========================
  {
    id: 'gamerpower',
    name: '限时免费',
    description: 'Epic / Steam / GOG 等平台限时免费游戏',
    icon: '🎁',
    pageSize: 12,
    corsProxy: true, // 从浏览器跨域访问需要 CORS 代理

    // API 端点配置
    endpoints: {
      // 游戏列表
      list: {
        url: 'https://gamerpower.com/api/giveaways',
        // 支持的查询参数映射：key = URL参数名, value = { param: '对应筛选参数名', default: '默认值' }
        params: {
          platform: { param: 'platform', default: 'pc' },
          type: { param: 'type', default: 'game' },
          'sort-by': { param: 'sort', default: 'date' },
        },
        // 响应数据路径（JSON 取值路径）
        dataPath: null, // null 表示直接是数组
        // 分页信息路径
        paginationPath: null, // 无分页，返回全部
      },
      // 单个游戏详情
      detail: {
        url: 'https://gamerpower.com/api/giveaway',
        params: {
          id: { param: 'id', required: true },
        },
        dataPath: null,
      },
      // 统计数据
      stats: {
        url: 'https://gamerpower.com/api/worth',
        params: {},
        dataPath: null,
      },
      // 搜索（使用 filter 端点实现搜索）
      search: null, // GamerPower 不支持直接搜索，回退到客户端过滤
    },

    // 平台筛选选项 { label: 显示名, value: API参数值 }
    platforms: [
      { label: '全部', value: 'pc' },
      { label: 'Steam', value: 'steam' },
      { label: 'Epic', value: 'epic-games-store' },
      { label: 'GOG', value: 'gog' },
      { label: 'itch.io', value: 'itchio' },
      { label: '战网', value: 'battlenet' },
      { label: 'Ubisoft', value: 'ubisoft' },
      { label: 'Origin', value: 'origin' },
      { label: 'DRM-Free', value: 'drm-free' },
      { label: 'Android', value: 'android' },
      { label: 'iOS', value: 'ios' },
      { label: 'PS5', value: 'ps5' },
      { label: 'Xbox', value: 'xbox-series-xs' },
      { label: 'Switch', value: 'switch' },
    ],

    // 排序选项
    sortOptions: [
      { label: '最新发布', value: 'date' },
      { label: '价值最高', value: 'value' },
      { label: '最受欢迎', value: 'popularity' },
    ],

    // ⭐ 数据适配器：原始 API 响应 → 统一格式
    adapter(rawItem) {
      return {
        id: String(rawItem.id),
        title: rawItem.title || '未知游戏',
        image: rawItem.thumbnail || rawItem.image || '',
        description: rawItem.description || rawItem.raw_data?.description || '暂无描述',
        platform: rawItem.platform || 'PC',
        genre: rawItem.type || 'game',
        // 跳转链接
        openUrl: rawItem.open_giveaway_url || '#',
        openUrlLabel: '前往领取',
        // 扩展信息
        worth: rawItem.worth || '免费',
        endDate: rawItem.end_date || null,
        publisher: rawItem.publisher || '',
        developer: rawItem.developer || '',
        instructions: rawItem.instructions || '',
        startDate: rawItem.published_date || '',
        gamersgate: rawItem.gamersgate || '',
        type: rawItem.type || 'game',
        status: rawItem.status || 'Active',
        featured: rawItem.featured || false,
        // 统一星级（限时免费无星级，用价值代替）
        rating: null,
      };
    },

    // 统计数据适配器
    statsAdapter(rawStats) {
      return {
        totalGames: rawStats.count || 0,
        totalValue: `$${rawStats.worth || 0}`,
        extra: `共 ${rawStats.count || 0} 款免费游戏，总价值 $${rawStats.worth || 0}`,
      };
    },
  },

  // ========================
  // 数据源 2：FreeToGame - 免费游戏数据库
  // ========================
  {
    id: 'freetogame',
    name: '免费游戏',
    description: '400+ 免费游戏，支持多平台多类型筛选',
    icon: '🎮',
    pageSize: 12,
    corsProxy: true, // FreeToGame API 从浏览器跨域访问需要 CORS 代理

    endpoints: {
      list: {
        url: 'https://www.freetogame.com/api/games',
        params: {
          platform: { param: 'platform', default: 'all' },
          category: { param: 'category' },
          'sort-by': { param: 'sort', default: 'release-date' },
        },
        dataPath: null, // 直接返回数组
        paginationPath: null, // 无分页，返回全部
      },
      detail: {
        url: 'https://www.freetogame.com/api/game',
        params: {
          id: { param: 'id', required: true },
        },
        dataPath: null,
      },
      search: null, // FreeToGame 不支持搜索，回退到客户端过滤
      stats: null, // 无统计端点，使用列表长度计算
    },

    platforms: [
      { label: '全部', value: 'all' },
      { label: 'PC (Windows)', value: 'pc' },
      { label: '浏览器', value: 'browser' },
    ],

    sortOptions: [
      { label: '最新发布', value: 'release-date' },
      { label: '最受欢迎', value: 'popularity' },
      { label: '字母排序', value: 'alphabetical' },
      { label: '相关性', value: 'relevance' },
    ],

    adapter(rawItem) {
      return {
        id: String(rawItem.id),
        title: rawItem.title || '未知游戏',
        image: rawItem.thumbnail || '',
        description: rawItem.short_description || rawItem.description || '暂无描述',
        platform: rawItem.platform || 'PC (Windows)',
        genre: rawItem.genre || 'Unknown',
        openUrl: rawItem.game_url || '#',
        openUrlLabel: '立即游玩',
        // 扩展信息
        publisher: rawItem.publisher || '',
        developer: rawItem.developer || '',
        releaseDate: rawItem.release_date || '',
        freetogameUrl: rawItem.freetogame_profile_url || '',
        type: rawItem.genre || 'game',
        status: rawItem.status || 'Live',
        // FreeToGame 没有星级，用 genre 代替
        rating: null,
      };
    },

    statsAdapter(rawStats) {
      // FreeToGame 没有统计端点，使用列表数据计算
      const count = Array.isArray(rawStats) ? rawStats.length : 0;
      return {
        totalGames: count,
        totalValue: null,
        extra: `共 ${count} 款免费游戏，涵盖多种类型和平台`,
      };
    },
  },

  // ====================================================================
  //  ✏️ 在此处添加更多数据源
  //  复制上面的结构，修改 id/name/endpoints/adapter 即可
  // ====================================================================

  // ========================
  // 数据源 3：RAWG - 全球最大游戏数据库（俄罗斯）
  // ========================
  {
    id: 'rawg',
    name: '全部游戏',
    description: 'RAWG 全球游戏数据库，50万+ 游戏数据',
    icon: '🌐',
    pageSize: 20,
    corsProxy: true,
    // ⚠️ API Key：需要从 https://rawg.io/apidocs 免费注册获取，替换下面的值
    apiKey: '7c9e6b3b8ef7419e9c5ff42b85f90e42',

    endpoints: {
      // 游戏列表（支持分页）
      list: {
        url: 'https://api.rawg.io/api/games',
        params: {
          key: { param: 'key', required: true },
          page_size: { param: 'page_size', default: 20 },
          page: { param: 'page', default: 1 },
          search: { param: 'search' },
          ordering: { param: 'ordering' },
          platforms: { param: 'platforms' },
          genres: { param: 'genres' },
          tags: { param: 'tags' },
          dates: { param: 'dates' },
        },
        dataPath: 'results',
        paginationPath: 'count',
      },
      // 单个游戏详情（路径参数 {id}）
      detail: {
        url: 'https://api.rawg.io/api/games/{id}',
        params: {
          id: { param: 'id', required: true },
          key: { param: 'key', required: true },
        },
        dataPath: null,
      },
      // 搜索（复用 list 端点 + search 参数）
      search: {
        url: 'https://api.rawg.io/api/games',
        params: {
          key: { param: 'key', required: true },
          search: { param: 'search', required: true },
          page_size: { param: 'page_size', default: 20 },
          page: { param: 'page', default: 1 },
          ordering: { param: 'ordering' },
        },
        dataPath: 'results',
        paginationPath: 'count',
      },
      // 统计数据（使用 genres 端点获取类型数量作为统计）
      stats: {
        url: 'https://api.rawg.io/api/genres',
        params: {
          key: { param: 'key', required: true },
        },
        dataPath: 'count',
      },
    },

    // 平台筛选（RAWG 使用平台 ID）
    platforms: [
      { label: '全部', value: '' },
      { label: 'PC', value: '4' },
      { label: 'PlayStation 5', value: '187' },
      { label: 'PlayStation 4', value: '18' },
      { label: 'Xbox Series S/X', value: '186' },
      { label: 'Xbox One', value: '1' },
      { label: 'Nintendo Switch', value: '7' },
      { label: 'Android', value: '21' },
      { label: 'iOS', value: '3' },
    ],

    // 排序选项
    sortOptions: [
      { label: '热门程度', value: '-rating' },
      { label: '最新发布', value: '-released' },
      { label: '名称 A-Z', value: 'name' },
      { label: '最多收藏', value: '-added' },
    ],

    // ⭐ 数据适配器：RAWG API 响应 → 统一格式
    adapter(rawItem) {
      // 平台格式: platforms: [{ platform: { id, name, slug } }]
      const platformNames = rawItem.platforms?.map(p => p.platform?.name).filter(Boolean).join(', ') || 'Unknown';
      // 类型格式: genres: [{ id, name, slug }]
      const genreNames = rawItem.genres?.map(g => g.name).filter(Boolean).join(', ') || 'Unknown';

      return {
        id: String(rawItem.id),
        title: rawItem.name || '未知游戏',
        image: rawItem.background_image || '',
        description: rawItem.description_raw || (rawItem.description ? rawItem.description.replace(/<[^>]*>/g, '') : '暂无描述'),
        platform: platformNames,
        genre: genreNames,
        openUrl: rawItem.website || `https://rawg.io/games/${rawItem.slug || rawItem.id}`,
        openUrlLabel: rawItem.website ? '访问官网' : '查看详情',
        // 扩展信息
        publisher: rawItem.publishers?.map(p => p.name).filter(Boolean).join(', ') || '',
        developer: rawItem.developers?.map(d => d.name).filter(Boolean).join(', ') || '',
        releaseDate: rawItem.released || '',
        rating: rawItem.rating || null,
        metacritic: rawItem.metacritic || null,
        playtime: rawItem.playtime || null,
        website: rawItem.website || '',
        type: genreNames,
        status: rawItem.tba ? 'TBA' : (rawItem.released ? '已发布' : '未知'),
        stars: Math.round(rawItem.rating || 0),  // 用于卡片星级显示
        // RAWG 特有字段
        esrbRating: rawItem.esrb_rating?.name || '',
        tags: rawItem.tags?.map(t => t.name).filter(Boolean).join(', ') || '',
      };
    },

    // 统计数据适配器
    statsAdapter(rawStats) {
      // rawStats 是 genres 的 count（类型总数）
      const genresCount = typeof rawStats === 'number' ? rawStats : 0;
      return {
        totalGames: '500000+',
        totalValue: null,
        extra: `覆盖 ${genresCount} 种游戏类型，50万+ 款游戏数据`,
      };
    },
  },

  // {
  //   id: 'your-custom-source',
  //   name: '自定义数据源',
  //   description: '你的自定义 API 描述',
  //   icon: '🎮',
  //   pageSize: 12,
  //   endpoints: {
  //     list: {
  //       url: 'https://your-api.com/api/games',
  //       params: { /* ... */ },
  //       dataPath: 'data.results',
  //       paginationPath: 'meta',
  //     },
  //     detail: { url: 'https://your-api.com/api/games', params: { id: { param: 'id', required: true } }, dataPath: 'data' },
  //     search: { url: 'https://your-api.com/api/search', params: { q: { param: 'q', required: true } }, dataPath: 'data.results', paginationPath: 'meta' },
  //     stats: { url: 'https://your-api.com/api/stats', params: {}, dataPath: 'data' },
  //   },
  //   platforms: [
  //     { label: '全部', value: 'all' },
  //   ],
  //   sortOptions: [
  //     { label: '最新', value: 'latest' },
  //   ],
  //   adapter(rawItem) {
  //     return {
  //       id: String(rawItem.id),
  //       title: rawItem.name,
  //       image: rawItem.cover,
  //       description: rawItem.desc,
  //       platform: rawItem.platform,
  //       genre: rawItem.category,
  //       openUrl: rawItem.download_url,
  //       openUrlLabel: '下载',
  //       rating: rawItem.score,
  //     };
  //   },
  //   statsAdapter(rawStats) {
  //     return { totalGames: rawStats.total, totalValue: null, extra: '' };
  //   },
  // },
];
