const liveReload = new EventSource('/__live_reload');

liveReload.addEventListener('message', (event) => {
  if (event.data === 'reload') window.location.reload();
});

const modal = document.querySelector('[data-modal]');
const modalSvg = document.querySelector('[data-modal-svg]');
const tooltip = document.querySelector('[data-svg-tooltip]');
const modalPreview = document.querySelector('.modal-preview');
const modalTitle = document.querySelector('#modal-title');
const modalDescription = document.querySelector('.modal-description');
const modalLegend = document.querySelector('[data-modal-legend]');
const closeButtons = document.querySelectorAll('[data-close-modal]');
const interactiveToggle = document.querySelector('[data-modal-interactive]');
const patternsPromise = fetch('data/patterns.json').then((response) => response.json());
const navigationPromise = fetch('data/navigation.json').then((response) => response.json());
const interactivePreferenceKey = 'web-layout-patterns:interactive-view';
const favoritesStorageKey = 'web-layout-patterns:favorites';
let lastTrigger;
let canvasOverlay;
let activeRegionId;
let activePattern;
let patternsById = new Map();
let favoriteIds = new Set(JSON.parse(localStorage.getItem(favoritesStorageKey) || '[]'));

interactiveToggle.checked = localStorage.getItem(interactivePreferenceKey) !== 'false';
let patternTriggers = [];
const navButtons = document.querySelectorAll('[data-nav]');
let patternCards = [];
const filterList = document.querySelector('[data-filter-list]');
const searchInput = document.querySelector('#pattern-search');
const searchChips = document.querySelector('[data-search-chips]');
const resultCount = document.querySelector('[data-result-count]');
const emptyState = document.querySelector('[data-empty-state]');
const catalogSections = document.querySelector('[data-catalog-sections]');
let currentPatternIndex = 0;

const searchTrace = (...details) => console.info('[catalog:search]', ...details);

function renderSidebar(pages) {
  const navigation = document.querySelector('[data-sidebar-nav]');
  if (navigation) {
    navigation.innerHTML = pages.map((page) => {
      const active = page.sectionId === activeCategory;
      const href = `?ctg=${page.sectionId}`;
      return `<a${active ? ' class="is-active" aria-current="page"' : ''} href="${href}">${page.label}</a>`;
    }).join('');
  }
  const categorySelect = document.querySelector('[data-category-select]');
  if (!categorySelect) return;
  categorySelect.innerHTML = `<option value="all">All categories</option><option value="favorites">Favorites (${favoriteIds.size})</option>${pages.map((page) => `<option value="${page.sectionId}">${page.label}</option>`).join('')}`;
  categorySelect.value = activeCategory === 'favorites' || pages.some((page) => page.sectionId === activeCategory) ? activeCategory : 'all';
  categorySelect.addEventListener('change', () => {
    activeCategory = categorySelect.value;
    syncSearchUrl();
    applyPatternFilters();
    if (activeCategory !== 'all') document.getElementById(activeCategory)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

navigationPromise.then(renderSidebar).catch((error) => console.error('[catalog:navigation] failed to load', error));

let filterButtons = [];
let searchTerms = new URLSearchParams(window.location.search).get('q')?.split(',').map((term) => term.trim()).filter(Boolean) || [];
let activeCategory = new URLSearchParams(window.location.search).get('ctg') || 'all';
let activePatternId = new URLSearchParams(window.location.search).get('id') || '';

function filterLabel(tag) {
  return tag.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function renderSearchChips() {
  searchChips.innerHTML = searchTerms.map((term, index) => `<button type="button" class="search-chip" data-remove-search-term="${index}" title="Remove search term ${term}">${term}<span aria-hidden="true">×</span></button>`).join('');
  searchChips.querySelectorAll('[data-remove-search-term]').forEach((button) => {
    button.addEventListener('click', () => {
      searchTerms.splice(Number(button.dataset.removeSearchTerm), 1);
      renderSearchChips();
      applyPatternFilters();
      searchInput.focus();
    });
  });
}

function renderFavorites() {
  patternCards.forEach((card) => {
    const button = card.querySelector('[data-favorite-toggle]');
    if (!button) return;
    const isFavorite = favoriteIds.has(card.dataset.patternId);
    const label = `${isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}: ${card.querySelector('h3')?.textContent || 'pattern'}`;
    button.classList.toggle('is-active', isFavorite);
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute('aria-label', label);
    button.setAttribute('data-tooltip', label);
    button.innerHTML = isFavorite
      ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"/></svg>'
      : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12.1 18.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.86C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.76 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.26 22 8.5 22 5.42 19.58 3 16.5 3Z"/></svg>';
  });
}

function bindFavoriteButtons() {
  patternCards.forEach((card) => {
    card.querySelector('[data-favorite-toggle]')?.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = card.dataset.patternId;
      if (favoriteIds.has(id)) favoriteIds.delete(id);
      else favoriteIds.add(id);
      localStorage.setItem(favoritesStorageKey, JSON.stringify([...favoriteIds]));
      renderFavorites();
      applyPatternFilters();
    });
  });
  renderFavorites();
}

function addSearchTerms(value) {
  String(value).split(',').map((term) => term.trim()).filter(Boolean).forEach((term) => {
    if (!searchTerms.some((existing) => normalizeSearchText(existing) === normalizeSearchText(term))) searchTerms.push(term);
  });
  renderSearchChips();
  searchInput.value = '';
  applyPatternFilters();
  searchInput.focus();
}

function syncSearchUrl() {
  const terms = [...searchTerms, searchInput.value.trim()].filter(Boolean);
  const url = new URL(window.location.href);
  if (terms.length) url.searchParams.set('q', terms.join(','));
  else url.searchParams.delete('q');
  if (activeCategory !== 'all') url.searchParams.set('ctg', activeCategory);
  else url.searchParams.delete('ctg');
  if (activePatternId) url.searchParams.set('id', activePatternId);
  else url.searchParams.delete('id');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

function renderFilters(patterns) {
  const tags = [...new Set(patterns.flatMap((pattern) => pattern.tags))].sort();
  const tagCounts = patterns.reduce((counts, pattern) => {
    pattern.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; });
    return counts;
  }, {});
  filterList.innerHTML = tags.map((tag) => {
    const label = filterLabel(tag);
    const count = tagCounts[tag];
    return `<button class="filter-button" type="button" data-filter="${tag}">${label}<span class="filter-count">${count}</span></button>`;
  }).join('');
  filterButtons = [...filterList.querySelectorAll('[data-filter]')];
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      searchByTag(button.dataset.filter);
    });
  });
}

