'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const PAGE_SIZE = 18;
let projects = [];
let visibleProjects = [];
let page = 1;
let state = { type: 'all', search: '', version: '', loaders: [], categories: [], sort: 'popular', savedOnly: false };
let saved = readSaved();

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem('mineatlas-collection') || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveSaved() {
  localStorage.setItem('mineatlas-collection', JSON.stringify(saved));
  updateSavedUI();
}

async function unpackCatalog() {
  const binary = atob(window.MINEATLAS_CATALOG_GZIP || '');
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (!('DecompressionStream' in window)) throw new Error('This browser is too old to open the local catalog.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}

function numeric(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return Number(digits) || 0;
}

function compact(value) {
  const number = typeof value === 'number' ? value : numeric(value);
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
}

function typeLabel(type) {
  return ({mod:'Mod',modpack:'Modpack',shader:'Shader',resourcepack:'Resource pack'})[type] || 'Project';
}

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const tagTranslations = {
  'Bizarní':'Cursed','Bloky':'Blocks','Core shadery':'Core shaders','Dekorace':'Decoration',
  'Dobrodružství':'Adventure','Doprava':'Transportation','Drobné úpravy':'Tweaks','Ekonomika':'Economy',
  'Generování světa':'World generation','Herní mechaniky':'Game mechanics','Jazyk':'Language',
  'Jednoduché':'Simplistic','Jídlo':'Food','Knihovny':'Libraries','Komunita':'Social',
  'Kreslené':'Cartoon','Magie':'Magic','Mobové':'Mobs','Modely':'Models','Nenáročné':'Lightweight',
  'Nízké nároky':'Low-end','Optimalizace':'Optimization','Polorealistické':'Semi-realistic',
  'Předměty':'Items','Questy':'Quests','Realistické':'Realistic','Rozhraní':'GUI','Souboje':'Combat',
  'Správa':'Management','Střední nároky':'Medium','Technologie':'Technology','Tematické':'Themed',
  'Vanilla styl':'Vanilla-like','Vybavení':'Equipment','Vysoké nároky':'High-end','Výzvy':'Challenges',
  'Vše v jednom':'Kitchen sink','Zvuky':'Audio','Úložiště':'Storage'
};

function translateTag(tag) {
  return tagTranslations[tag] || tag;
}

function projectTags(project) {
  return unique(project.tags || []).slice(0, 4);
}

function colorClass(project) {
  const seed = [...project.title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ['violet','cyan','rose','green'][seed % 4];
}

function renderCard(project) {
  const tags = projectTags(project);
  const isSaved = saved.includes(project.id);
  return `
    <article class="project-card" data-id="${escapeHTML(project.id)}">
      <button class="save-project ${isSaved ? 'saved' : ''}" type="button" data-save="${escapeHTML(project.id)}" aria-label="${isSaved ? 'Remove from' : 'Add to'} collection" aria-pressed="${isSaved}">${isSaved ? '◆' : '◇'}</button>
      <div class="card-head">
        <span class="project-icon ${colorClass(project)}">${escapeHTML(project.title.slice(0,1).toUpperCase())}</span>
        <div class="card-title"><h4 title="${escapeHTML(project.title)}">${escapeHTML(project.title)}</h4><span>by ${escapeHTML(project.author || 'Community creator')}</span></div>
      </div>
      <p class="card-summary">${escapeHTML(project.summary || 'A community project for Minecraft.')}</p>
      <div class="card-tags">
        <span class="tag accent">${typeLabel(project.type)}</span>
        ${tags.slice(0,3).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
      </div>
      <div class="card-foot">
        <span>${compact(project.downloads)} downloads</span>
        <button class="open-project" type="button" data-open="${escapeHTML(project.id)}">View project →</button>
      </div>
    </article>`;
}

function applyFilters() {
  const query = normalize(state.search);
  visibleProjects = projects.filter(project => {
    if (state.savedOnly && !saved.includes(project.id)) return false;
    if (state.type !== 'all' && project.type !== state.type) return false;
    const searchable = normalize([project.title, project.author, project.summary, ...(project.tags || [])].join(' '));
    if (query && !query.split(/\s+/).every(word => searchable.includes(word))) return false;
    if (state.version && !(project.versions || []).includes(state.version)) return false;
    const tags = (project.tags || []).map(normalize);
    if (state.loaders.length && !state.loaders.some(loader => tags.includes(normalize(loader)))) return false;
    if (state.categories.length && !state.categories.some(category => tags.includes(normalize(category)))) return false;
    return true;
  });
  visibleProjects.sort((a, b) => {
    if (state.sort === 'name') return a.title.localeCompare(b.title);
    if (state.sort === 'recent') return String(b.updated).localeCompare(String(a.updated));
    return numeric(b.downloads) - numeric(a.downloads);
  });
  renderCatalog();
}

function renderCatalog() {
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / PAGE_SIZE));
  page = Math.min(page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const slice = visibleProjects.slice(start, start + PAGE_SIZE);
  const grid = $('#project-grid');
  grid.innerHTML = slice.length
    ? slice.map(renderCard).join('')
    : '<div class="empty-state"><span>⌕</span><h4>No projects found</h4><p>Try another search term or clear some filters.</p></div>';
  $('#result-count').textContent = `${visibleProjects.length.toLocaleString('en')} projects`;
  $('#result-title').textContent = state.savedOnly ? 'My collection' : state.type === 'all' ? 'All projects' : ({mod:'Mods',modpack:'Modpacks',shader:'Shaders',resourcepack:'Resource packs'})[state.type];
  renderPagination(totalPages);
  renderActiveFilters();
}

function renderPagination(totalPages) {
  const holder = $('#pagination');
  if (totalPages <= 1) { holder.innerHTML = ''; return; }
  const numbers = unique([1, page - 1, page, page + 1, totalPages]).filter(number => number > 0 && number <= totalPages).sort((a,b) => a-b);
  let previous = 0;
  const middle = numbers.map(number => {
    const gap = previous && number - previous > 1 ? '<span>…</span>' : '';
    previous = number;
    return gap + `<button class="page-button ${number === page ? 'active' : ''}" data-page="${number}" type="button">${number}</button>`;
  }).join('');
  holder.innerHTML = `<button class="page-button" data-page="${page - 1}" type="button" ${page === 1 ? 'disabled' : ''}>←</button>${middle}<button class="page-button" data-page="${page + 1}" type="button" ${page === totalPages ? 'disabled' : ''}>→</button>`;
}

function renderActiveFilters() {
  const filters = [];
  if (state.search) filters.push(['search', state.search]);
  if (state.version) filters.push(['version', state.version]);
  state.loaders.forEach(value => filters.push(['loader', value]));
  state.categories.forEach(value => filters.push(['category', value]));
  if (state.savedOnly) filters.push(['saved', 'My collection']);
  $('#active-filters').innerHTML = filters.map(([kind, value]) => `<button class="filter-pill" type="button" data-remove-filter="${kind}" data-value="${escapeHTML(value)}">${escapeHTML(value)} ×</button>`).join('');
}

function buildFilters() {
  const versions = unique(projects.flatMap(project => project.versions || [])).filter(version => /^\d/.test(version)).sort((a,b) => b.localeCompare(a, undefined, {numeric:true}));
  $('#version-filter').innerHTML = '<option value="">All versions</option>' + versions.slice(0, 80).map(version => `<option value="${escapeHTML(version)}">${escapeHTML(version)}</option>`).join('');
  const excluded = new Set(['Fabric','Forge','NeoForge','Quilt','Mod','Modpack','Shader','Resource pack']);
  const categories = [...new Set(projects.flatMap(project => project.tags || []).filter(tag => !excluded.has(tag)))];
  const counts = Object.fromEntries(categories.map(category => [category, projects.filter(project => (project.tags || []).includes(category)).length]));
  categories.sort((a,b) => counts[b] - counts[a]);
  $('#category-list').innerHTML = categories.slice(0, 12).map(category => `<label><input type="checkbox" value="${escapeHTML(category)}"> <span>${escapeHTML(category)}</span></label>`).join('');
  ['all','mod','modpack','shader','resourcepack'].forEach(type => {
    const element = $('#count-' + type);
    element.textContent = (type === 'all' ? projects.length : projects.filter(project => project.type === type).length).toLocaleString('en');
  });
  $('#hero-count').textContent = projects.length.toLocaleString('en');
  $('#project-count').textContent = projects.length.toLocaleString('en');
}

function resetFilters() {
  state = { ...state, type:'all', search:'', version:'', loaders:[], categories:[], savedOnly:false };
  page = 1;
  $('#search-input').value = '';
  $('#version-filter').value = '';
  $$('#loader-list input, #category-list input').forEach(input => input.checked = false);
  $$('#type-list button').forEach(button => button.classList.toggle('active', button.dataset.type === 'all'));
  applyFilters();
}

function updateSavedUI() {
  $('#saved-count').textContent = saved.length;
  $('#collection-count').textContent = saved.length;
  $$('[data-save]').forEach(button => {
    const active = saved.includes(button.dataset.save);
    button.classList.toggle('saved', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', (active ? 'Remove from' : 'Add to') + ' collection');
    button.textContent = active ? '◆' : '◇';
  });
}

function toggleSaved(id) {
  saved = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
  saveSaved();
  if (state.savedOnly) applyFilters();
}

function showProject(id) {
  const project = projects.find(item => item.id === id);
  if (!project) return;
  const versions = (project.versions || []).filter(version => /^\d/.test(version)).slice(-24).reverse();
  const tags = projectTags(project);
  const dialog = $('#project-dialog');
  $('#project-dialog-content').innerHTML = `
    <div class="dialog-hero">
      <span class="project-icon ${colorClass(project)}">${escapeHTML(project.title.slice(0,1).toUpperCase())}</span>
      <div><h2>${escapeHTML(project.title)}</h2><p>${typeLabel(project.type)} by ${escapeHTML(project.author || 'Community creator')}</p></div>
    </div>
    <div class="dialog-body">
      <div class="card-tags"><span class="tag accent">${typeLabel(project.type)}</span>${tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>
      <p class="dialog-summary">${escapeHTML(project.summary || 'A community project for Minecraft.')}</p>
      <div class="dialog-meta">
        <div><span>DOWNLOADS</span><b>${compact(project.downloads)}</b></div>
        <div><span>FOLLOWERS</span><b>${compact(project.follows)}</b></div>
        <div><span>CATALOG</span><b>Local project</b></div>
      </div>
      <div class="compatibility"><h3>Known compatible versions</h3><div class="version-cloud">${versions.length ? versions.map(version => `<span class="tag">${escapeHTML(version)}</span>`).join('') : '<span class="tag">Check the creator release notes</span>'}</div></div>
      <div class="dialog-actions">
        <button class="button primary" type="button" data-save="${escapeHTML(project.id)}">${saved.includes(project.id) ? '◆ Saved' : '◇ Save to collection'}</button>
        <button class="button ghost" type="button" data-ask-project="${escapeHTML(project.id)}">Ask Copilot</button>
      </div>
      <p class="dialog-note">MineAtlas stores discovery information, not third-party mod files. Always download and install files from a source you trust and verify the exact Minecraft version and loader first.</p>
    </div>`;
  updateSavedUI();
  dialog.showModal();
}

function openCopilot(prefill = '') {
  $('#copilot-panel').hidden = false;
  $('#copilot-launcher').setAttribute('aria-expanded', 'true');
  if (prefill) $('#copilot-input').value = prefill;
  setTimeout(() => $('#copilot-input').focus(), 30);
}

function closeCopilot() {
  $('#copilot-panel').hidden = true;
  $('#copilot-launcher').setAttribute('aria-expanded', 'false');
  $('#copilot-launcher').focus();
}

function recommend(query) {
  const raw = normalize(query);
  const stop = new Set(['the','a','an','and','or','for','to','of','in','on','i','me','my','want','need','please','best','good','recommend','find','mod','mods','minecraft','something','with','that']);
  const words = raw.split(/[^a-z0-9.]+/).filter(word => word.length > 1 && !stop.has(word));
  const concepts = [];
  const add = (...terms) => concepts.push(...terms);
  if (/horror|scary|creepy|fear|terrify|monster/.test(raw)) add('horror','scary','creepy','fear','monster','zombie','dark');
  if (/fps|performance|optim|lag|faster|potato/.test(raw)) add('performance','optimization','fps','sodium','lithium','memory');
  if (/shader|visual|graphics|beautiful|realistic/.test(raw)) add('shader','realistic','visual','lighting','iris');
  if (/magic|spell|wizard/.test(raw)) add('magic','spell','wizard','fantasy');
  if (/tech|machine|factory|automation/.test(raw)) add('technology','machine','factory','automation','create');
  if (/adventure|explor|quest|rpg/.test(raw)) add('adventure','exploration','quest','rpg','worldgen');
  if (/build|decor|furniture/.test(raw)) add('building','decoration','furniture','blocks');
  if (/modpack|pack/.test(raw)) add('modpack');
  if (/resource|texture/.test(raw)) add('resourcepack','resource pack','texture');
  const version = raw.match(/\b(?:1\.)?\d{1,2}(?:\.\d{1,2}){1,2}\b/)?.[0];
  const loader = ['fabric','forge','neoforge','quilt'].find(item => raw.includes(item));
  const terms = unique([...words, ...concepts]);
  const scored = projects.map(project => {
    const title = normalize(project.title);
    const summary = normalize(project.summary);
    const tags = normalize((project.tags || []).join(' '));
    let score = 0;
    terms.forEach(term => {
      if (title.includes(term)) score += 7;
      if (tags.includes(term)) score += 5;
      if (summary.includes(term)) score += 3;
    });
    if (version && (project.versions || []).includes(version)) score += 7;
    if (loader && tags.includes(loader)) score += 6;
    if (raw.includes('shader') && project.type === 'shader') score += 14;
    if (raw.includes('modpack') && project.type === 'modpack') score += 14;
    if (/resource|texture/.test(raw) && project.type === 'resourcepack') score += 14;
    score += Math.log10(Math.max(10, numeric(project.downloads))) / 3;
    return {project, score};
  }).filter(item => item.score > 2.5).sort((a,b) => b.score - a.score || numeric(b.project.downloads) - numeric(a.project.downloads));
  return scored.slice(0, 4).map(item => item.project);
}

function copilotAnswer(query) {
  const raw = normalize(query);
  if (/hello|hi|hey|help/.test(raw) && raw.split(/\s+/).length < 5) {
    return { text: 'Tell me the mood, gameplay style, Minecraft version or loader you use. For example: “best horror mods for Fabric” or “a lightweight shader.”', projects: [] };
  }
  if (/install|how do i add|how to add/.test(raw)) {
    return { text: 'First verify the project supports your exact Minecraft version and loader. Back up your world, install the required loader, then place trusted .jar files in the instance’s mods folder. Modpacks should be imported through a compatible launcher. MineAtlas does not host third-party files.', projects: [] };
  }
  if (/what is (fabric|forge|neoforge|quilt)|loader/.test(raw)) {
    return { text: 'A mod loader starts Minecraft with mod support. Fabric is lightweight and updates quickly; Forge and NeoForge are common for larger content mods and modpacks; Quilt is Fabric-compatible for many projects. Every installed mod must match both your game version and loader.', projects: [] };
  }
  const matches = recommend(query);
  if (!matches.length) {
    return { text: 'I could not find a strong match in the local catalog. Try describing a category such as horror, performance, magic, building, adventure, shaders or modpacks.', projects: [] };
  }
  const intent = /horror|scary|creepy/.test(raw) ? 'For a darker, more frightening playthrough, these are my strongest matches:' : /fps|performance|lag/.test(raw) ? 'For better performance, start with these catalog picks:' : /shader|visual|graphics/.test(raw) ? 'These visual projects best match your request:' : 'These projects are the closest match in the local catalog:';
  return { text: intent, projects: matches };
}

function appendMessage(kind, text, recommendations = []) {
  const holder = $('#copilot-messages');
  const message = document.createElement('div');
  message.className = 'message ' + kind;
  message.innerHTML = `<span>✦</span><div>${escapeHTML(text)}${recommendations.length ? '<div class="rec-list">' + recommendations.map(project => `<button class="rec-button" type="button" data-open="${escapeHTML(project.id)}"><b>${escapeHTML(project.title)}</b><br><small>${escapeHTML(typeLabel(project.type))} · ${escapeHTML(projectTags(project).slice(0,2).join(' · '))}</small></button>`).join('') + '</div>' : ''}</div>`;
  holder.appendChild(message);
  holder.scrollTop = holder.scrollHeight;
}

function submitCopilot(query) {
  const clean = String(query || '').trim();
  if (!clean) return;
  appendMessage('user', clean);
  $('#copilot-input').value = '';
  const answer = copilotAnswer(clean);
  setTimeout(() => appendMessage('bot', answer.text, answer.projects), 220);
}

function bindEvents() {
  $('#search-form').addEventListener('submit', event => {
    event.preventDefault();
    state.search = $('#search-input').value.trim();
    page = 1;
    applyFilters();
  });
  $('#search-input').addEventListener('input', event => {
    state.search = event.target.value.trim();
    page = 1;
    applyFilters();
  });
  $('#type-list').addEventListener('click', event => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    state.type = button.dataset.type;
    state.savedOnly = false;
    page = 1;
    $$('#type-list button').forEach(item => item.classList.toggle('active', item === button));
    applyFilters();
    closeFilters();
  });
  $('#version-filter').addEventListener('change', event => { state.version = event.target.value; page = 1; applyFilters(); });
  $('#loader-list').addEventListener('change', () => { state.loaders = $$('#loader-list input:checked').map(input => input.value); page = 1; applyFilters(); });
  $('#category-list').addEventListener('change', () => { state.categories = $$('#category-list input:checked').map(input => input.value); page = 1; applyFilters(); });
  $('#sort-select').addEventListener('change', event => { state.sort = event.target.value; page = 1; applyFilters(); });
  $('#clear-filters').addEventListener('click', resetFilters);
  $('#pagination').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    renderCatalog();
    $('#catalog-title').scrollIntoView({behavior:'smooth'});
  });
  document.addEventListener('click', event => {
    const save = event.target.closest('[data-save]');
    if (save) { toggleSaved(save.dataset.save); if (save.closest('.project-dialog')) showProject(save.dataset.save); return; }
    const open = event.target.closest('[data-open]');
    if (open) { showProject(open.dataset.open); return; }
    const ask = event.target.closest('[data-ask-project]');
    if (ask) {
      const project = projects.find(item => item.id === ask.dataset.askProject);
      $('#project-dialog').close();
      openCopilot(`Tell me more about ${project?.title || 'this project'}`);
      return;
    }
    const remove = event.target.closest('[data-remove-filter]');
    if (remove) {
      const kind = remove.dataset.removeFilter;
      const value = remove.dataset.value;
      if (kind === 'search') { state.search = ''; $('#search-input').value = ''; }
      if (kind === 'version') { state.version = ''; $('#version-filter').value = ''; }
      if (kind === 'loader') { state.loaders = state.loaders.filter(item => item !== value); $$('#loader-list input').forEach(input => input.checked = state.loaders.includes(input.value)); }
      if (kind === 'category') { state.categories = state.categories.filter(item => item !== value); $$('#category-list input').forEach(input => input.checked = state.categories.includes(input.value)); }
      if (kind === 'saved') state.savedOnly = false;
      page = 1; applyFilters();
    }
  });
  $('#project-dialog .dialog-close').addEventListener('click', () => $('#project-dialog').close());
  $('#project-dialog').addEventListener('click', event => { if (event.target === $('#project-dialog')) $('#project-dialog').close(); });
  const openSaved = () => { state.savedOnly = true; page = 1; applyFilters(); $('#catalog').scrollIntoView({behavior:'smooth'}); };
  $('#saved-nav').addEventListener('click', openSaved);
  $('#view-saved').addEventListener('click', openSaved);
  $('#copilot-launcher').addEventListener('click', () => $('#copilot-panel').hidden ? openCopilot() : closeCopilot());
  $('#copilot-close').addEventListener('click', closeCopilot);
  $('#ask-copilot-hero').addEventListener('click', () => openCopilot());
  $('#copilot-form').addEventListener('submit', event => { event.preventDefault(); submitCopilot($('#copilot-input').value); });
  $('#quick-prompts').addEventListener('click', event => { const button = event.target.closest('button'); if (button) submitCopilot(button.textContent); });
  $('#mobile-menu').addEventListener('click', () => {
    const header = $('.site-header');
    header.classList.toggle('menu-open');
    $('#mobile-menu').setAttribute('aria-expanded', String(header.classList.contains('menu-open')));
  });
  $$('.site-header nav a').forEach(link => link.addEventListener('click', () => $('.site-header').classList.remove('menu-open')));
  $('#open-filters').addEventListener('click', openFilters);
  $('#close-filters').addEventListener('click', closeFilters);
  $('#mobile-overlay').addEventListener('click', closeFilters);
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)) { event.preventDefault(); $('#search-input').focus(); }
    if (event.key === 'Escape') { closeFilters(); if (!$('#copilot-panel').hidden) closeCopilot(); }
  });
}

function openFilters() {
  $('#filters').classList.add('open');
  $('#mobile-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeFilters() {
  $('#filters').classList.remove('open');
  $('#mobile-overlay').hidden = true;
  document.body.style.overflow = '';
}

async function init() {
  $('#project-grid').innerHTML = '<div class="loading-state"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
  try {
    projects = await unpackCatalog();
    projects = projects.filter(project => project && project.id && project.title).map(project => ({
      ...project,
      tags: unique((project.tags || []).map(translateTag)),
      updated: project.updated === 'Aktualizováno' ? 'Catalog entry' : project.updated
    }));
    buildFilters();
    bindEvents();
    updateSavedUI();
    applyFilters();
  } catch (error) {
    $('#project-grid').innerHTML = `<div class="empty-state"><span>!</span><h4>The catalog could not be opened</h4><p>${escapeHTML(error.message)} Upload the complete folder and open it through a web server.</p></div>`;
    console.error(error);
  }
}

init();
