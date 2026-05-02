/**
 * ============================================================
 *  UI 渲染模块 - UI RENDERER
 * ============================================================
 *  负责所有 DOM 操作和视觉渲染
 * ============================================================
 */

const UI = (() => {
  'use strict';

  // ==================== DOM 元素引用 ====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ==================== 数据源 Tab 渲染 ====================
  function renderSourceTabs(sources, activeSourceId) {
    const container = $('#source-tabs');
    container.innerHTML = sources.map(s => `
      <button class="source-tab ${s.id === activeSourceId ? 'active' : ''}"
              data-source="${s.id}"
              title="${s.description}">
        <span class="tab-icon">${s.icon}</span>
        <span class="tab-name">${s.name}</span>
      </button>
    `).join('');
  }

  // ==================== 平台筛选标签 ====================
  function renderPlatformFilters(platforms, activePlatform) {
    const container = $('#platform-filters');
    container.innerHTML = platforms.map(p => `
      <button class="filter-chip ${p.value === activePlatform ? 'active' : ''}"
              data-platform="${p.value}">
        ${p.label}
      </button>
    `).join('');
  }

  // ==================== 排序选项 ====================
  function renderSortOptions(sortOptions, activeSort) {
    const container = $('#sort-options');
    container.innerHTML = sortOptions.map(s => `
      <button class="sort-chip ${s.value === activeSort ? 'active' : ''}"
              data-sort="${s.value}">
        ${s.label}
      </button>
    `).join('');
  }

  // ==================== 统计栏 ====================
  function renderStats(stats) {
    const container = $('#stats-bar');
    if (!stats) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = `
      <div class="stat-item">
        <span class="stat-number">${stats.totalGames}</span>
        <span class="stat-label">款游戏</span>
      </div>
      ${stats.totalValue ? `
      <div class="stat-item">
        <span class="stat-number">${stats.totalValue}</span>
        <span class="stat-label">总价值</span>
      </div>` : ''}
      <div class="stat-extra">${stats.extra || ''}</div>
    `;
  }

  // ==================== 游戏卡片列表 ====================
  function renderGames(games) {
    const container = $('#games-grid');
    if (games.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <h3>没有找到相关游戏</h3>
          <p>试试换个关键词或筛选条件</p>
        </div>
      `;
      return;
    }

    container.innerHTML = games.map(game => renderGameCard(game)).join('');

    // 卡片入场动画
    requestAnimationFrame(() => {
      container.querySelectorAll('.game-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 0.05}s`;
        card.classList.add('animate-in');
      });
    });
  }

  function renderGameCard(game) {
    const imageHtml = game.image
      ? `<div class="card-image" style="background-image: url('${escapeHtml(game.image)}')">
           <div class="card-badge">${game.genre || 'Game'}</div>
         </div>`
      : `<div class="card-image card-placeholder">
           <span class="placeholder-icon">🎮</span>
           <div class="card-badge">${game.genre || 'Game'}</div>
         </div>`;

    const ratingHtml = game.worth
      ? `<span class="card-worth">${escapeHtml(game.worth)}</span>`
      : game.stars
        ? `<span class="card-stars">⭐ ${formatNumber(game.stars)}</span>`
        : '';

    return `
      <div class="game-card" data-game-id="${escapeHtml(game.id)}" tabindex="0">
        ${imageHtml}
        <div class="card-body">
          <h3 class="card-title" title="${escapeHtml(game.title)}">${escapeHtml(game.title)}</h3>
          <div class="card-meta">
            <span class="card-platform">${escapeHtml(truncate(game.platform, 20))}</span>
            ${ratingHtml}
          </div>
          ${game.endDate ? `<div class="card-deadline">⏰ ${formatDate(game.endDate)}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ==================== 骨架屏 ====================
  function renderSkeleton(count = 12) {
    const container = $('#games-grid');
    container.innerHTML = Array(count).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton-image"></div>
        <div class="skeleton-body">
          <div class="skeleton-title"></div>
          <div class="skeleton-meta"></div>
        </div>
      </div>
    `).join('');
  }

  // ==================== 加载更多按钮 ====================
  function renderLoadMore(hasMore) {
    const container = $('#load-more-container');
    if (!hasMore) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `<button id="load-more-btn" class="btn-load-more">加载更多</button>`;
  }

  // ==================== 翻页导航（服务端分页模式） ====================
  function renderPagination(currentPage, totalPages, totalItems) {
    const container = $('#load-more-container');

    if (totalPages <= 1 || currentPage > totalPages) {
      container.innerHTML = '';
      return;
    }

    // 计算显示的页码范围（最多显示 7 个页码按钮）
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, startPage + 6);
    if (endPage - startPage < 6) {
      startPage = Math.max(1, endPage - 6);
    }

    // 构建页码按钮
    let pagesHtml = '';

    // 上一页
    pagesHtml += `<button class="page-btn ${currentPage <= 1 ? 'disabled' : ''}" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>&laquo; 上一页</button>`;

    // 第一页 + 省略号
    if (startPage > 1) {
      pagesHtml += `<button class="page-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        pagesHtml += `<span class="page-ellipsis">...</span>`;
      }
    }

    // 页码
    for (let i = startPage; i <= endPage; i++) {
      pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    // 省略号 + 最后一页
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pagesHtml += `<span class="page-ellipsis">...</span>`;
      }
      pagesHtml += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // 下一页
    pagesHtml += `<button class="page-btn ${currentPage >= totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>下一页 &raquo;</button>`;

    container.innerHTML = `
      <div class="pagination-wrapper">
        <span class="pagination-info">共 ${formatNumber(totalItems)} 款游戏</span>
        <div class="pagination-controls">
          ${pagesHtml}
        </div>
        <span class="pagination-page">第 ${currentPage} / ${totalPages} 页</span>
      </div>
    `;
  }

  // ==================== 详情弹窗 ====================
  function renderModal(game, related = []) {
    const modal = $('#modal');
    const imageHtml = game.image
      ? `<div class="modal-image" style="background-image: url('${escapeHtml(game.image)}')"></div>`
      : `<div class="modal-image modal-placeholder"><span class="placeholder-icon-large">🎮</span></div>`;

    const relatedHtml = related.length > 0 ? `
      <div class="modal-related">
        <h4>相关游戏</h4>
        <div class="related-list">
          ${related.slice(0, 4).map(r => `
            <div class="related-item" data-game-id="${escapeHtml(r.id)}">
              <span class="related-title">${escapeHtml(truncate(r.title, 30))}</span>
              ${r.stars ? `<span class="related-stars">⭐ ${formatNumber(r.stars)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    // 商店链接（RAWG 等多平台游戏）
    const storeLinksHtml = buildStoreLinksHtml(game);

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close" aria-label="关闭">&times;</button>
        ${imageHtml}
        <div class="modal-body">
          <h2 class="modal-title">${escapeHtml(game.title)}</h2>
          <div class="modal-tags">
            <span class="tag tag-platform">${escapeHtml(game.platform)}</span>
            <span class="tag tag-genre">${escapeHtml(game.genre)}</span>
            ${game.worth ? `<span class="tag tag-worth">${escapeHtml(game.worth)}</span>` : ''}
            ${game.stars ? `<span class="tag tag-stars">⭐ ${formatNumber(game.stars)}</span>` : ''}
            ${game.rating ? `<span class="tag tag-stars">评分 ${game.rating.toFixed(1)}</span>` : ''}
            ${game.metacritic ? `<span class="tag tag-worth">Metacritic ${game.metacritic}</span>` : ''}
            ${game.language ? `<span class="tag tag-lang">${escapeHtml(game.language)}</span>` : ''}
            ${game.isMultiplayer ? `<span class="tag tag-multi">多人</span>` : ''}
            ${game.playtime ? `<span class="tag tag-lang">⏱ 约 ${game.playtime} 小时</span>` : ''}
          </div>
          <div class="modal-description">${escapeHtml(game.description)}</div>

          ${game.publisher ? `<div class="modal-info-row"><span class="info-label">发行商</span><span>${escapeHtml(game.publisher)}</span></div>` : ''}
          ${game.developer ? `<div class="modal-info-row"><span class="info-label">开发商</span><span>${escapeHtml(game.developer)}</span></div>` : ''}
          ${game.releaseDate ? `<div class="modal-info-row"><span class="info-label">发行日期</span><span>${game.releaseDate}</span></div>` : ''}
          ${game.license ? `<div class="modal-info-row"><span class="info-label">许可证</span><span>${escapeHtml(game.license)}</span></div>` : ''}
          ${game.endDate ? `<div class="modal-info-row"><span class="info-label">截止日期</span><span class="deadline-text">⏰ ${formatDate(game.endDate)}</span></div>` : ''}
          ${game.forks !== undefined ? `<div class="modal-info-row"><span class="info-label">Forks</span><span>${formatNumber(game.forks)}</span></div>` : ''}
          ${game.lastCommitAt ? `<div class="modal-info-row"><span class="info-label">最后更新</span><span>${formatDate(game.lastCommitAt)}</span></div>` : ''}

          ${game.instructions ? `<div class="modal-instructions"><strong>领取说明：</strong>${escapeHtml(game.instructions)}</div>` : ''}

          ${storeLinksHtml}

          <a href="${escapeHtml(game.openUrl)}" target="_blank" rel="noopener noreferrer" class="btn-download">
            ${game.openUrlLabel || '前往下载'} ↗
          </a>

          ${relatedHtml}
        </div>
      </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // 构建商店链接 HTML
  function buildStoreLinksHtml(game) {
    const stores = game.stores;
    if (!stores || !Array.isArray(stores) || stores.length === 0) return '';

    const storeIcons = {
      steam: '🔵',
      gog: '🟣',
      epic: '⬛',
      humble: '🟠',
      playstation: '🔵',
      xbox: '🟢',
      nintendo: '🔴',
      apple: '⚫',
      google: '🟡',
      android: '🟢',
      ios: '⚫',
    };

    return `
      <div class="store-links">
        <span class="store-links-label">可在以下平台获取：</span>
        <div class="store-links-list">
          ${stores.map((store, idx) => {
            const name = (store.name || store).toLowerCase();
            const url = store.url || '#';
            // 找匹配的图标
            let icon = '🎮';
            for (const [key, emoji] of Object.entries(storeIcons)) {
              if (name.includes(key)) { icon = emoji; break; }
            }
            const isPrimary = idx === 0 && name.includes('steam');
            return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="store-link-btn ${isPrimary ? 'primary-store' : ''}">
              <span class="store-icon">${icon}</span>
              ${escapeHtml(store.name || store)}
            </a>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function closeModal() {
    const modal = $('#modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => { modal.innerHTML = ''; }, 300);
  }

  // ==================== 加载状态 ====================
  function showLoading() {
    $('#loading-indicator')?.classList.add('active');
  }

  function hideLoading() {
    $('#loading-indicator')?.classList.remove('active');
  }

  function showError(message) {
    const container = $('#games-grid');
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>${escapeHtml(message || '加载失败')}</h3>
        <button class="btn-retry" onclick="App.retry()">重试</button>
      </div>
    `;
  }

  // ==================== 搜索提示 ====================
  function updateSearchHint(count, query) {
    const hint = $('#search-hint');
    if (query) {
      hint.textContent = `找到 ${count} 个与 "${query}" 相关的结果`;
      hint.style.display = 'block';
    } else {
      hint.style.display = 'none';
    }
  }

  function clearSearchHint() {
    const hint = $('#search-hint');
    hint.textContent = '';
    hint.style.display = 'none';
  }

  // ==================== 工具函数 ====================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(num);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = date - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

      const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (days < 0) return `${formatted} (已过期)`;
      if (days === 0) return `${formatted} (今天截止)`;
      if (days <= 3) return `${formatted} (剩余 ${days} 天)`;
      return formatted;
    } catch {
      return dateStr;
    }
  }

  // 公共 API
  return {
    renderSourceTabs,
    renderPlatformFilters,
    renderSortOptions,
    renderStats,
    renderGames,
    renderSkeleton,
    renderLoadMore,
    renderPagination,
    renderModal,
    closeModal,
    showLoading,
    hideLoading,
    showError,
    updateSearchHint,
    clearSearchHint,
    $,
    $$,
  };
})();