function searchByTag(tag) {
  addSearchTerms(tag);
  searchTrace('tag click', { tag });
}

function renderCardTags(patterns) {
  patternCards.forEach((card) => {
    const pattern = patterns.find((item) => item.id === card.dataset.patternId);
    const tagsContainer = card.querySelector('[data-card-tags]');
    if (!pattern || !tagsContainer) return;
    tagsContainer.innerHTML = pattern.tags.map((tag) => `<button type="button" data-tag-search="${tag}" aria-label="Buscar por tag ${filterLabel(tag)}">${filterLabel(tag)}</button>`).join('');
    tagsContainer.querySelectorAll('[data-tag-search]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        searchByTag(button.dataset.tagSearch);
      });
    });
  });
}

function applyPatternFilters() {
  const previousScrollY = window.scrollY;
  syncSearchUrl();
  const pendingTerm = searchInput.value.trim();
  const terms = [...searchTerms, ...(pendingTerm ? [pendingTerm] : [])].map(normalizeSearchText).filter(Boolean);
  let visibleCount = 0;
  const matches = [];
  document.querySelectorAll('.catalog-section').forEach((section) => {
    section.hidden = activeCategory !== 'all' && section.id !== activeCategory;
  });
  patternCards.forEach((card) => {
    const pattern = patternsById.get(card.dataset.patternId);
    const searchableText = pattern
      ? `${pattern.name} ${pattern.tags.join(' ')}`
      : card.querySelector('h3')?.textContent || '';
    const searchableValue = normalizeSearchText(searchableText);
    const inCategory = activeCategory === 'all'
      || (activeCategory === 'favorites' && favoriteIds.has(card.dataset.patternId))
      || card.closest('.catalog-section')?.id === activeCategory;
    const visible = inCategory && terms.every((term) => searchableValue.includes(term));
    card.hidden = !visible;
    card.querySelectorAll('[data-tag-search]').forEach((tagButton) => {
      const tagValue = normalizeSearchText(tagButton.dataset.tagSearch);
      const matchesTag = terms.some((term) => term === tagValue || term === tagValue.replace(/-/g, ' '));
      tagButton.classList.toggle('is-match', matchesTag);
    });
    if (visible) {
      visibleCount += 1;
      matches.push(card.dataset.patternId);
    }
  });
  document.querySelectorAll('.catalog-section').forEach((section) => {
    const hasVisibleCards = [...section.querySelectorAll('[data-pattern-card]')].some((card) => !card.hidden);
    section.hidden = !hasVisibleCards;
  });
  resultCount.closest('.results-bar').hidden = visibleCount === 0;
  resultCount.textContent = `${String(visibleCount).padStart(2, '0')} ${visibleCount === 1 ? 'pattern' : 'patterns'}`;
  emptyState.hidden = visibleCount !== 0;
  searchTrace({ terms, visibleCount, matches, cards: patternCards.length });
  requestAnimationFrame(() => {
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(previousScrollY, maxScrollY));
  });
}

