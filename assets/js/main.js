// ── Utilities ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fileCategory(ext) {
  if (['pdf'].includes(ext)) return 'pdf';
  if (['png','jpg','jpeg','gif','webp','svg','bmp','avif'].includes(ext)) return 'image';
  if (['doc','docx','odt','rtf'].includes(ext)) return 'doc';
  if (['txt','md','csv','json','xml','html','htm'].includes(ext)) return 'text';
  if (['xls','xlsx','ods'].includes(ext)) return 'sheet';
  if (['ppt','pptx'].includes(ext)) return 'slide';
  return 'other';
}

function fileEmoji(ext) {
  const map = {
    pdf:'📄', doc:'📝', docx:'📝', odt:'📝', rtf:'📝',
    txt:'📃', md:'📃',
    png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️', svg:'🖼️', avif:'🖼️',
    csv:'📊', xls:'📊', xlsx:'📊', ods:'📊',
    ppt:'📽️', pptx:'📽️',
    json:'📦', xml:'📦', zip:'🗜️', rar:'🗜️',
    mp3:'🎵', mp4:'🎬', mov:'🎬',
  };
  return map[ext] || '📎';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function buildPath(post) {
  if (post.folder) return `uploads/${post.folder}/${post.filename}`;
  return `uploads/${post.filename}`;
}

// ── State ─────────────────────────────────────────────────
let allPosts = [];
let currentView = 'grid'; // 'grid' | 'list'
let currentFilter = 'all';

// ── Load ──────────────────────────────────────────────────
async function loadPosts() {
  try {
    const r = await fetch('posts.json?v=' + Date.now());
    if (!r.ok) throw new Error();
    allPosts = await r.json();
  } catch {
    allPosts = [];
  }
  buildFilterButtons();
  render();
  $('footerYear').textContent = new Date().getFullYear();
}

// ── Build filter buttons from existing folders ─────────────
function buildFilterButtons() {
  const bar = $('filterBar');
  const folders = [...new Set(allPosts.map(p => p.folder || 'Sem pasta').filter(Boolean))];

  bar.innerHTML = `<button class="filter-btn active" data-filter="all">Todos</button>`;
  folders.forEach(folder => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.filter = folder;
    btn.textContent = folder.replace(/-/g, ' ');
    bar.appendChild(btn);
  });

  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });
}

// ── Render ────────────────────────────────────────────────
function render() {
  const container = $('foldersView');
  const empty = $('emptyState');

  let filtered = currentFilter === 'all'
    ? allPosts
    : allPosts.filter(p => (p.folder || 'Sem pasta') === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  // Group by folder
  const groups = {};
  filtered.forEach(post => {
    const key = post.folder || 'Sem pasta';
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
  });

  container.innerHTML = Object.entries(groups).map(([folder, posts]) =>
    folderGroupHTML(folder, posts)
  ).join('');

  // Click events
  container.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => {
      const slug = el.dataset.slug;
      openModal(allPosts.find(p => p.slug === slug));
    });
  });

  // Popover: flip to left when near right edge, load text lazily
  container.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const pop = card.querySelector('.card-preview-pop');
      if (!pop) return;

      // Flip check
      const rect = card.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;
      if (spaceRight < 320) {
        pop.classList.add('flip-left');
      } else {
        pop.classList.remove('flip-left');
      }

      // Lazy load text previews
      const pre = pop.querySelector('pre[data-src]');
      if (pre && pre.textContent === 'Carregando…') {
        fetch(pre.dataset.src)
          .then(r => r.text())
          .then(t => { pre.textContent = t.slice(0, 1200); })
          .catch(() => { pre.textContent = '(erro ao carregar)'; });
      }
    });
  });
}

function folderGroupHTML(folder, posts) {
  if (currentView === 'list') {
    return `
    <div class="folder-group" style="grid-column: 1 / -1">
      <div class="folder-header">
        <div class="folder-icon">📁</div>
        <span class="folder-name">${folder.replace(/-/g, ' ')}</span>
        <span class="folder-count">${posts.length} arquivo${posts.length !== 1 ? 's' : ''}</span>
      </div>
      <div style="padding:8px">
        <div class="posts-list">${posts.map(listItemHTML).join('')}</div>
      </div>
    </div>`;
  }

  return `
  <div class="folder-group">
    <div class="folder-header">
      <div class="folder-icon">📁</div>
      <span class="folder-name">${folder.replace(/-/g, ' ')}</span>
      <span class="folder-count">${posts.length}</span>
    </div>
    <div class="posts-grid">${posts.map(cardHTML).join('')}</div>
  </div>`;
}

