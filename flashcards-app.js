// ============================================================
// app-logic.js — логика приложения greek-flashcards
// ============================================================
// ⚠️  Не добавляйте сюда слова — они не попадут в фильтры!
//    Все данные находятся в words-data.js
// ============================================================

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЛОГИКА: рендеринг, прогресс, фильтры, грамматические панели   ║
// ║  ⚠️  Не добавляйте сюда слова — они не попадут в фильтры      ║
// ╚══════════════════════════════════════════════════════════════════╝
// ============= GAME LOGIC =============
let deck = [];
let current = 0;
let mode = 'el-ru';
let isFlipped = false;
let activeCategories = new Set();
// status filters: multi-select. 'all' means no filter. others: 'unseen','studying','known'
let statusFilters = new Set(['all']);
let knownWords = new Set();
let studyingWords = new Set();
const allCategories = [...new Set(WORDS.map(w => w.cat))];
let grammarOpen = false;

function ev(e, fn) { e.stopPropagation(); fn(); }

function saveProgress() {
  try {
    localStorage.setItem('greek_known', JSON.stringify([...knownWords]));
    localStorage.setItem('greek_studying', JSON.stringify([...studyingWords]));
  } catch(e) {}
}

function loadProgress() {
  try {
    const k = localStorage.getItem('greek_known');
    if (k) knownWords = new Set(JSON.parse(k));
    const s = localStorage.getItem('greek_studying');
    if (s) studyingWords = new Set(JSON.parse(s));
  } catch(e) {}
}

function clearProgress() {
  if (!confirm('Сбросить все флаги?')) return;
  studyingWords = new Set();
  knownWords = new Set();
  saveProgress();
  updateStats();
  renderCard();
}

function init() {
  loadProgress();
  const fd = document.getElementById('filters');
  fd.innerHTML = '';
  const ab = document.createElement('button');
  ab.className = 'filter-btn active'; ab.textContent = 'Все'; ab.dataset.cat = 'all';
  ab.onclick = () => toggleCatFilter('all', ab); fd.appendChild(ab);
  allCategories.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'filter-btn'; b.textContent = cat; b.dataset.cat = cat;
    b.onclick = () => toggleCatFilter(cat, b); fd.appendChild(b);
  });
  activeCategories = new Set(['all']);
  buildDeck();
}

function toggleCatFilter(cat, btn) {
  if (cat === 'all') {
    activeCategories = new Set(['all']);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    activeCategories.delete('all');
    document.querySelector('[data-cat=all]').classList.remove('active');
    if (activeCategories.has(cat)) {
      activeCategories.delete(cat); btn.classList.remove('active');
      if (activeCategories.size === 0) { activeCategories.add('all'); document.querySelector('[data-cat=all]').classList.add('active'); }
    } else {
      activeCategories.add(cat); btn.classList.add('active');
    }
  }
  buildDeck();
}

// Status filters: multi-select. 'all' deselects others; selecting specific deselects 'all'
function toggleStatusFilter(filter) {
  if (filter === 'all') {
    statusFilters = new Set(['all']);
  } else {
    statusFilters.delete('all');
    if (statusFilters.has(filter)) {
      statusFilters.delete(filter);
      if (statusFilters.size === 0) statusFilters.add('all');
    } else {
      statusFilters.add(filter);
    }
  }
  updateStatusFilterUI();
  buildDeck();
}

function updateStatusFilterUI() {
  const isAll = statusFilters.has('all');
  const btn = id => document.getElementById(id);
  btn('sf-all').className = 'sflt-btn' + (isAll ? ' active-all' : '');
  btn('sf-unseen').className = 'sflt-btn' + (statusFilters.has('unseen') ? ' active-unseen' : '');
  btn('sf-studying').className = 'sflt-btn' + (statusFilters.has('studying') ? ' active-studying' : '');
  btn('sf-known').className = 'sflt-btn' + (statusFilters.has('known') ? ' active-known' : '');
}

function wordMatchesStatus(w) {
  if (statusFilters.has('all')) return true;
  const isKnown = knownWords.has(w.el);
  const isStudying = studyingWords.has(w.el);
  const isUnseen = !isKnown && !isStudying;
  if (statusFilters.has('known') && isKnown) return true;
  if (statusFilters.has('studying') && isStudying) return true;
  if (statusFilters.has('unseen') && isUnseen) return true;
  return false;
}