searchInput.addEventListener('input', () => {
  const normalizedQuery = normalizeSearchText(searchInput.value);
  filterButtons.forEach((button) => {
    const isActive = !searchTerms.length && normalizedQuery && normalizeSearchText(button.dataset.filter) === normalizedQuery;
    button.classList.toggle('is-active', isActive);
  });
  searchTrace('input event', { raw: searchInput.value, normalized: normalizedQuery });
  applyPatternFilters();
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Backspace' && !searchInput.value && searchTerms.length) {
    event.preventDefault();
    searchTerms.pop();
    renderSearchChips();
    applyPatternFilters();
    return;
  }
  if (![' ', ',', 'Enter'].includes(event.key)) return;
  if (!searchInput.value.trim()) return;
  event.preventDefault();
  addSearchTerms(searchInput.value);
});

function renderCatalog(patterns, sections) {
  catalogSections.innerHTML = sections.map((section) => {
    const sectionPatterns = section.patternIds.map((id) => patterns.find((pattern) => pattern.id === id)).filter(Boolean);
    const cards = sectionPatterns.map((pattern, index) => `<article class="pattern-card" data-pattern-card data-pattern-id="${pattern.id}">
      <div class="card-topline"><span>${String(index + 1).padStart(2, '0')} / ${section.label.toLowerCase()}</span><span>${filterLabel(pattern.tags[0])}</span></div>
      <div class="card-titlebar"><h3>${pattern.name}</h3><button class="favorite-toggle" type="button" data-favorite-toggle aria-pressed="false" aria-label="Añadir a favoritos: ${pattern.name}"></button><div class="card-tags" data-card-tags aria-label="Pattern tags"></div></div>
      <button class="preview preview-trigger" type="button" aria-label="Ver el patrón ${pattern.name} ampliado" data-pattern-id="${pattern.id}"><img src="${pattern.svg}" alt="${pattern.name}" /></button>
    </article>`).join('');
    return `<section class="catalog-section" id="${section.sectionId}" aria-labelledby="${section.sectionId}-title"><div class="section-heading"><div><h2 id="${section.sectionId}-title">${section.label}</h2></div><p>${section.description} · ${sectionPatterns.length} patterns</p></div><div class="pattern-grid pattern-grid--three">${cards}</div></section>`;
  }).join('');
  patternCards = [...document.querySelectorAll('[data-pattern-card]')];
  patternTriggers = [...document.querySelectorAll('.preview-trigger')];
  bindFavoriteButtons();
  patternTriggers.forEach((trigger, index) => {
    trigger.addEventListener('click', () => {
      currentPatternIndex = index;
      openPattern(trigger);
    });
  });
}

Promise.all([patternsPromise, navigationPromise]).then(([patterns, sections]) => {
  patternsById = new Map(patterns.map((pattern) => [pattern.id, pattern]));
  renderCatalog(patterns, sections);
  searchTrace('patterns loaded', { count: patterns.length, pageCount: patternCards.length });
  renderCardTags(patterns);
  renderFilters(patterns);
  renderSearchChips();
  applyPatternFilters();
  const deepLinkedTrigger = patternTriggers.find((trigger) => trigger.dataset.patternId === activePatternId);
  if (deepLinkedTrigger) {
    currentPatternIndex = patternTriggers.indexOf(deepLinkedTrigger);
    openPattern(deepLinkedTrigger);
  }
}).catch((error) => {
  console.error('[catalog:search] patterns failed to load', error);
  searchTrace('patterns unavailable; card text fallback will be used');
  applyPatternFilters();
});

function closeModal() {
  clearHotRegion();
  modal.hidden = true;
  activePatternId = '';
  syncSearchUrl();
  document.body.style.overflow = '';
  modalSvg.replaceChildren();
  lastTrigger?.focus();
}

function clearHotRegion() {
  modalSvg.classList.remove('has-hot');
  modalSvg.querySelectorAll('.is-hot').forEach((element) => element.classList.remove('is-hot'));
  canvasOverlay?.remove();
  canvasOverlay = null;
  activeRegionId = null;
  tooltip.hidden = true;
}

const roleLegendLabels = {
  canvas: 'Canvas / body',
  shell: 'Shell / navigation',
  hero: 'Primary proposition',
  support: 'Support / proof',
  media: 'Media / visual',
  action: 'Action / CTA'
};

