/**
 * ============================================================
 *  应用入口 - APP ENTRY
 * ============================================================
 *  初始化、事件绑定、模块协调
 * ============================================================
 */

const App = (() => {
  'use strict';

  // ==================== 应用状态 ====================
  const state = {
    currentSourceId: DATA_SOURCES[0]?.id || 'gamerpower',
    currentPlatform: 'pc',
    currentSort: 'date',
    currentPage: 1,
    searchQuery: '',
    isSearching: false,
    allGames: [],      // 缓存全部游戏（用于客户端搜索）
    games: [],         // 当前显示的游戏
    hasMore: false,
    total: 0,
    isLoading: false,
  };

  // 防抖定时器
  let searchTimer = null;
  // AbortController
  let abortController = null;

  // ==================== 初始化 ====================
  function init() {
    // 渲染初始 UI
    renderInitialUI();
    // 绑定事件
    bindEvents();
    // 加载数据
    loadData();
  }

  function renderInitialUI() {
    const source = ApiService.getSource(state.currentSourceId);
    UI.renderSourceTabs(DATA_SOURCES, state.currentSourceId);
    UI.renderPlatformFilters(source.platforms, state.currentPlatform);
    UI.renderSortOptions(source.sortOptions, state.currentSort);
    UI.renderSkeleton();
    loadStats();
  }

  // 判断当前数据源是否使用服务端分页（而非 "load more" 追加）
  function usesServerPagination() {
    const source = ApiService.getSource(state.currentSourceId);
    return source.endpoints.list.paginationPath && source.pageSize > 0;
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 数据源切换
    UI.$('#source-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.source-tab');
      if (!tab) return;
      const sourceId = tab.dataset.source;
      switchSource(sourceId);
    });

    // 平台筛选
    UI.$('#platform-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      state.currentPlatform = chip.dataset.platform;
      // 更新激活状态
      UI.$$('#platform-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      resetAndLoad();
    });

    // 排序切换
    UI.$('#sort-options').addEventListener('click', (e) => {
      const chip = e.target.closest('.sort-chip');
      if (!chip) return;
      state.currentSort = chip.dataset.sort;
      UI.$$('#sort-options .sort-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      resetAndLoad();
    });

    // 搜索输入（防抖）
    UI.$('#search-input').addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchQuery = query;
        if (query.length > 0) {
          performSearch(query);
        } else {
          state.isSearching = false;
          UI.clearSearchHint();
          // 恢复全部游戏显示
          state.games = state.allGames;
          UI.renderGames(state.games);
          UI.renderLoadMore(state.hasMore);
        }
      }, 300);
    });

    // 清除搜索
    UI.$('#search-clear')?.addEventListener('click', () => {
      UI.$('#search-input').value = '';
      state.searchQuery = '';
      state.isSearching = false;
      UI.clearSearchHint();
      state.games = state.allGames;
      UI.renderGames(state.games);
      UI.renderLoadMore(state.hasMore);
    });

    // 加载更多
    UI.$('#load-more-container').addEventListener('click', (e) => {
      if (e.target.closest('#load-more-btn')) {
        loadMore();
      }
    });

    // 翻页导航（服务端分页模式）
    UI.$('#load-more-container').addEventListener('click', (e) => {
      const pageBtn = e.target.closest('.page-btn');
      if (pageBtn) {
        const page = parseInt(pageBtn.dataset.page, 10);
        if (page && page !== state.currentPage) {
          goToPage(page);
        }
      }
    });

    // 游戏卡片点击
    UI.$('#games-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.game-card');
      if (card) {
        const gameId = card.dataset.gameId;
        openDetail(gameId);
      }
    });

    // 键盘操作卡片
    UI.$('#games-grid').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const card = e.target.closest('.game-card');
        if (card) {
          openDetail(card.dataset.gameId);
        }
      }
    });

    // 弹窗关闭
    UI.$('#modal').addEventListener('click', (e) => {
      if (e.target.closest('.modal-close') || e.target.closest('.modal-overlay')) {
        UI.closeModal();
      }
    });

    // ESC 关闭弹窗
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });

    // 弹窗内相关游戏点击
    UI.$('#modal').addEventListener('click', (e) => {
      const item = e.target.closest('.related-item');
      if (item) {
        const gameId = item.dataset.gameId;
        openDetail(gameId);
      }
    });

    // Enter 搜索
    UI.$('#search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        const query = e.target.value.trim();
        state.searchQuery = query;
        if (query.length > 0) {
          performSearch(query);
        }
      }
    });
  }

  // ==================== 数据加载 ====================
  async function loadData() {
    if (state.isLoading) return;
    state.isLoading = true;
    UI.renderSkeleton();

    // 取消上一个请求
    if (abortController) abortController.abort();
    abortController = new AbortController();

    try {
      const result = await ApiService.fetchGames(
        state.currentSourceId,
        {
          platform: state.currentPlatform,
          sort: state.currentSort,
          page: state.currentPage,
        },
        abortController.signal
      );

      state.games = result.games;
      state.allGames = result.games;
      state.hasMore = result.pagination?.hasMore || false;
      state.total = result.rawTotal;

      UI.renderGames(result.games);

      if (usesServerPagination()) {
        // 服务端分页：显示页码导航
        const pageSize = ApiService.getSource(state.currentSourceId).pageSize;
        UI.renderPagination(state.currentPage, Math.ceil(state.total / pageSize), state.total);
      } else {
        // 无分页数据源：显示 "加载更多" 按钮
        UI.renderLoadMore(state.hasMore);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('加载失败:', err);
      UI.showError(err.message || '加载失败，请稍后重试');
    } finally {
      state.isLoading = false;
      abortController = null;
    }
  }

  async function loadMore() {
    if (state.isLoading) return;
    state.isLoading = true;
    UI.showLoading();

    state.currentPage++;

    try {
      const result = await ApiService.fetchGames(
        state.currentSourceId,
        {
          platform: state.currentPlatform,
          sort: state.currentSort,
          page: state.currentPage,
        }
      );

      state.games = [...state.games, ...result.games];
      state.allGames = state.games;
      state.hasMore = result.pagination?.hasMore || false;
      state.total = result.rawTotal;

      UI.renderGames(state.games);
      UI.renderLoadMore(state.hasMore);
    } catch (err) {
      console.error('加载更多失败:', err);
      state.currentPage--;
      UI.showError('加载更多失败');
    } finally {
      state.isLoading = false;
      UI.hideLoading();
    }
  }

  async function loadStats() {
    try {
      const stats = await ApiService.fetchStats(
        state.currentSourceId,
        { platform: state.currentPlatform }
      );
      UI.renderStats(stats);
    } catch (err) {
      console.warn('统计加载失败:', err);
    }
  }

  // ==================== 搜索 ====================
  async function performSearch(query) {
    state.isSearching = true;

    // 先尝试 API 搜索
    try {
      const result = await ApiService.searchGames(
        state.currentSourceId,
        query,
        { platform: state.currentPlatform, page: 1 }
      );

      if (result !== null) {
        // API 支持搜索
        state.games = result.games;
        state.hasMore = result.pagination?.hasMore || false;
        state.total = result.rawTotal;
        UI.renderGames(result.games);
        UI.updateSearchHint(result.games.length, query);

        if (usesServerPagination()) {
          const pageSize = ApiService.getSource(state.currentSourceId).pageSize;
          UI.renderPagination(state.currentPage, Math.ceil(state.total / pageSize), state.total);
        } else {
          UI.renderLoadMore(state.hasMore);
        }
        return;
      }
    } catch (err) {
      console.warn('API 搜索失败，回退到客户端过滤:', err);
    }

    // 客户端过滤
    const filtered = ApiService.clientFilter(state.allGames, query);
    state.games = filtered;
    UI.renderGames(filtered);
    UI.renderLoadMore(false);
    UI.updateSearchHint(filtered.length, query);
  }

  // ==================== 详情 ====================
  async function openDetail(gameId) {
    try {
      const result = await ApiService.fetchDetail(state.currentSourceId, gameId);
      UI.renderModal(result.game, result.related);
    } catch (err) {
      console.error('加载详情失败:', err);
      // 尝试从缓存数据展示
      const cached = state.allGames.find(g => g.id === gameId);
      if (cached) {
        UI.renderModal(cached);
      } else {
        alert('加载详情失败');
      }
    }
  }

  // ==================== 切换数据源 ====================
  function switchSource(sourceId) {
    if (sourceId === state.currentSourceId) return;

    state.currentSourceId = sourceId;
    state.currentPage = 1;
    state.searchQuery = '';
    state.isSearching = false;
    state.allGames = [];
    state.games = [];

    // 重置搜索输入
    if (UI.$('#search-input')) UI.$('#search-input').value = '';
    UI.clearSearchHint();

    // 更新 UI
    const source = ApiService.getSource(sourceId);

    UI.$$('#source-tabs .source-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.source === sourceId);
    });

    UI.renderPlatformFilters(source.platforms, source.platforms[0]?.value || 'all');
    UI.renderSortOptions(source.sortOptions, source.sortOptions[0]?.value || 'date');

    state.currentPlatform = source.platforms[0]?.value || 'all';
    state.currentSort = source.sortOptions[0]?.value || 'date';

    loadStats();
    loadData();
  }

  // ==================== 重置并加载 ====================
  function resetAndLoad() {
    state.currentPage = 1;
    state.searchQuery = '';
    state.isSearching = false;
    if (UI.$('#search-input')) UI.$('#search-input').value = '';
    UI.clearSearchHint();
    loadStats();
    loadData();
  }

  // ==================== 重试 ====================
  function retry() {
    loadData();
  }

  // ==================== 跳转到指定页 ====================
  async function goToPage(page) {
    if (state.isLoading) return;
    state.currentPage = page;
    state.isLoading = true;
    UI.renderSkeleton();

    if (abortController) abortController.abort();
    abortController = new AbortController();

    try {
      const result = await ApiService.fetchGames(
        state.currentSourceId,
        {
          platform: state.currentPlatform,
          sort: state.currentSort,
          page: state.currentPage,
        },
        abortController.signal
      );

      state.games = result.games;
      state.allGames = result.games;
      state.hasMore = result.pagination?.hasMore || false;
      state.total = result.rawTotal;

      UI.renderGames(result.games);

      const pageSize = ApiService.getSource(state.currentSourceId).pageSize;
      const totalPages = Math.ceil(state.total / pageSize);
      UI.renderPagination(state.currentPage, totalPages, state.total);

      // 滚动到顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('翻页失败:', err);
      UI.showError(err.message || '加载失败，请稍后重试');
    } finally {
      state.isLoading = false;
      abortController = null;
    }
  }

  // 公共 API
  return {
    init,
    retry,
    goToPage,
    state,
  };
})();

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', App.init);