function getFilteredWords() {
  let f = activeCategories.has('all') ? [...WORDS] : WORDS.filter(w => activeCategories.has(w.cat));
  return f.filter(w => wordMatchesStatus(w));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toggleShuffle() {
  buildDeck();
}

function buildDeck() {
  deck = getFilteredWords();
  shuffle(deck);
  current = 0;
  updateStats();
  renderCard();
}

function setMode(m) {
  mode = m;
  document.getElementById('mode-el-ru').classList.toggle('active', m === 'el-ru');
  document.getElementById('mode-ru-el').classList.toggle('active', m === 'ru-el');
  renderCard();
}

function setCardWord(elId, word, art) {
  const el = document.getElementById(elId);
  if (art) {
    el.innerHTML = '<span class="card-article">' + art + '</span>' + word;
  } else {
    el.textContent = word;
  }
}

function renderCard() {
  document.getElementById('cardScene').classList.remove('flipped');
  isFlipped = false;
  document.getElementById('flipHint').textContent = '↕ нажми на карточку, чтобы перевернуть';

  if (deck.length === 0) {
    document.getElementById('frontCategory').textContent = '';
    document.getElementById('frontWord').textContent = 'Нет слов';
    document.getElementById('frontHint').textContent = 'Измени фильтры';
    document.getElementById('backTranslation').textContent = '';
    document.getElementById('backTranslit').textContent = '';
    document.getElementById('backExample').textContent = '';
    document.getElementById('backCategory').textContent = '';
    document.getElementById('progressText').textContent = '0 / 0';
    document.getElementById('progressFill').style.width = '0%';
    updateFlagButtons(null);
    return;
  }

  const w = deck[current];
  const isNum = w.type === 'num';
  document.getElementById('frontWord').classList.toggle('is-number', isNum);
  document.getElementById('backTranslation').classList.toggle('is-number', isNum);
  if (mode === 'el-ru') {
    document.getElementById('frontCategory').textContent = w.cat;
    setCardWord('frontWord', w.el, w.art);
    document.getElementById('frontHint').textContent = '';
    document.getElementById('backCategory').textContent = w.cat;
    document.getElementById('backTranslation').textContent = w.ru;
    document.getElementById('backTranslit').textContent = '';
    document.getElementById('backExample').textContent = w.ex || '';
  } else {
    document.getElementById('frontCategory').textContent = w.cat;
    document.getElementById('frontWord').textContent = w.ru;
    document.getElementById('frontHint').textContent = '';
    document.getElementById('backCategory').textContent = w.cat;
    setCardWord('backTranslation', w.el, w.art);
    document.getElementById('backTranslit').textContent = '';
    document.getElementById('backExample').textContent = w.ex || '';
  }

  updateFlagButtons(w);
  document.getElementById('progressText').textContent = (current + 1) + ' / ' + deck.length;
  document.getElementById('progressFill').style.width = ((current + 1) / deck.length * 100) + '%';

  // refresh grammar panel if open
  if (grammarOpen) renderGrammar(w);
}

function updateFlagButtons(w) {
  const isS = w ? studyingWords.has(w.el) : false;
  const isK = w ? knownWords.has(w.el) : false;
  ['studyingBtn','studyingBtn2'].forEach(id => {
    const b = document.getElementById(id);
    if(b) b.className = 'card-flag-btn' + (isS ? ' studying-active' : '');
  });
  ['knownBtn','knownBtn2'].forEach(id => {
    const b = document.getElementById(id);
    if(b) b.className = 'card-flag-btn' + (isK ? ' known-active' : '');
  });
}

function flipCard() {
  isFlipped = !isFlipped;
  document.getElementById('cardScene').classList.toggle('flipped', isFlipped);
  document.getElementById('flipHint').textContent = isFlipped
    ? '↩ нажми ещё раз, чтобы вернуть'
    : '↕ нажми на карточку, чтобы перевернуть';
}

function nextCard() {
  if (deck.length === 0) return;
  current = (current + 1) % deck.length;
  renderCard();
}

function prevCard() {
  if (deck.length === 0) return;
  current = (current - 1 + deck.length) % deck.length;
  renderCard();
}

function toggleStudying() {
  if (deck.length === 0) return;
  const w = deck[current];
  if (studyingWords.has(w.el)) studyingWords.delete(w.el);
  else studyingWords.add(w.el);
  saveProgress();
  rebuildIfNeeded();
  updateStats();
  updateFlagButtons(deck[current] || null);
}

function toggleKnown() {
  if (deck.length === 0) return;
  const w = deck[current];
  if (knownWords.has(w.el)) knownWords.delete(w.el);
  else knownWords.add(w.el);
  saveProgress();
  rebuildIfNeeded();
  updateStats();
  updateFlagButtons(deck[current] || null);
}

function rebuildIfNeeded() {
  // only rebuild if current status filter would now exclude the word
  if (!statusFilters.has('all')) {
    const newDeck = getFilteredWords();
    if (newDeck.length !== deck.length) {
      deck = newDeck;
      if (current >= deck.length) current = Math.max(0, deck.length - 1);
      renderCard();
    }
  }
}

function updateStats() {
  const allFiltered = activeCategories.has('all') ? [...WORDS] : WORDS.filter(w => activeCategories.has(w.cat));
  const total = allFiltered.length;
  const studying = allFiltered.filter(w => studyingWords.has(w.el)).length;
  const known = allFiltered.filter(w => knownWords.has(w.el)).length;
  const unseen = allFiltered.filter(w => !studyingWords.has(w.el) && !knownWords.has(w.el)).length;

  document.getElementById('statKnown').textContent = known;
  document.getElementById('statStudying').textContent = studying;
  document.getElementById('statUnseen').textContent = unseen;
  document.getElementById('statTotal').textContent = total;
}



// ============= GRAMMAR PANEL (inline) =============
let grammarTab=null;

function toggleGrammar(){
  const w = deck[current];
  if (!w) return;
  grammarOpen = !grammarOpen;
  const panel = document.getElementById('grammarInline');
  const infoBtns = document.querySelectorAll('.card-info-btn');
  if (grammarOpen) {
    grammarTab = null;
    renderGrammar(w);
    panel.classList.add('open');
    infoBtns.forEach(b => b.classList.add('info-open'));
  } else {
    panel.classList.remove('open');
    infoBtns.forEach(b => b.classList.remove('info-open'));
  }
}

// Keep old names as aliases for anything that might call them
function openGrammar() { if (!grammarOpen) toggleGrammar(); }
function closeGrammar() { if (grammarOpen) toggleGrammar(); }

function renderGrammar(w){
  const container=document.getElementById('grammarContent');
  const g=GRAMMAR[w.el];
  const wtype=w.type||'';

  let html=`<div class="grammar-word-header">${w.el}</div>`;
  html+=`<div class="grammar-word-ru">${w.ru}</div>`;

  if(!g){
    if(wtype==='verb'){
      html += autoConjugate(w.el, w.ru);
    } else if(wtype==='adj'){
      html+=`<div class="grammar-note">Прилагательное <em>${w.el}</em> изменяется по роду, числу и падежу.<br>Пример: ${w.ex||'—'}</div>`;
    } else if(wtype==='adverb'||wtype==='particle'){
      html+=`<div class="grammar-note">Слово <em>${w.el}</em> не изменяется.<br>Пример: ${w.ex||'—'}</div>`;
    } else if(wtype==='phrase'){
      html+=`<div class="grammar-note">Устойчивое выражение.<br>Пример: ${w.ex||'—'}</div>`;
    } else if(wtype==='pronoun'){
      if(['μου','σου','του','της','μας','σας','τους'].includes(w.el)) { html+=possessiveTable(w.el); } else { html+=pronounTable(w.el); }
    } else if(wtype==='num'){
      html+=`<div class="grammar-note">Числительное <em>${w.el}</em>.<br>Пример: ${w.ex||'—'}</div>`;
    } else if(wtype==='noun'){
      html+=`<div class="grammar-note">Существительное <em>${w.el}</em>. Артикль: ${w.art||'—'}<br>Пример: ${w.ex||'—'}</div>`;
    } else {
      html+=`<div class="grammar-note">Пример: ${w.ex||'—'}</div>`;
    }
    if(['ποιος','ποιο','πόσο'].includes(w.el)){
      html='<div class="grammar-word-header">'+w.el+'</div><div class="grammar-word-ru">'+w.ru+'</div>'+questionNote(w.el);
    }
    container.innerHTML=html; return;
  }

  if(g.type==='verb'){
    const tNames=Object.keys(g.tenses);
    if(!grammarTab||!tNames.includes(grammarTab)) grammarTab=tNames[0];
    html+=`<div class="tab-row">`;
    tNames.forEach(t=>{
      html+=`<button class="tab-btn${t===grammarTab?' active':''}" onclick="switchTab('${t}')">${t}</button>`;
    });
    html+=`</div>`;
    tNames.forEach(t=>{
      const rows=g.tenses[t];
      const id='gtab_'+t.replace(/[^a-zA-Zа-яА-Я]/g,'_');
      html+=`<div id="${id}" style="display:${t===grammarTab?'block':'none'}">`;
      html+=`<table class="gtable"><thead><tr><th>Лицо</th><th>Форма</th></tr></thead><tbody>`;
      rows.forEach(r=>{
        html+=`<tr><td class="label">${r.p}</td><td class="greek">${r.el}</td></tr>`;
      });
      html+=`</tbody></table></div>`;
    });
    if(g.note) html+=`<div class="grammar-note">${g.note}</div>`;
  }

  if(g.type==='adj'){
    const numNames=Object.keys(g.genders);
    if(!grammarTab||!numNames.includes(grammarTab)) grammarTab=numNames[0];
    html+=`<div class="tab-row">`;
    numNames.forEach(n=>{
      html+=`<button class="tab-btn${n===grammarTab?' active':''}" onclick="switchTab('${n}')">${n}</button>`;
    });
    html+=`</div>`;
    numNames.forEach(num=>{
      const rows=g.genders[num];
      const id='gtab_'+num.replace(/[^a-zA-Zа-яА-Я]/g,'_');
      html+=`<div id="${id}" style="display:${num===grammarTab?'block':'none'}">`;
      // Two side-by-side compact tables: Муж.+Ср. | Жен.
      html+=`<table class="gtable"><thead><tr><th>Падеж</th><th>Муж.</th><th>Ср.</th><th>Жен.</th></tr></thead><tbody>`;
      rows.forEach(r=>{
        html+=`<tr><td class="label">${r.c}</td><td class="greek">${r.m}</td><td class="greek">${r.n}</td><td class="greek">${r.f}</td></tr>`;
      });
      html+=`</tbody></table></div>`;
    });
    if(g.comparative){
      html+=`<div class="grammar-section-title">Степени сравнения</div>`;
      html+=`<table class="gtable"><thead><tr><th>Степень</th><th>Форма</th></tr></thead><tbody>`;
      html+=`<tr><td class="label">Положит.</td><td class="greek">${g.comparative.base}</td></tr>`;
      html+=`<tr><td class="label">Сравнит.</td><td class="greek">${g.comparative.comp}</td></tr>`;
      html+=`<tr><td class="label">Превосх.</td><td class="greek">${g.comparative.superl}</td></tr>`;
      html+=`</tbody></table>`;
    }
    if(g.note) html+=`<div class="grammar-note">${g.note}</div>`;
  }

  container.innerHTML=html;
}

function switchTab(name){
  grammarTab=name;
  document.querySelectorAll('[id^="gtab_"]').forEach(el=>el.style.display='none');
  const id='gtab_'+name.replace(/[^a-zA-Zа-яА-Я]/g,'_');
  const target=document.getElementById(id);
  if(target) target.style.display='block';
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.classList.toggle('active',b.textContent===name);
  });
}