function renderLegend(pattern) {
  const regions = [...new Map(pattern.regions.map((region) => [region.role, region])).values()];
  modalLegend.innerHTML = regions.map((region) => {
    const transparent = region.color === 'transparent';
    const style = transparent ? '' : ` style="--legend-color: ${region.color}"`;
    return `<span><i class="swatch${transparent ? ' swatch--canvas' : ''}"${style}></i>${roleLegendLabels[region.role] || region.role}</span>`;
  }).join('');
}

function showTooltip(event, region, pattern) {
  const regionData = pattern.regions.find((item) => item.id === region.dataset.regionId)
    || pattern.regions.find((item) => item.role === region.dataset.role);
  if (!regionData) return;

  tooltip.innerHTML = `<strong>${regionData.labelEn}</strong><span>${regionData.explanationEs}</span>`;
  tooltip.hidden = false;
  const bounds = modalPreview.getBoundingClientRect();
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const left = Math.min(event.clientX - bounds.left + 14, bounds.width - tooltipWidth - 12);
  const top = Math.min(event.clientY - bounds.top + 14, bounds.height - tooltipHeight - 12);
  tooltip.style.left = `${Math.max(12, left)}px`;
  tooltip.style.top = `${Math.max(12, top)}px`;
}

function getRegion(target) {
  return target instanceof Element ? target.closest('[data-role]') : null;
}

function activateRegion(region, event) {
  if (!interactiveToggle.checked || !region?.dataset.regionId) return;
  if (activeRegionId !== region.dataset.regionId) {
    clearHotRegion();
    activeRegionId = region.dataset.regionId;
    modalSvg.classList.add('has-hot');
    modalSvg.querySelectorAll(`[data-region-id="${activeRegionId}"]`).forEach((element) => element.classList.add('is-hot'));
    if (region.dataset.role === 'canvas') {
      canvasOverlay = region.cloneNode(true);
      canvasOverlay.id = 'canvas-focus-overlay';
      canvasOverlay.classList.add('is-hot', 'canvas-focus-overlay');
      canvasOverlay.setAttribute('fill', 'url(#canvas-grid-focus)');
      canvasOverlay.setAttribute('pointer-events', 'none');
      modalSvg.querySelector('svg')?.append(canvasOverlay);
    }
  }
  showTooltip(event, region, activePattern);
}

function bindSvgRegions(pattern) {
  activePattern = pattern;
  if (modalSvg.dataset.bound) return;
  modalSvg.dataset.bound = 'true';
  modalSvg.addEventListener('pointerover', (event) => activateRegion(getRegion(event.target), event));
  modalSvg.addEventListener('pointermove', (event) => {
    const region = getRegion(event.target);
    if (region?.dataset.regionId === activeRegionId) showTooltip(event, region, activePattern);
  });
  modalSvg.addEventListener('pointerout', (event) => {
    const nextRegion = getRegion(event.relatedTarget);
    if (!nextRegion || nextRegion.dataset.regionId !== activeRegionId) clearHotRegion();
  });
}

async function openPattern(trigger) {
    const pattern = patternsById.get(trigger.dataset.patternId);
    if (!pattern) return;
    lastTrigger = trigger;
    activePatternId = pattern.id;
    syncSearchUrl();
    modalTitle.textContent = pattern.name;
    modalDescription.textContent = pattern.descriptionEs;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.modal-close').focus();

    const svgMarkup = await fetch(pattern.svg).then((response) => response.text());
    renderLegend(pattern);
    modalSvg.innerHTML = svgMarkup;
    const inlineSvg = modalSvg.querySelector('svg');
    inlineSvg?.setAttribute('aria-label', pattern.name);
    inlineSvg?.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    modalSvg.querySelectorAll('title, desc').forEach((element) => element.remove());
    bindSvgRegions(pattern);
}

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const direction = button.dataset.nav === 'next' ? 1 : -1;
    currentPatternIndex = (currentPatternIndex + direction + patternTriggers.length) % patternTriggers.length;
    openPattern(patternTriggers[currentPatternIndex]);
  });
});

interactiveToggle.addEventListener('change', () => {
  localStorage.setItem(interactivePreferenceKey, String(interactiveToggle.checked));
  if (interactiveToggle.checked) return;
  clearHotRegion();
});

closeButtons.forEach((button) => button.addEventListener('click', closeModal));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) closeModal();
  if (event.key === 'ArrowLeft' && !modal.hidden) navButtons[0].click();
  if (event.key === 'ArrowRight' && !modal.hidden) navButtons[1].click();
});