function cardHTML(post) {
  const cat = fileCategory(post.ext);
  const path = buildPath(post);

  // Thumbnail inside card
  let thumb;
  if (cat === 'image') {
    thumb = `<img src="${path}" alt="${post.title}" loading="lazy" />`;
  } else {
    thumb = `
      <div class="file-icon-wrap">
        <span class="file-icon-big">${fileEmoji(post.ext)}</span>
        <span class="ext-chip">${post.ext}</span>
      </div>`;
  }

  // Popover preview content
  let popContent;
  if (cat === 'pdf') {
    popContent = `<iframe src="${path}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" loading="lazy"></iframe>`;
  } else if (cat === 'image') {
    popContent = `<img src="${path}" alt="${post.title}" loading="lazy" />`;
  } else if (cat === 'text') {
    popContent = `<pre data-src="${path}">Carregando…</pre>`;
  } else {
    popContent = `
      <div class="pop-no-preview">
        <span>${fileEmoji(post.ext)}</span>
        <span>.${post.ext.toUpperCase()}</span>
        <span style="font-size:11px">Clique para abrir</span>
      </div>`;
  }

  return `
  <div class="post-card" data-slug="${post.slug}">
    <div class="card-thumb">${thumb}</div>
    <div class="card-body">
      <div class="card-title" title="${post.title}">${post.title}</div>
      <div class="card-meta">
        <span>${formatDate(post.date)}</span>
        ${post.size ? `<span>${formatSize(post.size)}</span>` : ''}
      </div>
    </div>
    <div class="card-preview-pop">
      <div class="pop-header">
        <span>${fileEmoji(post.ext)}</span>
        <span>${post.title}</span>
      </div>
      <div class="pop-body">${popContent}</div>
    </div>
  </div>`;
}

function listItemHTML(post) {
  return `
  <div class="list-item" data-slug="${post.slug}">
    <span class="list-icon">${fileEmoji(post.ext)}</span>
    <div class="list-info">
      <div class="list-title">${post.title}</div>
      <div class="list-meta">${formatDate(post.date)}${post.description ? ' · ' + post.description : ''}${post.size ? ' · ' + formatSize(post.size) : ''}</div>
    </div>
    <span class="list-badge">${post.ext.toUpperCase()}</span>
  </div>`;
}

// ── View toggle ───────────────────────────────────────────
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });
});

// ── Modal ─────────────────────────────────────────────────
function openModal(post) {
  if (!post) return;
  const path = buildPath(post);
  const cat = fileCategory(post.ext);

  $('modalTitleText').textContent = post.title;

  const body = $('modalBody');
  if (cat === 'image') {
    body.innerHTML = `<img src="${path}" alt="${post.title}" />`;
  } else if (cat === 'pdf') {
    body.innerHTML = `<iframe src="${path}" title="${post.title}"></iframe>`;
  } else if (cat === 'text') {
    body.innerHTML = `<div class="text-viewer" id="textContent">Carregando…</div>`;
    fetch(path).then(r => r.text()).then(t => {
      const el = document.getElementById('textContent');
      if (el) el.textContent = t;
    });
  } else {
    body.innerHTML = `
      <div class="no-preview">
        <span class="icon">${fileEmoji(post.ext)}</span>
        <p>Pré-visualização não disponível para arquivos .${post.ext}.</p>
      </div>`;
  }

  $('modalFooter').innerHTML = `
    <div class="modal-info">
      <strong>${post.title}</strong>
      <p class="meta">${formatDate(post.date)}${post.description ? ' · ' + post.description : ''}${post.size ? ' · ' + formatSize(post.size) : ''}</p>
    </div>
    <a class="btn-download" href="${path}" download="${post.filename}">⬇ Baixar</a>`;

  $('modalOverlay').classList.add('open');
}

$('modalClose').addEventListener('click', () => $('modalOverlay').classList.remove('open'));
$('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) $('modalOverlay').classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('modalOverlay').classList.remove('open'); });

// ── Boot ──────────────────────────────────────────────────
loadPosts();