function possessiveTable(word) {
  return `<div class="grammar-section-title">Притяжательные местоимения</div>
  <table class="gtable"><thead><tr><th>Лицо</th><th>Кратк. форма</th><th>Полная форма (м.)</th></tr></thead><tbody>
  <tr><td class="label">я (мой)</td><td class="greek">μου</td><td class="greek">δικός/ή/ό μου</td></tr>
  <tr><td class="label">ты (твой)</td><td class="greek">σου</td><td class="greek">δικός/ή/ό σου</td></tr>
  <tr><td class="label">он (его)</td><td class="greek">του</td><td class="greek">δικός/ή/ό του</td></tr>
  <tr><td class="label">она (её)</td><td class="greek">της</td><td class="greek">δικός/ή/ό της</td></tr>
  <tr><td class="label">мы (наш)</td><td class="greek">μας</td><td class="greek">δικός/ή/ό μας</td></tr>
  <tr><td class="label">вы (ваш)</td><td class="greek">σας</td><td class="greek">δικός/ή/ό σας</td></tr>
  <tr><td class="label">они (их)</td><td class="greek">τους</td><td class="greek">δικός/ή/ό τους</td></tr>
  </tbody></table>
  <div class="grammar-note">
    <strong>Краткая форма</strong> ставится после существительного с артиклем: <em>το σπίτι μου</em> (мой дом).<br>
    <strong>Полная форма</strong> δικός μου согласуется по роду: <em>δικός</em> (м.) / <em>δική</em> (ж.) / <em>δικό</em> (ср.)<br>
    Пример: <em>Είναι δικό μου.</em> — Это моё.
  </div>`;
}

