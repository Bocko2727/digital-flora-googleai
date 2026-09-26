// Main catalog UI script, loaded from index.html as <script type="module">.
// Extracted verbatim (original indentation kept) from the former inline
// module block so the CSP script-src does not need 'unsafe-inline'.
// Module scope and execution order are unchanged.

// --- CSP: delegated event handling (no inline on*="" attributes) ---
// Elements declare what they do via data-action (click),
// data-change-action (change) and data-input-action (input); arguments live
// in data-* attributes. One listener per event type on document dispatches
// to the same window.* functions the former inline handlers called.
// Handlers receive an event-like object whose currentTarget is the element
// carrying the data-*-action attribute (as it was for inline handlers), so
// savePlant/submitCreatePlant keep finding their own button.
const delegatedEvent = (e, el) => ({
  type: e.type,
  target: e.target,
  currentTarget: el,
  preventDefault: () => e.preventDefault(),
  stopPropagation: () => e.stopPropagation(),
  nativeEvent: e,
});

const CLICK_ACTIONS = {
  'trigger-upload': () => window.triggerUpload(),
  'open-create-plant': () => window.openCreatePlantForm(),
  'set-grid-view': (ev, el) => window.setGridView(el.dataset.view),
  'open-google-picker': () => window.openGooglePicker(),
  'toggle-theme': () => window.toggleTheme(),
  'toggle-auth-panel': () => window.toggleAuthPanel(),
  'scroll-top': () => window.scrollTo({ top: 0, behavior: 'smooth' }),
  'page-prev': () => window.goToPage(window.currentPage - 1),
  'page-next': () => window.goToPage(window.currentPage + 1),
  'go-to-page': (ev, el) => window.goToPage(Number(el.dataset.page)),
  'jump-to-letter': (ev, el) => window.jumpToLetter(el.dataset.letter),
  'reload': () => location.reload(),
  'modal-overlay': (ev) => window.handleModalOverlayClick(ev),
  'close-modal': () => window.closeModal(),
  'auth-overlay': (ev) => window.handleAuthOverlayClick(ev),
  'close-auth-panel': () => window.closeAuthPanel(),
  'sign-in': (ev) => window.signInUser(ev),
  'logout': () => window.logoutUser(),
  'create-plant-overlay': (ev) => window.handleCreatePlantOverlayClick(ev),
  'close-create-plant': () => window.closeCreatePlantForm(),
  'submit-create-plant': (ev) => window.submitCreatePlant(ev),
  'open-plant': (ev, el) => window.openPlant(Number(el.dataset.idx)),
  'change-photo': (ev, el) => window.change(Number(el.dataset.delta)),
  'edit-plant': () => window.editPlant(),
  'delete-plant': (ev, el) => window.deletePlant(el.dataset.plantId),
  'run-qa': () => window.runQA(),
  'draw-modal': () => window.drawModal(),
  'save-plant': (ev, el) => window.savePlant(el.dataset.plantId, ev),
};
const CHANGE_ACTIONS = {
  'upload-plant': (ev) => window.uploadPlant(ev),
  'filter': () => window.onFilterChange(),
  'page-size': (ev, el) => window.setPageSize(el.value),
  'upload-plant-photos': (ev, el) => window.uploadPlantPhotos(el.dataset.plantId, ev),
};
const INPUT_ACTIONS = {
  'filter': () => window.onFilterChange(),
};

// Mirrors inline-handler bubbling: every ancestor with an action attribute
// fires, innermost first. The chain is collected before any handler runs so
// a handler that re-renders the DOM cannot cut it short.
function dispatchDelegated(e, attr, actions) {
  const chain = [];
  for (let el = e.target instanceof Element ? e.target.closest(`[${attr}]`) : null; el; el = el.parentElement && el.parentElement.closest(`[${attr}]`)) {
    chain.push(el);
  }
  for (const el of chain) {
    if (e.cancelBubble) break;
    const handler = actions[el.getAttribute(attr)];
    if (!handler) continue;
    // Like separate inline handlers: one throwing does not stop the others.
    try { handler(delegatedEvent(e, el), el); } catch (err) { (window.reportError || console.error)(err); }
  }
}
document.addEventListener('click', (e) => dispatchDelegated(e, 'data-action', CLICK_ACTIONS));
document.addEventListener('change', (e) => dispatchDelegated(e, 'data-change-action', CHANGE_ACTIONS));
document.addEventListener('input', (e) => dispatchDelegated(e, 'data-input-action', INPUT_ACTIONS));