function questionNote(word){
  const notes={
    'ποιος':'<div class="grammar-note"><strong>ποιος</strong> изменяется по роду и числу:<br>Муж.: <em>ποιος</em> · Жен.: <em>ποια</em> · Ср.: <em>ποιο</em><br>Мн.ч.: <em>ποιοι / ποιες / ποια</em></div>',
    'ποιο':'<div class="grammar-note"><strong>ποιο</strong> — средний род от ποιος.<br>Муж.: <em>ποιος</em> · Жен.: <em>ποια</em> · Ср.: <em>ποιο</em></div>',
    'πόσο':'<div class="grammar-note"><strong>πόσο</strong> изменяется по роду:<br>Муж.: <em>πόσος</em> · Жен.: <em>πόση</em> · Ср.: <em>πόσο</em><br>Мн.ч.: <em>πόσοι / πόσες / πόσα</em></div>',
  };
  return notes[word]||'<div class="grammar-note">Это вопросительное слово не изменяется по лицам.</div>';
}

function pronounTable(word){
  if(word==='αυτός'||word==='αυτή'||word==='αυτό'||word==='αυτοί'){
    return `<div class="grammar-section-title">Склонение αυτός / αυτή / αυτό</div>
    <table class="gtable"><thead><tr><th>Падеж</th><th>Муж.</th><th>Жен.</th><th>Ср.</th></tr></thead><tbody>
    <tr><td class="label">Именит. ед.</td><td class="greek">αυτός</td><td class="greek">αυτή</td><td class="greek">αυτό</td></tr>
    <tr><td class="label">Родит. ед.</td><td class="greek">αυτού</td><td class="greek">αυτής</td><td class="greek">αυτού</td></tr>
    <tr><td class="label">Винит. ед.</td><td class="greek">αυτόν</td><td class="greek">αυτή(ν)</td><td class="greek">αυτό</td></tr>
    <tr><td class="label">Именит. мн.</td><td class="greek">αυτοί</td><td class="greek">αυτές</td><td class="greek">αυτά</td></tr>
    <tr><td class="label">Родит. мн.</td><td class="greek">αυτών</td><td class="greek">αυτών</td><td class="greek">αυτών</td></tr>
    <tr><td class="label">Винит. мн.</td><td class="greek">αυτούς</td><td class="greek">αυτές</td><td class="greek">αυτά</td></tr>
    </tbody></table>
    <div class="grammar-note">Используется и как личное ("он/она"), и как указательное ("этот/эта") местоимение.</div>`;
  }
  if(word==='εγώ'||word==='εσύ'||word==='εμείς'||word==='εσείς'){
    return `<div class="grammar-section-title">Личные местоимения</div>
    <table class="gtable"><thead><tr><th>Лицо</th><th>Именит.</th><th>Родит. (кратк.)</th><th>Винит. (кратк.)</th></tr></thead><tbody>
    <tr><td class="label">1 ед. (я)</td><td class="greek">εγώ</td><td class="greek">μου</td><td class="greek">με</td></tr>
    <tr><td class="label">2 ед. (ты)</td><td class="greek">εσύ</td><td class="greek">σου</td><td class="greek">σε</td></tr>
    <tr><td class="label">3 м. (он)</td><td class="greek">αυτός</td><td class="greek">του</td><td class="greek">τον</td></tr>
    <tr><td class="label">3 ж. (она)</td><td class="greek">αυτή</td><td class="greek">της</td><td class="greek">τη(ν)</td></tr>
    <tr><td class="label">1 мн. (мы)</td><td class="greek">εμείς</td><td class="greek">μας</td><td class="greek">μας</td></tr>
    <tr><td class="label">2 мн. (вы)</td><td class="greek">εσείς</td><td class="greek">σας</td><td class="greek">σας</td></tr>
    <tr><td class="label">3 мн. (они)</td><td class="greek">αυτοί/ές</td><td class="greek">τους</td><td class="greek">τους</td></tr>
    </tbody></table>
    <div class="grammar-note">В греческом местоимение часто опускается, т.к. форма глагола указывает на лицо. Краткие формы ставятся перед глаголом: <em>μου αρέσει</em> (мне нравится), <em>σε αγαπώ</em> (я тебя люблю).</div>`;
  }
  return `<div class="grammar-note">Местоимение <strong>${word}</strong> является неизменяемым в данной форме.</div>`;
}

// ============= AUTO-CONJUGATION ENGINE =============
// Determines verb type and generates conjugation tables automatically

// AUTO-CONJUGATION ENGINE - see autoConjugate() below after PAST_OVERRIDES