// Broken-image fallback (replaces inline onerror="this.src='/icon.svg'").
// 'error' does not bubble, so listen in the capture phase. The equality
// guard stops an endless loop if the fallback image itself fails.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fallback) return;
  if (img.getAttribute('src') !== img.dataset.fallback) img.src = img.dataset.fallback;
}, true);
    let cachedAccessToken = null;
    const setCachedAccessToken = (token) => { cachedAccessToken = token; };
    const getCachedAccessToken = () => cachedAccessToken;

    // --- Supabase Auth (minimal, email/password only; no Google/social login) ---
    // Backend (Task 6) remains the sole authorization authority; this UI only
    // attaches the Bearer token and reflects role for convenience.
    let supabaseClient = null;
    window.currentProfileRole = null;

    function authHeaders() {
      const token = getCachedAccessToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return headers;
    }
    window.authHeaders = authHeaders;

    // Resolves a stored photo reference to a displayable URL. New uploads
    // (Task 7) store full https:// Supabase Storage URLs directly; legacy
    // entries store bare filenames that need the old string-transform.
    // A fixed cache-busting query param avoids stale CDN-cached 404 responses
    // for filenames that were requested before the underlying object existed.
    function resolvePhotoUrl(rawPhoto) {
      if (!rawPhoto) return '/icon.svg';
      if (rawPhoto.startsWith('data:image')) return rawPhoto;
      if (/^https?:\/\//i.test(rawPhoto)) return rawPhoto.includes('?') ? rawPhoto : rawPhoto + '?cb=1';
      const storageBase = 'https://sxuxtsbyqjaodyuqebux.supabase.co/storage/v1/object/public/plant-images/';
      const fileName = rawPhoto
        .replace(/^\/+/, '')
        .replace(/^images\/review\//, '')
        .replace(/^images\//, '')
        .replace(/^review\//, '')
        .replace(/^IMG(\d+\.(?:jpe?g|png))$/i, 'IMG_$1');
      return fileName ? storageBase + encodeURIComponent(fileName) + '?cb=1' : '/icon.svg';
    }
    window.resolvePhotoUrl = resolvePhotoUrl;

    // Escapes dynamic plant/user/AI-sourced text before it is interpolated
    // into an innerHTML template string, to close the stored-XSS sinks in
    // cardsHtml/drawModal/editPlant (a plant name/description containing
    // markup must render as text, not execute).
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]));
    }
    window.escapeHtml = escapeHtml;

    function roleCanWrite(role) {
      return role === 'editor' || role === 'admin';
    }

    function setWriteUiVisible(visible) {
      const writeActions = document.getElementById('writeActions');
      if (writeActions) writeActions.style.display = visible ? 'flex' : 'none';
    }

    function renderAuthUi() {
      const container = document.getElementById('authContainer');
      if (!container) return;
      if (window.currentUser) {
        const emailLabel = (window.currentUser.email || 'потребител').replace(/</g, '');
        const roleLabel = window.currentProfileRole || 'viewer';
        container.innerHTML = `
      <div class="user-profile">
        <span class="user-name">${emailLabel} (${roleLabel})</span>
        <button class="logout-mini" data-action="logout">Изход</button>
      </div>
    `;
      } else {
        container.innerHTML = '<button class="auth-btn" id="authToggleBtn" data-action="toggle-auth-panel">🔐 Вход</button>';
      }
      setWriteUiVisible(roleCanWrite(window.currentProfileRole));
    }

    window.toggleAuthPanel = function () {
      const panel = document.getElementById('authPanel');
      if (panel) panel.classList.add('open');
    };
    window.closeAuthPanel = function () {
      const panel = document.getElementById('authPanel');
      if (panel) panel.classList.remove('open');
      const err = document.getElementById('authError');
      if (err) err.style.display = 'none';
    };
    window.handleAuthOverlayClick = function (event) {
      if (event && event.target && event.target.id === 'authPanel') closeAuthPanel();
    };

    // Loads the vendored, version-pinned @supabase/supabase-js UMD bundle
    // (P2.3: same-origin static file instead of a runtime esm.sh CDN
    // import) and returns the global it attaches to `window`.
    function loadSupabaseJs() {
      if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/vendor/supabase-js.umd.js';
        script.onload = () => resolve(window.supabase);
        script.onerror = () => reject(new Error('Неуспешно зареждане на Supabase SDK.'));
        document.head.appendChild(script);
      });
    }

    async function initSupabaseAuth() {
      try {
        const configRes = await fetch('/api/config');
        if (!configRes.ok) throw new Error('Конфигурацията на Supabase не е достъпна.');
        const config = await configRes.json();
        if (!config.supabaseUrl || !config.supabasePublishableKey) {
          console.warn('Supabase Auth не е конфигуриран на сървъра. Входът остава недостъпен.');
          return;
        }
        const { createClient } = await loadSupabaseJs();
        supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey);

        const { data: { session } } = await supabaseClient.auth.getSession();
        await applySession(session);

        supabaseClient.auth.onAuthStateChange(async (_event, changedSession) => {
          await applySession(changedSession);
        });
      } catch (err) {
        console.warn('Supabase Auth инициализацията е неуспешна:', err);
      }
    }

    async function applySession(session) {
      if (session && session.access_token && session.user) {
        setCachedAccessToken(session.access_token);
        window.currentUser = { email: session.user.email, uid: session.user.id };
        window.currentProfileRole = await resolveOwnRole(session.access_token);
      } else {
        setCachedAccessToken(null);
        window.currentUser = null;
        window.currentProfileRole = null;
      }
      renderAuthUi();
    }

    // Convenience-only role lookup for the UI; the server enforces the real
    // authorization decision independently on every write request (Task 6).
    async function resolveOwnRole(token) {
      try {
        const res = await fetch('/api/auth/whoami', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.role || null;
      } catch (e) {
        return null;
      }
    }

    window.signInUser = async function (event) {
      if (event) event.preventDefault();
      const errEl = document.getElementById('authError');
      if (errEl) errEl.style.display = 'none';
      if (!supabaseClient) {
        if (errEl) { errEl.textContent = 'Supabase Auth не е конфигуриран.'; errEl.style.display = 'block'; }
        return;
      }
      const email = document.getElementById('auth_email').value.trim();
      const password = document.getElementById('auth_password').value;
      if (!email || !password) {
        if (errEl) { errEl.textContent = 'Моля, въведете имейл и парола.'; errEl.style.display = 'block'; }
        return;
      }
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        if (errEl) { errEl.textContent = 'Грешка при вход: ' + error.message; errEl.style.display = 'block'; }
        return;
      }
      await applySession(data.session);
      closeAuthPanel();
    };

    // --- Manual "create plant" form (Priority 1: catalog entry independent of AI upload) ---
    window.openCreatePlantForm = function () {
      ['c_cname', 'c_lname', 'c_fam', 'c_rec', 'c_hab', 'c_look', 'c_ben', 'c_risk', 'c_use', 'c_fact'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const err = document.getElementById('createPlantError');
      if (err) err.style.display = 'none';
      const panel = document.getElementById('createPlantPanel');
      if (panel) panel.classList.add('open');
    };
    window.closeCreatePlantForm = function () {
      const panel = document.getElementById('createPlantPanel');
      if (panel) panel.classList.remove('open');
    };
    window.handleCreatePlantOverlayClick = function (event) {
      if (event && event.target && event.target.id === 'createPlantPanel') closeCreatePlantForm();
    };

    window.submitCreatePlant = async function (event) {
      const btn = event ? event.currentTarget || event.target : null;
      const errEl = document.getElementById('createPlantError');
      if (errEl) errEl.style.display = 'none';

      const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
      const commonName = val('c_cname');
      const latinName = val('c_lname');
      if (!commonName || !latinName) {
        if (errEl) { errEl.textContent = 'Българско и латинско име са задължителни.'; errEl.style.display = 'block'; }
        return;
      }

      const payload = {
        commonName,
        latinName,
        family: val('c_fam'),
        photos: [],
        recognition: val('c_rec'),
        habitat: val('c_hab'),
        lookalikes: val('c_look'),
        benefits: val('c_ben'),
        risks: val('c_risk'),
        uses: val('c_use'),
        funFact: val('c_fact')
      };

      if (btn) { btn.disabled = true; btn.innerText = 'Записване...'; }
      try {
        const res = await fetch('/api/plants', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Грешка при създаване на записа (HTTP ${res.status}).`);
        }
        closeCreatePlantForm();
        await loadPlants();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      } finally {
        if (btn) { btn.disabled = false; btn.innerText = '💾 Създай запис'; }
      }
    };

    window.toggleTheme = function () {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    };

    const src = 'Таксономия: Plants of the World Online (Royal Botanic Gardens, Kew); разпространение: проверка чрез български флористични източници; рискове: ветеринарни/токсикологични източници при нужда. Снимковото определяне не е основание за консумация или самолечение.';

    window.allPlants = [];
    window.filteredPlants = [];
    window.currentPage = 1;
    window.pageSize = parseInt((localStorage.getItem('pageSize') || '12'), 10) || 12;

    let n = 0, photo = 0;
    window.currentUser = null;

    // Dynamic Google Picker Loader Helper
    let pickerApiLoaded = false;
    async function loadGooglePickerApi() {
      if (window.google && window.google.picker) {
        pickerApiLoaded = true;
        return true;
      }
      if (!window.gapi) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error('Неуспешно зареждане на Google API'));
          document.head.appendChild(script);
        });
      }
      return new Promise((resolve) => {
        window.gapi.load('picker', () => {
          pickerApiLoaded = true;
          resolve(true);
        });
      });
    }

    // Display-only fallback for empty optional text fields. Never used for
    // values that are sent back to the API (see editPlant/savePlant).
    // Human-readable labels for public.plants.taxonomy_status (provenance of
    // the identification, CLAUDE.md §4.13).
    const TAXONOMY_STATUS_LABELS = {
      'manual-unverified': 'Ръчно въведено, непроверено',
      'source-suggested': 'Предложено от източник',
      'editor-confirmed': 'Потвърдено от редактор',
      'needs-review': 'За преглед',
    };
    const taxonomyStatusLabel = (status) => TAXONOMY_STATUS_LABELS[status] || TAXONOMY_STATUS_LABELS['manual-unverified'];

    const shown = (value, fallback) => (typeof value === 'string' && value.trim()) ? value : fallback;

    // True when the record's botanical text comes from an AI analysis (single
    // upload "AI x%" or the AI-generated botanical archive) rather than from an
    // editor. Such text is labelled as unverified (CLAUDE.md §4.13/§4.14).
    const isAiSourced = (confidence) => /\bAI\b|архив|Vision/i.test(String(confidence || ''));
    const AI_TEXT_MARK = '<span class="ai-text-mark" title="Текстът е генериран от AI и не е проверен от ботаник.">AI текст — непроверен</span>';

    // Badge helper
    const sc = s => (s && s.startsWith('Потвърдено')) ? 'badge' : (s && s.startsWith('Неопределимо')) ? 'badge unc' : 'badge prob';

    // Modal click handler
    window.handleModalOverlayClick = function (event) {
      if (event && event.target && event.target.id === 'modal') {
        closeModal();
      }
    };

    // Forward wheel scroll from anywhere inside modal content to the .info scroll container
    document.addEventListener('wheel', (e) => {
      const modal = document.getElementById('modal');
      if (!modal || !modal.classList.contains('open')) return;
      const info = document.querySelector('.info');
      if (!info) return;
      if (modal.contains(e.target) && !info.contains(e.target)) {
        info.scrollTop += e.deltaY;
      }
    }, { passive: true });

    window.logoutUser = async function () {
      try {
        if (supabaseClient) await supabaseClient.auth.signOut();
      } catch (e) {
        console.warn('Sign out warning:', e);
      }
      setCachedAccessToken(null);
      window.currentUser = null;
      window.currentProfileRole = null;
      renderAuthUi();
    };

    window.triggerUpload = function () {
      const inp = document.getElementById('uploadInput');
      if (inp) inp.click();
    };

    // Google Picker Integration
    window.openGooglePicker = function () {
      alert('Google Drive import е временно недостъпен по време на Supabase Auth миграцията.');
    };

    // --- Design quick wins (Б.6.5): изглед Голям / Компактен / Списък ---
    window.setGridView = function (mode) {
      const grid = document.getElementById('grid');
      if (!grid) return;
      grid.classList.remove('view-large', 'view-compact', 'view-list');
      grid.classList.add('view-' + mode);
      try { localStorage.setItem('gridView', mode); } catch (e) { }
      document.querySelectorAll('#viewToggle button').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === mode);
      });
    };

    // --- Design quick wins (Б.6.5): бърз А-Я скок ---
    const AZ_LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ'.split('');
    function renderAzJump() {
      const wrap = document.getElementById('azJump');
      if (!wrap) return;
      wrap.innerHTML = AZ_LETTERS.map((letter) =>
        `<button data-action="jump-to-letter" data-letter="${letter}" title="Скочи до '${letter}'">${letter}</button>`
      ).join('');
    }
    window.jumpToLetter = function (letter) {
      const sortEl = document.getElementById('sortFilter');
      if (sortEl && sortEl.value !== 'az') {
        sortEl.value = 'az';
        window.onFilterChange();
      }
      const idx = window.filteredPlants.findIndex((p) => (p.commonName || '').toUpperCase().startsWith(letter));
      if (idx === -1) return;
      const targetPage = Math.floor(idx / window.pageSize) + 1;
      window.currentPage = targetPage;
      renderCurrentPage();
      requestAnimationFrame(() => {
        const localIdx = idx - (targetPage - 1) * window.pageSize;
        const cards = document.querySelectorAll('.plant-card');
        const target = cards[localIdx];
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    // --- Design quick wins (Б.6.5): "▲ Нагоре" плаващ бутон ---
    window.addEventListener('scroll', () => {
      const btn = document.getElementById('backToTopBtn');
      if (!btn) return;
      if (window.scrollY > 400) btn.classList.add('visible');
      else btn.classList.remove('visible');
    }, { passive: true });

    // Shown when /api/plants served the read-only AI archive instead of the
    // live Supabase catalog (Supabase down/empty), so the fallback is not
    // silently mistaken for real catalog data.
    function showCatalogSourceNotice(source) {
      let notice = document.getElementById('catalogSourceNotice');
      const grid = document.getElementById('grid');
      if (source !== 'archive-fallback') {
        if (notice) notice.remove();
        return;
      }
      if (notice || !grid || !grid.parentNode) return;
      notice = document.createElement('div');
      notice.id = 'catalogSourceNotice';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'margin:0 0 12px;padding:10px 14px;border-radius:8px;background:#fff4e5;color:#7a4b00;font-size:14px;';
      notice.textContent = '⚠️ Живият каталог (Supabase) не е достъпен — показва се архивно AI копие само за четене. Редакция и изтриване не са възможни.';
      grid.parentNode.insertBefore(notice, grid);
    }

    // Load Plants from REST API
    async function loadPlants(retries = 2) {
      try {
        const res = await fetch('/api/plants');
        if (!res.ok) {
          throw new Error('Грешка при зареждане на растенията.');
        }
        const dataList = await res.json();
        showCatalogSourceNotice(res.headers.get('X-Catalog-Source'));
        const families = new Set();
        window.allPlants = [];

        (dataList || []).forEach((data) => {
          window.allPlants.push({
            id: data.id || `plant_${Math.random()}`,
            commonName: data.commonName || 'Неопределено растение',
            latinName: data.latinName || '',
            family: data.family || '',
            photos: Array.isArray(data.photos) ? data.photos : [data.photos || 'placeholder.jpg'],
            confidence: data.confidence || 'Вероятно',
            taxonomyStatus: data.taxonomyStatus || 'manual-unverified',
            // Raw values ('' when empty): display fallbacks are applied only
            // in drawModal via shown(), so the editor never saves them back.
            recognition: data.recognition || '',
            habitat: data.habitat || '',
            lookalikes: data.lookalikes || '',
            benefits: data.benefits || '',
            risks: data.risks || '',
            uses: data.uses || '',
            funFact: data.funFact || '',
            author: data.authorEmail || ''
          });
          if (data.family) {
            families.add(data.family.replace(/\s*\(.*?\)\s*/g, '').trim());
          }
        });

        const famSelect = document.getElementById('familyFilter');
        if (famSelect) {
          famSelect.innerHTML = '<option value="">Всички семейства</option>';
          Array.from(families).sort().forEach(f => {
            if (f) famSelect.innerHTML += `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`;
          });
        }
        onFilterChange();
      } catch (err) {
        console.warn('Plants fetch attempt failed:', err);
        if (retries > 0) {
          setTimeout(() => loadPlants(retries - 1), 1000);
        } else {
          const grid = document.getElementById('grid');
          if (grid) {
            grid.innerHTML = `
          <div style="text-align:center;grid-column:1/-1;padding:40px;color:var(--muted)">
            <p>Възникна временна пауза при свързване със сървъра.</p>
            <button data-action="reload" style="background:var(--green);color:#fff;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:bold;">Презареди</button>
          </div>
        `;
          }
        }
      }
    }

    window.onFilterChange = function () {
      const searchEl = document.getElementById('searchInput');
      const famEl = document.getElementById('familyFilter');
      const confEl = document.getElementById('confidenceFilter');
      const sortEl = document.getElementById('sortFilter');

      const q = (searchEl ? searchEl.value : '').toLowerCase().trim();
      const fam = (famEl ? famEl.value : '').toLowerCase();
      const conf = confEl ? confEl.value : '';
      const sort = sortEl ? sortEl.value : 'newest';

      window.filteredPlants = window.allPlants.filter(p => {
        const textMatch = p.commonName.toLowerCase().includes(q) || p.latinName.toLowerCase().includes(q);
        const famMatch = fam === '' || p.family.toLowerCase().includes(fam);
        const confMatch = conf === '' || p.confidence.startsWith(conf);
        return textMatch && famMatch && confMatch;
      });

      if (sort === 'az') {
        window.filteredPlants.sort((a, b) => a.commonName.localeCompare(b.commonName, 'bg'));
      }

      window.currentPage = 1;
      renderCurrentPage();
    };

    // --- Design quick wins: pagination (замества infinite scroll / "Зареди още") ---
    window.setPageSize = function (size) {
      window.pageSize = parseInt(size, 10) || 12;
      try { localStorage.setItem('pageSize', String(window.pageSize)); } catch (e) { }
      window.currentPage = 1;
      renderCurrentPage();
    };

    function renderPaginationControls(totalPages) {
      const wrap = document.getElementById('paginationWrap');
      const numbersEl = document.getElementById('pageNumbers');
      const prevBtn = document.getElementById('prevPageBtn');
      const nextBtn = document.getElementById('nextPageBtn');
      if (!wrap || !numbersEl) return;

      if (totalPages <= 1) {
        wrap.style.display = 'none';
        return;
      }
      wrap.style.display = 'flex';

      if (prevBtn) prevBtn.disabled = window.currentPage <= 1;
      if (nextBtn) nextBtn.disabled = window.currentPage >= totalPages;

      const cur = window.currentPage;
      let startP = Math.max(1, cur - 2);
      let endP = Math.min(totalPages, startP + 4);
      startP = Math.max(1, endP - 4);
      const pages = [];
      for (let i = startP; i <= endP; i++) pages.push(i);

      numbersEl.innerHTML = pages.map((p) =>
        `<button class="page-num${p === cur ? ' active' : ''}" data-action="go-to-page" data-page="${p}">${p}</button>`
      ).join('');
    }

    window.goToPage = function (page) {
      const totalPages = Math.max(1, Math.ceil(window.filteredPlants.length / window.pageSize));
      if (page < 1 || page > totalPages) return;
      window.currentPage = page;
      renderCurrentPage();
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function renderCurrentPage() {
      const grid = document.getElementById('grid');
      if (!grid) return;
      const total = window.filteredPlants.length;
      const totalPages = Math.max(1, Math.ceil(total / window.pageSize));
      if (window.currentPage > totalPages) window.currentPage = totalPages;
      if (window.currentPage < 1) window.currentPage = 1;

      const counterText = document.getElementById('counterText');

      if (total === 0) {
        grid.innerHTML = '<div style="text-align:center;grid-column:1/-1;padding:50px;color:var(--muted)">Няма намерени растения по тези критерии.</div>';
        if (counterText) counterText.innerText = `Показани 0 от 0 образеца`;
        renderPaginationControls(1);
        return;
      }

      const start = (window.currentPage - 1) * window.pageSize;
      const end = Math.min(start + window.pageSize, total);
      const chunk = window.filteredPlants.slice(start, end);

      const cardsHtml = chunk.map((p, idx) => {
        const globalIdx = start + idx;
        const imgPath = resolvePhotoUrl(p.photos[0] || '');

        return `
      <div class="plant-card" data-action="open-plant" data-idx="${globalIdx}">
        <img class="plant-card-img" src="${escapeHtml(imgPath)}" alt="${escapeHtml(p.commonName)}" loading="lazy" data-fallback="/icon.svg">
        <div class="plant-card-content">
          <h3 class="plant-card-title">${escapeHtml(p.commonName)}</h3>
          <div class="plant-card-latin">${escapeHtml(p.latinName)}</div>
          <div class="plant-card-meta">📁 ${escapeHtml(p.family || 'Непознато семейство')}</div>
          <div class="plant-card-footer">
            <span class="${sc(p.confidence)}">${escapeHtml((p.confidence || '').split('—')[0].trim())}</span>
          </div>
        </div>
      </div>
    `;
      }).join('');

      grid.innerHTML = cardsHtml;

      if (counterText) counterText.innerText = `Показани ${start + 1}–${end} от ${total} образеца (Общо в хербария: ${window.allPlants.length})`;
      renderPaginationControls(totalPages);
    }

    // Resizes an image file to a JPEG data URI for AI analysis and Storage
    // upload. Shared by the single-file and batch (Task 0.2) upload paths so
    // both follow identical resize parameters.
    function resizeImageForAiUpload(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Неуспешно четене на файла.'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Файлът не е валидно изображение.'));
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 900;
            if (width > height) {
              if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
              if (height > max_size) { width *= max_size / height; height = max_size; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Processes one selected file end-to-end: AI analysis -> create plant
    // record (no photos yet) -> upload the same resized image to the
    // Storage-backed /api/plants/:id/photos endpoint. Throws on the AI
    // analysis or plant-creation step (fatal for this file); a failed Storage
    // upload is logged but does not fail the whole file, matching the 0.1
    // single-upload behaviour.
    async function processOnePlantUpload(file) {
      const base64String = await resizeImageForAiUpload(file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ image: base64String })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Грешка при анализа на снимката.');
      }
      const result = await res.json();
      const record = result.record;

      // Only AI-returned values are stored; fields the AI did not provide
      // stay empty (null) instead of fabricated filler text. Confidence is
      // sent raw ('0.92') and labelled server-side as an AI suggestion; the
      // AI safety note is explicitly marked as unverified (CLAUDE.md §4.13/14).
      const joinList = (v) => Array.isArray(v) ? v.join(', ') : (v || null);
      const pData = {
        commonName: record.likely_common_name_bg || 'Неопределено растение',
        latinName: record.likely_scientific_name || 'Неопределен таксон',
        family: record.family || null,
        photos: [],
        confidence: (typeof record.confidence === 'number' && record.confidence >= 0 && record.confidence <= 1)
          ? String(record.confidence)
          : 'Вероятно (AI Анализ)',
        recognition: record.visible_features || null,
        lookalikes: joinList(record.possible_lookalikes),
        risks: record.safety_note ? 'AI бележка (непроверена): ' + record.safety_note : null,
        funFact: joinList(record.additional_photos_needed),
        taxonomyStatus: 'needs-review'
      };

      const createRes = await fetch('/api/plants', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(pData)
      });
      if (!createRes.ok) {
        const payload = await createRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Грешка при запис на растението.');
      }
      const createdPayload = await createRes.json().catch(() => ({}));
      const newPlantId = createdPayload && createdPayload.plant ? createdPayload.plant.id : null;

      // Returned to uploadPlant so a record created without its photo is
      // reported to the user, not only logged to the console.
      let photoFailed = !newPlantId;
      if (newPlantId) {
        try {
          const photoRes = await fetch(`/api/plants/${encodeURIComponent(newPlantId)}/photos`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ image: base64String })
          });
          if (!photoRes.ok) {
            const photoPayload = await photoRes.json().catch(() => ({}));
            console.warn(`Снимка "${file.name}": качването в Storage е неуспешно:`, photoPayload.error || photoRes.status);
            photoFailed = true;
          }
        } catch (photoErr) {
          console.warn(`Снимка "${file.name}": качването в Storage е неуспешно:`, photoErr.message);
          photoFailed = true;
        }
      }
      return { photoFailed };
    }

    // Upload Plant Feature (Task 0.1 single file + Task 0.2 bulk upload).
    // Files are processed sequentially, NOT via Promise.all, so progress is
    // reported per file and one failing file (bad image, AI error, etc.)
    // logs an error and continues to the next file instead of aborting the
    // whole batch.
    window.uploadPlant = async function uploadPlant(event) {
      const files = event && event.target && event.target.files ? Array.from(event.target.files) : [];
      if (!files.length) return;

      const status = document.getElementById('uploadStatus');
      const total = files.length;
      let succeeded = 0;
      const failedFiles = [];
      const noPhotoFiles = [];

      for (let index = 0; index < total; index++) {
        const file = files[index];
        if (status) {
          status.style.display = 'block';
          status.innerText = `⏳ Обработва се ${index + 1} от ${total}: "${file.name}"...`;
        }
        try {
          const outcome = await processOnePlantUpload(file);
          succeeded += 1;
          if (outcome && outcome.photoFailed) noPhotoFiles.push(file.name);
        } catch (err) {
          failedFiles.push(file.name);
          console.error(`Грешка при обработка на "${file.name}":`, err);
        }
      }

      if (status) {
        if (!failedFiles.length && !noPhotoFiles.length) {
          status.innerText = total === 1
            ? '✅ Растението е добавено успешно.'
            : `✅ Обработени успешно ${succeeded} от ${total} снимки.`;
        } else {
          const parts = [`⚠️ Обработени ${succeeded} от ${total}.`];
          if (failedFiles.length) parts.push(`Неуспешни: ${failedFiles.join(', ')}.`);
          if (noPhotoFiles.length) parts.push(`Добавени без снимка (качването в Storage се провали): ${noPhotoFiles.join(', ')}.`);
          status.innerText = parts.join(' ');
        }
        // Warnings stay visible; only a clean success auto-hides.
        if (!failedFiles.length && !noPhotoFiles.length) setTimeout(() => { status.style.display = 'none'; }, 6000);
      }

      if (event && event.target) event.target.value = '';

      await loadPlants();
      if (succeeded > 0) window.openPlant(0);
    };

    // Modal functions
    window.openPlant = function (idx) {
      n = idx;
      photo = 0;
      drawModal();
      const modal = document.getElementById('modal');
      if (modal) modal.classList.add('open');
    };

    window.closeModal = function () {
      const modal = document.getElementById('modal');
      if (modal) modal.classList.remove('open');
    };

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    window.change = function (d) {
      const p = window.filteredPlants[n];
      if (!p) return;
      photo = (photo + d + p.photos.length) % p.photos.length;
      drawModal();
    };

    window.drawModal = function () {
      const p = window.filteredPlants[n];
      if (!p) return;
      const a = p.photos;
      const multi = a.length > 1;
      const curPhoto = a[photo] || '';
      const imgPath = resolvePhotoUrl(curPhoto);
      const viewEl = document.getElementById('view');
      if (!viewEl) return;

      const aiMark = isAiSourced(p.confidence) ? AI_TEXT_MARK : '';
      viewEl.innerHTML = `
    <article class="layout">
      <div class="photo-column">
        <div class="photo-wrap">
          <img class="photo" src="${escapeHtml(imgPath)}" alt="${escapeHtml(p.commonName)}" data-fallback="/icon.svg">
        </div>
        ${multi ? `
          <div class="gallery">
            <button data-action="change-photo" data-delta="-1">← Предишна</button>
            <span>${photo + 1} от ${a.length}</span>
            <button data-action="change-photo" data-delta="1">Следваща →</button>
          </div>
        ` : ''}
      </div>
      <div class="info">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <h2>${escapeHtml(p.commonName)}</h2>
          <div style="display:flex; gap:8px;">
            <button data-action="edit-plant" style="background:var(--hover-bg); color:var(--ink); border:1px solid var(--line); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:14px;" title="Редакция">✏️ Редакция</button>
            <button data-action="delete-plant" data-plant-id="${escapeHtml(p.id)}" style="background:var(--badge-unc-bg); color:var(--red); border:1px solid var(--line); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:14px;" title="Изтриване">🗑️ Изтрий</button>
          </div>
        </div>
        <div class="latin">${escapeHtml(p.latinName)}</div>
        <span class="${sc(p.confidence)}">${escapeHtml(p.confidence)}</span>

        <div class="meta">
          <div><b>Семейство</b>${escapeHtml(p.family || 'Неизвестно')}</div>
          <div><b>Статус на идентификацията</b>${escapeHtml(taxonomyStatusLabel(p.taxonomyStatus))}</div>
        </div>

        <h3>Разпознаване (диагностични белези)${aiMark}</h3>
        <p>${escapeHtml(shown(p.recognition, 'Няма данни'))}</p>
        <p><b>Местообитание и разпространение:</b> ${escapeHtml(shown(p.habitat, 'Няма данни'))}</p>
        <p><b>Възможни двойници:</b> ${escapeHtml(shown(p.lookalikes, '-'))}</p>

        <h3>Ползи и екологична роля${aiMark}</h3>
        <p>${escapeHtml(shown(p.benefits, 'Няма данни'))}</p>

        <h3>Вреди и рискове (токсичност)${aiMark}</h3>
        <p>${escapeHtml(shown(p.risks, 'Няма данни — рисковете не са проверени.'))}</p>

        <h3>Традиционни и съвременни употреби${aiMark}</h3>
        <p>${escapeHtml(shown(p.uses, 'Няма данни'))}</p>

        <h3>Любопитен факт${aiMark}</h3>
        <p>${escapeHtml(shown(p.funFact, '-'))}</p>

        <div class="note">
          <b>Забележка за точност:</b> При „Вероятно“ и „Неопределимо“ липсват един или повече диагностични белези. Не използвай записа за ядливост, самолечение или бране от природата.
        </div>
        <div class="sources"><b>Източници:</b> ${escapeHtml(src)}</div>
        
        <div class="qa-box">
          <h3 style="margin:0 0 4px 0; color:var(--blue); font-size:15px;">🔍 Интерактивен QA Контрол</h3>
          <p style="font-size:13px; margin:0 0 10px 0; color:var(--muted);">Попитай AI ботаника дали снимката отговаря на името.</p>
          <button data-action="run-qa" style="background:#2563eb; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">Извърши AI верификация</button>
          <div id="qa-result" style="margin-top:10px; font-weight:600; font-size:14px; white-space:pre-wrap;"></div>
        </div>
      </div>
    </article>
  `;
    };

    // 1) editPlant renders the edit form (fixed Day 2 known bug: this used to
    //    be mislabeled as runQA).
    window.editPlant = async function () {
      const p = window.filteredPlants[n];
      const curPhoto = p.photos[photo] || '';
      const imgPath = resolvePhotoUrl(curPhoto);
      const viewEl = document.getElementById('view');
      if (!viewEl) return;

      viewEl.innerHTML = `
    <article class="layout">
      <div class="photo-column">
        <div class="photo-wrap">
          <img class="photo" src="${escapeHtml(imgPath)}" alt="${escapeHtml(p.commonName)}" data-fallback="/icon.svg">
        </div>
      </div>
      <div class="info">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h2 style="margin:0;">Редакция на образец</h2>
          <button data-action="draw-modal" style="background:#e0e7e1; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Отказ</button>
        </div>

        <div class="form-group">
          <label>Българско име</label>
          <input type="text" id="e_cname" value="${escapeHtml(p.commonName)}">
        </div>
        <div class="form-group">
          <label>Латинско име</label>
          <input type="text" id="e_lname" value="${escapeHtml(p.latinName)}">
        </div>
        <div class="form-group">
          <label>Семейство</label>
          <input type="text" id="e_fam" value="${escapeHtml(p.family)}">
        </div>
        <div class="form-group">
          <label>Статус на сигурност</label>
          <input type="text" id="e_conf" value="${escapeHtml(p.confidence)}">
        </div>
        <div class="form-group">
          <label for="e_tax">Статус на идентификацията</label>
          <select id="e_tax">
            ${Object.entries(TAXONOMY_STATUS_LABELS).map(([value, label]) => `<option value="${value}"${value === (p.taxonomyStatus || 'manual-unverified') ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Разпознаване (диагностични белези)</label>
          <textarea id="e_rec" rows="3">${escapeHtml(p.recognition)}</textarea>
        </div>
        <div class="form-group">
          <label>Местообитание и разпространение</label>
          <textarea id="e_hab" rows="2">${escapeHtml(p.habitat)}</textarea>
        </div>
        <div class="form-group">
          <label>Възможни двойници</label>
          <input type="text" id="e_look" value="${escapeHtml(p.lookalikes)}">
        </div>
        <div class="form-group">
          <label>Ползи / Екологична роля</label>
          <textarea id="e_ben" rows="2">${escapeHtml(p.benefits)}</textarea>
        </div>
        <div class="form-group">
          <label>Вреди и рискове (токсичност)</label>
          <textarea id="e_risk" rows="2">${escapeHtml(p.risks)}</textarea>
        </div>
        <div class="form-group">
          <label>Употреби (традиционни/съвременни)</label>
          <textarea id="e_use" rows="2">${escapeHtml(p.uses || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Любопитен факт</label>
          <textarea id="e_fact" rows="2">${escapeHtml(p.funFact)}</textarea>
        </div>

        <div class="form-group">
          <label>Снимки (${(p.photos || []).length} качени)</label>
          <input type="file" id="e_photo_input" accept="image/jpeg,image/png,image/webp" multiple data-change-action="upload-plant-photos" data-plant-id="${escapeHtml(p.id)}">
          <div id="photoUploadStatus" style="font-size:12px; color:var(--muted); margin-top:6px;"></div>
        </div>

        <button data-action="save-plant" data-plant-id="${escapeHtml(p.id)}" style="background:var(--green); color:white; border:none; padding:12px; border-radius:6px; cursor:pointer; width:100%; font-weight:bold; font-size:15px; margin-top:10px;">💾 Запази промените</button>
      </div>
    </article>
  `;
    };

    // 2) runQA calls the real /api/qa backend endpoint and fills #qa-result
    //    without wiping the rest of the current drawModal() view.
    window.runQA = async function () {
      const p = window.filteredPlants[n];
      const resultEl = document.getElementById('qa-result');
      if (!p || !resultEl) return;

      resultEl.textContent = '⏳ AI ботаникът проверява снимката...';
      try {
        const curPhoto = p.photos[photo] || '';
        const imgUrl = resolvePhotoUrl(curPhoto);

        // Бекендът приема filename като локален path, allowed GitHub URL,
        // ИЛИ data:image base64 URI (трети fallback клон в /api/qa).
        // Текущите Supabase Storage URL-и не минават през първите два клона,
        // затова винаги пращаме base64 data URI — универсално съвместимо.
        const imgRes = await fetch(imgUrl);
        if (!imgRes.ok) throw new Error('Снимката не може да се зареди за проверка.');
        const blob = await imgRes.blob();
        // The server's missing-image fallback is an SVG placeholder, which
        // the AI endpoint does not accept; say so instead of a vague 404.
        if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error('Няма реална снимка (JPEG/PNG/WebP) за проверка — записът показва заместващо изображение.');
        const dataUri = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Неуспешно четене на снимката.'));
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });

        const res = await fetch('/api/qa', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            filename: dataUri,
            claimedName: p.commonName,
            latinName: p.latinName
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Грешка (HTTP ${res.status}).`);
        resultEl.textContent = data.verdict || 'Няма отговор от AI.';
      } catch (err) {
        resultEl.textContent = '❌ ' + err.message;
      }
    };

    window.savePlant = async function (id, ev) {
      const btn = ev ? ev.currentTarget || ev.target : null;
      if (btn) {
        btn.innerText = 'Запазване...';
        btn.disabled = true;
      }

      const cname = document.getElementById('e_cname') ? document.getElementById('e_cname').value : '';
      const lname = document.getElementById('e_lname') ? document.getElementById('e_lname').value : '';
      const fam = document.getElementById('e_fam') ? document.getElementById('e_fam').value : '';
      const conf = document.getElementById('e_conf') ? document.getElementById('e_conf').value : '';
      const tax = document.getElementById('e_tax') ? document.getElementById('e_tax').value : undefined;
      const rec = document.getElementById('e_rec') ? document.getElementById('e_rec').value : '';
      const hab = document.getElementById('e_hab') ? document.getElementById('e_hab').value : '';
      const look = document.getElementById('e_look') ? document.getElementById('e_look').value : '';
      const ben = document.getElementById('e_ben') ? document.getElementById('e_ben').value : '';
      const risk = document.getElementById('e_risk') ? document.getElementById('e_risk').value : '';
      const use = document.getElementById('e_use') ? document.getElementById('e_use').value : '';
      const fact = document.getElementById('e_fact') ? document.getElementById('e_fact').value : '';

      const updateData = {
        commonName: cname,
        latinName: lname,
        family: fam,
        confidence: conf,
        ...(tax ? { taxonomyStatus: tax } : {}),
        recognition: rec,
        habitat: hab,
        lookalikes: look,
        benefits: ben,
        risks: risk,
        uses: use,
        funFact: fact
      };

      try {
        const updateRes = await fetch(`/api/plants/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(updateData)
        });
        if (!updateRes.ok) {
          const payload = await updateRes.json().catch(() => ({}));
          throw new Error(payload.error || 'Грешка при обновяване на растението.');
        }

        const p = window.filteredPlants[n];
        if (p) {
          Object.assign(p, updateData);
        }

        drawModal();
        renderCurrentPage();
      } catch (e) {
        alert("Грешка при запазване: " + e.message);
        if (btn) {
          btn.innerText = '💾 Запази промените';
          btn.disabled = false;
        }
      }
    };

    window.deletePlant = async function (id) {
      if (!confirm('Сигурни ли сте, че искате да изтриете този ботанически запис?')) return;
      try {
        const deleteRes = await fetch(`/api/plants/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        if (!deleteRes.ok) {
          const payload = await deleteRes.json().catch(() => ({}));
          throw new Error(payload.error || 'Грешка при изтриване на растението.');
        }
        closeModal();
        await loadPlants();
      } catch (e) {
        alert("Грешка при изтриване: " + e.message);
      }
    };

    // Secure local photo upload for an existing plant record (Task 7).
    // Reuses the same client-side downscale-to-JPEG approach as the AI
    // upload flow, but posts to the dedicated, Storage-backed endpoint and
    // never touches Gemini/Kilo. Runs sequentially so errors are attributable
    // to a specific file, and multi-select is supported without extra
    // complexity in the security flow (one authenticated request per file).
    function readFileAsResizedDataUri(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Неуспешно четене на файла.'));
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = () => reject(new Error('Файлът не е валидно изображение.'));
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 1600;
            if (width > height) {
              if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
              if (height > max_size) { width *= max_size / height; height = max_size; }
            }
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.88));
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    window.uploadPlantPhotos = async function (plantId, event) {
      const files = event && event.target && event.target.files ? Array.from(event.target.files) : [];
      const statusEl = document.getElementById('photoUploadStatus');
      if (!files.length) return;

      const MAX_CLIENT_BYTES = 5 * 1024 * 1024;
      let uploaded = 0;
      let failed = 0;

      for (const file of files) {
        if (statusEl) statusEl.textContent = `⏳ Качване на ${uploaded + failed + 1} от ${files.length}...`;
        try {
          if (file.size > MAX_CLIENT_BYTES) throw new Error('Файлът е по-голям от 5 MB.');
          const dataUri = await readFileAsResizedDataUri(file);
          const res = await fetch(`/api/plants/${encodeURIComponent(plantId)}/photos`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ image: dataUri })
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.error || `Грешка при качване (HTTP ${res.status}).`);
          uploaded += 1;
          const p = window.filteredPlants[n];
          if (p && payload.plant && Array.isArray(payload.plant.photos)) {
            p.photos = payload.plant.photos;
          }
        } catch (err) {
          failed += 1;
          console.error('Photo upload error:', err);
          if (statusEl) statusEl.textContent = `❌ ${err.message}`;
        }
      }

      if (statusEl && !failed) statusEl.textContent = `✅ Качени ${uploaded} снимка(и).`;
      else if (statusEl && failed) statusEl.textContent = `⚠️ Качени ${uploaded}, неуспешни ${failed}.`;

      if (event && event.target) event.target.value = '';
      editPlant();
    };

    // PWA Service Worker Registration (P2.2: network-first HTML in sw.js
    // means a new deploy shows up on next load; this toast additionally
    // offers an immediate, user-initiated reload instead of forcing one).
    function showUpdateToast(waitingWorker) {
      if (document.getElementById('swUpdateToast')) return;
      const toast = document.createElement('div');
      toast.id = 'swUpdateToast';
      toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink,#1f2a1f);color:#fff;padding:12px 18px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);display:flex;gap:12px;align-items:center;z-index:9999;font-size:14px;';
      toast.textContent = 'Нова версия достъпна — ';
      const reloadBtn = document.createElement('button');
      reloadBtn.textContent = 'Презареди';
      reloadBtn.style.cssText = 'background:var(--green,#2f7a3d);color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:bold;';
      reloadBtn.onclick = () => {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        reloadBtn.disabled = true;
        reloadBtn.textContent = 'Презареждане...';
      };
      toast.appendChild(reloadBtn);
      document.body.appendChild(toast);
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('PWA Service Worker registered:', reg.scope);
          if (reg.waiting) showUpdateToast(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateToast(installing);
              }
            });
          });
        }).catch((err) => {
          console.warn('Service Worker registration skipped:', err);
        });
      });
      // Reload only when an already-controlling worker is replaced (an update
      // the user accepted). On a first visit sw.js calls clients.claim(),
      // which also fires controllerchange; reloading then would throw away
      // whatever the user was doing (search, an edit, an upload in progress).
      const hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);
      let reloadedForUpdate = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadControllerAtLoad || reloadedForUpdate) return;
        reloadedForUpdate = true;
        window.location.reload();
      });
    }

    // Initial Boot
    renderAzJump();
    setGridView(localStorage.getItem('gridView') || 'large');
    document.getElementById('pageSizeSelect').value = String(window.pageSize);
    loadPlants();
    initSupabaseAuth();