function buildPastStem(verb, stem) {
  // -εύω → -ευσ (e.g. δουλεύω → δούλεψ... actually δούλεψα)
  // For simplicity, common patterns:
  if(verb.endsWith('εύω')) return stem.slice(0,-1) + 'ψ'; // δουλεύω → δούλεψ → no augment needed for illustration
  if(verb.endsWith('ψω')) return stem; // already has σ
  if(verb.endsWith('βω') || verb.endsWith('πω') || verb.endsWith('φω')) return stem.slice(0,-1)+'ψ'; // stop+σ=ψ
  if(verb.endsWith('γω') || verb.endsWith('κω') || verb.endsWith('χω')) return stem.slice(0,-1)+'ξ'; // velar+σ=ξ
  if(verb.endsWith('ζω')) return stem.slice(0,-1)+'σ'; // ακούω→ άκουσ
  if(verb.endsWith('ζω')) return stem.slice(0,-1)+'σ';
  if(verb.endsWith('ουω') || verb==='ακούω') return 'άκουσ'; // special
  // default: add σ
  return stem+'σ';
}

// Special override for ακούω
const PAST_OVERRIDES = {
  'ακούω': 'άκουσ',
  'τρώω': 'έφαγ',
  'βλέπω': 'είδ',
  'πίνω': 'ήπι',
  'μένω': 'έμειν',
  'κλείνω': 'έκλεισ',
  'ανοίγω': 'άνοιξ',
  'φεύγω': 'έφυγ',
  'περιμένω': 'περίμειν',
  'παίζω': 'έπαιξ',
  'διαβάζω': 'διάβασ',
  'γράφω': 'έγραψ',
  'πληρώνω': 'πλήρωσ',
  'καταλαβαίνω': 'κατάλαβ',
  'αρέσει': null,
  // -αίνω verbs with suppletive past (-ηκ-)
  'μπαίνω': 'μπήκ',
  'βγαίνω': 'βγήκ',
  'ανεβαίνω': 'ανέβηκ',
  'κατεβαίνω': 'κατέβηκ',
  // other irregular pasts
  'ξέρω': 'ήξερ',
  'δίνω': 'έδωσ',
  'κλαίω': 'έκλαψ',
  'ζω': 'έζησ',
  'υπάρχει': 'υπήρχ',
  'παίρνω': 'πήρ',
  'βάζω': 'έβαλ',
  'βρίσκω': 'βρήκ',
  'χάνω': 'έχασ',
  'αφήνω': 'άφησ',
  'αλλάζω': 'άλλαξ',
  'τρέχω': 'έτρεξ',
  'ξεκινώ': 'ξεκίνησ',  // type2 but needs augment
};

function buildPastStemSmart(verb, stem) {
  if(PAST_OVERRIDES.hasOwnProperty(verb)) return PAST_OVERRIDES[verb];
  return buildPastStem(verb, stem);
}

function buildFutStem(verb, stem, pastStem) {
  // For future, strip the augment (initial ε if added)
  // If past starts with έ/ή (augment), remove it
  if(pastStem && pastStem.match(/^[έήάίόύώ]/)) {
    // remove augment: first accented vowel is augment
    return pastStem.slice(1);
  }
  return pastStem || stem+'σ';
}

function autoDeponent(verb, meaning) {
  // Deponent verbs: έρχομαι, σκέφτομαι, αισθάνομαι, χρειάζομαι
  const DEPONENT_TABLES = {
    'κάθομαι': {
      pres:[
        {p:'εγώ',el:'κάθομαι'},{p:'εσύ',el:'κάθεσαι'},{p:'αυτός/ή/ό',el:'κάθεται'},
        {p:'εμείς',el:'καθόμαστε'},{p:'εσείς',el:'κάθεστε'},{p:'αυτοί/ές/ά',el:'κάθονται'},
      ],
      past:[
        {p:'εγώ',el:'κάθισα'},{p:'εσύ',el:'κάθισες'},{p:'αυτός/ή/ό',el:'κάθισε'},
        {p:'εμείς',el:'καθίσαμε'},{p:'εσείς',el:'καθίσατε'},{p:'αυτοί/ές/ά',el:'κάθισαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα καθίσω'},{p:'εσύ',el:'θα καθίσεις'},{p:'αυτός/ή/ό',el:'θα καθίσει'},
        {p:'εμείς',el:'θα καθίσουμε'},{p:'εσείς',el:'θα καθίσετε'},{p:'αυτοί/ές/ά',el:'θα καθίσουν'},
      ],
      note:'Деп. глагол "сидеть / садиться". Прошедшее: κάθισα.',
    },
    'έρχομαι': {
      pres:[
        {p:'εγώ',el:'έρχομαι'},{p:'εσύ',el:'έρχεσαι'},{p:'αυτός/ή/ό',el:'έρχεται'},
        {p:'εμείς',el:'ερχόμαστε'},{p:'εσείς',el:'έρχεστε'},{p:'αυτοί/ές/ά',el:'έρχονται'},
      ],
      past:[
        {p:'εγώ',el:'ήρθα'},{p:'εσύ',el:'ήρθες'},{p:'αυτός/ή/ό',el:'ήρθε'},
        {p:'εμείς',el:'ήρθαμε'},{p:'εσείς',el:'ήρθατε'},{p:'αυτοί/ές/ά',el:'ήρθαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα έρθω'},{p:'εσύ',el:'θα έρθεις'},{p:'αυτός/ή/ό',el:'θα έρθει'},
        {p:'εμείς',el:'θα έρθουμε'},{p:'εσείς',el:'θα έρθετε'},{p:'αυτοί/ές/ά',el:'θα έρθουν'},
      ],
      note:'Глагол-депонент. Форма пассивная, но значение активное. Прошедшее — неправильное.'
    },
    'σκέφτομαι': {
      pres:[
        {p:'εγώ',el:'σκέφτομαι'},{p:'εσύ',el:'σκέφτεσαι'},{p:'αυτός/ή/ό',el:'σκέφτεται'},
        {p:'εμείς',el:'σκεφτόμαστε'},{p:'εσείς',el:'σκέφτεστε'},{p:'αυτοί/ές/ά',el:'σκέφτονται'},
      ],
      past:[
        {p:'εγώ',el:'σκέφτηκα'},{p:'εσύ',el:'σκέφτηκες'},{p:'αυτός/ή/ό',el:'σκέφτηκε'},
        {p:'εμείς',el:'σκεφτήκαμε'},{p:'εσείς',el:'σκεφτήκατε'},{p:'αυτοί/ές/ά',el:'σκέφτηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα σκεφτώ'},{p:'εσύ',el:'θα σκεφτείς'},{p:'αυτός/ή/ό',el:'θα σκεφτεί'},
        {p:'εμείς',el:'θα σκεφτούμε'},{p:'εσείς',el:'θα σκεφτείτε'},{p:'αυτοί/ές/ά',el:'θα σκεφτούν'},
      ],
      note:'Глагол-депонент (пассивная форма, активное значение). Прошедшее на -θηκα.'
    },
    'αισθάνομαι': {
      pres:[
        {p:'εγώ',el:'αισθάνομαι'},{p:'εσύ',el:'αισθάνεσαι'},{p:'αυτός/ή/ό',el:'αισθάνεται'},
        {p:'εμείς',el:'αισθανόμαστε'},{p:'εσείς',el:'αισθάνεστε'},{p:'αυτοί/ές/ά',el:'αισθάνονται'},
      ],
      past:[
        {p:'εγώ',el:'αισθάνθηκα'},{p:'εσύ',el:'αισθάνθηκες'},{p:'αυτός/ή/ό',el:'αισθάνθηκε'},
        {p:'εμείς',el:'αισθανθήκαμε'},{p:'εσείς',el:'αισθανθήκατε'},{p:'αυτοί/ές/ά',el:'αισθάνθηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα αισθανθώ'},{p:'εσύ',el:'θα αισθανθείς'},{p:'αυτός/ή/ό',el:'θα αισθανθεί'},
        {p:'εμείς',el:'θα αισθανθούμε'},{p:'εσείς',el:'θα αισθανθείτε'},{p:'αυτοί/ές/ά',el:'θα αισθανθούν'},
      ],
      note:'Глагол-депонент. Прошедшее на -θηκα.'
    },
    'χρειάζομαι': {
      pres:[
        {p:'εγώ',el:'χρειάζομαι'},{p:'εσύ',el:'χρειάζεσαι'},{p:'αυτός/ή/ό',el:'χρειάζεται'},
        {p:'εμείς',el:'χρειαζόμαστε'},{p:'εσείς',el:'χρειάζεστε'},{p:'αυτοί/ές/ά',el:'χρειάζονται'},
      ],
      past:[
        {p:'εγώ',el:'χρειάστηκα'},{p:'εσύ',el:'χρειάστηκες'},{p:'αυτός/ή/ό',el:'χρειάστηκε'},
        {p:'εμείς',el:'χρειαστήκαμε'},{p:'εσείς',el:'χρειαστήκατε'},{p:'αυτοί/ές/ά',el:'χρειάστηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα χρειαστώ'},{p:'εσύ',el:'θα χρειαστείς'},{p:'αυτός/ή/ό',el:'θα χρειαστεί'},
        {p:'εμείς',el:'θα χρειαστούμε'},{p:'εσείς',el:'θα χρειαστείτε'},{p:'αυτοί/ές/ά',el:'θα χρειαστούν'},
      ],
      note:'Глагол-депонент. Часто используется безлично: χρειάζεται (нужно).'
    },
    'θυμάμαι': {
      pres:[
        {p:'εγώ',el:'θυμάμαι'},{p:'εσύ',el:'θυμάσαι'},{p:'αυτός/ή/ό',el:'θυμάται'},
        {p:'εμείς',el:'θυμόμαστε'},{p:'εσείς',el:'θυμάστε'},{p:'αυτοί/ές/ά',el:'θυμούνται'},
      ],
      past:[
        {p:'εγώ',el:'θυμήθηκα'},{p:'εσύ',el:'θυμήθηκες'},{p:'αυτός/ή/ό',el:'θυμήθηκε'},
        {p:'εμείς',el:'θυμηθήκαμε'},{p:'εσείς',el:'θυμηθήκατε'},{p:'αυτοί/ές/ά',el:'θυμήθηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα θυμηθώ'},{p:'εσύ',el:'θα θυμηθείς'},{p:'αυτός/ή/ό',el:'θα θυμηθεί'},
        {p:'εμείς',el:'θα θυμηθούμε'},{p:'εσείς',el:'θα θυμηθείτε'},{p:'αυτοί/ές/ά',el:'θα θυμηθούν'},
      ],
      note:'Глагол-депонент "помнить". Прошедшее: θυμήθηκα.',
    },
    'κοιμάμαι': {
      pres:[
        {p:'εγώ',el:'κοιμάμαι'},{p:'εσύ',el:'κοιμάσαι'},{p:'αυτός/ή/ό',el:'κοιμάται'},
        {p:'εμείς',el:'κοιμόμαστε'},{p:'εσείς',el:'κοιμάστε'},{p:'αυτοί/ές/ά',el:'κοιμούνται'},
      ],
      past:[
        {p:'εγώ',el:'κοιμήθηκα'},{p:'εσύ',el:'κοιμήθηκες'},{p:'αυτός/ή/ό',el:'κοιμήθηκε'},
        {p:'εμείς',el:'κοιμηθήκαμε'},{p:'εσείς',el:'κοιμηθήκατε'},{p:'αυτοί/ές/ά',el:'κοιμήθηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα κοιμηθώ'},{p:'εσύ',el:'θα κοιμηθείς'},{p:'αυτός/ή/ό',el:'θα κοιμηθεί'},
        {p:'εμείς',el:'θα κοιμηθούμε'},{p:'εσείς',el:'θα κοιμηθείτε'},{p:'αυτοί/ές/ά',el:'θα κοιμηθούν'},
      ],
      note:'Глагол-депонент "спать". Прошедшее: κοιμήθηκα.',
    },
    'φοβάμαι': {
      pres:[
        {p:'εγώ',el:'φοβάμαι'},{p:'εσύ',el:'φοβάσαι'},{p:'αυτός/ή/ό',el:'φοβάται'},
        {p:'εμείς',el:'φοβόμαστε'},{p:'εσείς',el:'φοβάστε'},{p:'αυτοί/ές/ά',el:'φοβούνται'},
      ],
      past:[
        {p:'εγώ',el:'φοβήθηκα'},{p:'εσύ',el:'φοβήθηκες'},{p:'αυτός/ή/ό',el:'φοβήθηκε'},
        {p:'εμείς',el:'φοβηθήκαμε'},{p:'εσείς',el:'φοβηθήκατε'},{p:'αυτοί/ές/ά',el:'φοβήθηκαν'},
      ],
      fut:[
        {p:'εγώ',el:'θα φοβηθώ'},{p:'εσύ',el:'θα φοβηθείς'},{p:'αυτός/ή/ό',el:'θα φοβηθεί'},
        {p:'εμείς',el:'θα φοβηθούμε'},{p:'εσείς',el:'θα φοβηθείτε'},{p:'αυτοί/ές/ά',el:'θα φοβηθούν'},
      ],
      note:'Глагол-депонент "бояться". Прошедшее: φοβήθηκα.',
    },
  };

  const d = DEPONENT_TABLES[verb];
  if(!d) return autoConjugate(verb, meaning);

  const tenses = {'Настоящее': d.pres, 'Прошедшее': d.past, 'Будущее': d.fut};
  const tNames = Object.keys(tenses);
  if(!grammarTab||!tNames.includes(grammarTab)) grammarTab=tNames[0];

  let html = `<div class="grammar-note" style="margin-bottom:12px;font-size:0.8rem;border-color:rgba(201,168,76,0.25);background:rgba(201,168,76,0.05);color:var(--gold-light)">
    Глагол-депонент &nbsp;·&nbsp; Пассивная форма, активное значение
  </div>`;

  html += `<div class="tab-row">`;
  tNames.forEach(t => {
    html += `<button class="tab-btn${t===grammarTab?' active':''}" onclick="switchTab('${t}')">${t}</button>`;
  });
  html += `</div>`;

  tNames.forEach(t => {
    const rows = tenses[t];
    const id = 'gtab_'+t.replace(/[^a-zA-Zа-яА-Я]/g,'_');
    html += `<div id="${id}" style="display:${t===grammarTab?'block':'none'}">`;
    html += `<table class="gtable"><thead><tr><th>Лицо</th><th>Форма</th></tr></thead><tbody>`;
    rows.forEach(r => {
      html += `<tr><td class="label">${r.p}</td><td class="greek">${r.el||r.f||''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });

  if(d.note) html += `<div class="grammar-note" style="margin-top:10px">${d.note}</div>`;
  return html;
}

// ============= AUTO-CONJUGATION ENGINE =============
function autoConjugate(verb, meaning) {
  // Special case: αρέσει is impersonal
  if(verb === 'αρέσει') {
    return `<div class="grammar-note" style="margin-bottom:10px">
      <strong>αρέσει</strong> — безличный глагол "нравиться".<br>
      Используется всегда в 3-м лице вместе с датив. местоимением:
    </div>
    <table class="gtable"><thead><tr><th>Кому</th><th>Ед. ч. (нравится)</th><th>Мн. ч. (нравятся)</th></tr></thead><tbody>
    <tr><td class="label">мне</td><td class="greek">μου αρέσει</td><td class="greek">μου αρέσουν</td></tr>
    <tr><td class="label">тебе</td><td class="greek">σου αρέσει</td><td class="greek">σου αρέσουν</td></tr>
    <tr><td class="label">ему/ей</td><td class="greek">του/της αρέσει</td><td class="greek">του/της αρέσουν</td></tr>
    <tr><td class="label">нам</td><td class="greek">μας αρέσει</td><td class="greek">μας αρέσουν</td></tr>
    <tr><td class="label">вам</td><td class="greek">σας αρέσει</td><td class="greek">σας αρέσουν</td></tr>
    <tr><td class="label">им</td><td class="greek">τους αρέσει</td><td class="greek">τους αρέσουν</td></tr>
    </tbody></table>
    <div class="grammar-note" style="margin-top:8px">Прошедшее: <em>μου άρεσε</em> (мне понравилось). Будущее: <em>θα μου αρέσει</em>.</div>`;
  }

  const isType2 = /[ώ]$/.test(verb);
  const isDeponent = /(ομαι|άμαι|ιέμαι|ούμαι)$/.test(verb);

  if(isDeponent) return autoDeponent(verb, meaning);

  let stem, pres, past, fut, typeLabel;

  const pastOverride = PAST_OVERRIDES.hasOwnProperty(verb) ? PAST_OVERRIDES[verb] : undefined;

  if(isType2) {
    stem = verb.slice(0,-1);
    typeLabel = 'Тип 2 (-ώ/-άς/-ά)';
    pres = [
      {p:'εγώ',       f:stem+'ώ'},
      {p:'εσύ',       f:stem+'άς'},
      {p:'αυτός/ή/ό', f:stem+'ά'},
      {p:'εμείς',     f:stem+'άμε'},
      {p:'εσείς',     f:stem+'άτε'},
      {p:'αυτοί/ές/ά',f:stem+'άνε'},
    ];
    past=[
      {p:'εγώ',       f:stem+'ησα'},
      {p:'εσύ',       f:stem+'ησες'},
      {p:'αυτός/ή/ό', f:stem+'ησε'},
      {p:'εμείς',     f:stem+'ήσαμε'},
      {p:'εσείς',     f:stem+'ήσατε'},
      {p:'αυτοί/ές/ά',f:stem+'ησαν'},
    ];
    fut=[
      {p:'εγώ',       f:'θα '+stem+'ήσω'},
      {p:'εσύ',       f:'θα '+stem+'ήσεις'},
      {p:'αυτός/ή/ό', f:'θα '+stem+'ήσει'},
      {p:'εμείς',     f:'θα '+stem+'ήσουμε'},
      {p:'εσείς',     f:'θα '+stem+'ήσετε'},
      {p:'αυτοί/ές/ά',f:'θα '+stem+'ήσουν'},
    ];
  } else {
    stem = verb.slice(0,-1);
    typeLabel = 'Тип 1 (-ω/-εις/-ει)';
    pres=[
      {p:'εγώ',       f:stem+'ω'},
      {p:'εσύ',       f:stem+'εις'},
      {p:'αυτός/ή/ό', f:stem+'ει'},
      {p:'εμείς',     f:stem+'ουμε'},
      {p:'εσείς',     f:stem+'ετε'},
      {p:'αυτοί/ές/ά',f:stem+'ουν'},
    ];

    let ps = pastOverride !== undefined ? pastOverride : buildPastStem(verb, stem);
    let fs = ps ? buildFutStem(verb, stem, ps) : stem+'σ';

    past=[
      {p:'εγώ',       f:ps+'α'},
      {p:'εσύ',       f:ps+'ες'},
      {p:'αυτός/ή/ό', f:ps+'ε'},
      {p:'εμείς',     f:ps+'αμε'},
      {p:'εσείς',     f:ps+'ατε'},
      {p:'αυτοί/ές/ά',f:ps+'αν'},
    ];
    fut=[
      {p:'εγώ',       f:'θα '+fs+'ω'},
      {p:'εσύ',       f:'θα '+fs+'εις'},
      {p:'αυτός/ή/ό', f:'θα '+fs+'ει'},
      {p:'εμείς',     f:'θα '+fs+'ουμε'},
      {p:'εσείς',     f:'θα '+fs+'ετε'},
      {p:'αυτοί/ές/ά',f:'θα '+fs+'ουν'},
    ];
  }

  const tenses={'Настоящее':pres,'Прошедшее':past,'Будущее':fut};
  const tNames=Object.keys(tenses);
  if(!grammarTab||!tNames.includes(grammarTab)) grammarTab=tNames[0];

  let html=`<div class="grammar-note" style="margin-bottom:12px;font-size:0.8rem;border-color:rgba(201,168,76,0.25);background:rgba(201,168,76,0.05);color:var(--gold-light)">
    ${typeLabel} &nbsp;·&nbsp; Будущее = <strong>θα</strong> + форма аориста
  </div>`;

  html+=`<div class="tab-row">`;
  tNames.forEach(t=>{
    html+=`<button class="tab-btn${t===grammarTab?' active':''}" onclick="switchTab('${t}')">${t}</button>`;
  });
  html+=`</div>`;

  tNames.forEach(t=>{
    const rows=tenses[t];
    const id='gtab_'+t.replace(/[^a-zA-Zа-яА-Я]/g,'_');
    html+=`<div id="${id}" style="display:${t===grammarTab?'block':'none'}">`;
    html+=`<table class="gtable"><thead><tr><th>Лицо</th><th>Форма</th></tr></thead><tbody>`;
    rows.forEach(r=>{
      html+=`<tr><td class="label">${r.p}</td><td class="greek">${r.f}</td></tr>`;
    });
    html+=`</tbody></table></div>`;
  });

  // Classify: truly irregular (past unrelated to present) vs regular stem change
  const TRULY_IRREGULAR = new Set(['τρώω','βλέπω','πίνω','μένω','περιμένω','καταλαβαίνω']);

  const isOverride = PAST_OVERRIDES.hasOwnProperty(verb);
  if (isOverride && TRULY_IRREGULAR.has(verb)) {
    html+=`<div class="grammar-note" style="margin-top:10px">⚠️ <strong>Неправильный аорист</strong> — прошедшее время не выводится из настоящего, нужно запомнить отдельно.</div>`;
  } else if (isOverride) {
    html+=`<div class="grammar-note" style="margin-top:10px">ℹ️ Основа аориста изменяется по фонетическому правилу (показана точная форма).</div>`;
  } else if (!isType2) {
    html+=`<div class="grammar-note" style="margin-top:10px">Прошедшее приближённое — построено по стандартным правилам. Может незначительно отличаться.</div>`;
  }

  return html;
}

init();
