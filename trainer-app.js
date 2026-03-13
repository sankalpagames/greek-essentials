// ================================================================
// trainer-app.js — логика греческого тренажёра
// Зависит от: trainer-data.js (EXERCISES)
// ================================================================

const STORAGE_KEY = 'greek_trainer_v2';
let progress = { done:[], order:[], current:0 };
let slots = [];
let bank  = [];
let checked = false, solved = false;

// ================================================================
// PERSISTENCE
// ================================================================
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch(e) {}
}
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if (p && Array.isArray(p.done) && p.order && p.order.length===EXERCISES.length) { progress=p; return; }
  } catch(e) {}
  progress = { done:[], order:shuffle([...Array(EXERCISES.length).keys()]), current:0 };
}
function resetProgress() {
  if (!confirm('Сбросить весь прогресс?')) return;
  localStorage.removeItem(STORAGE_KEY);
  progress = { done:[], order:shuffle([...Array(EXERCISES.length).keys()]), current:0 };
  renderExercise();
}

// ================================================================
// HELPERS
// ================================================================
function shuffle(arr) {
  for (let i=arr.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function capitalize(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
function currentEx()   { return EXERCISES[progress.order[progress.current]]; }

// Bank entry for a word
function bankEntry(w) { return bank.find(b=>b.word===w); }

// ================================================================
// RENDER
// ================================================================
function renderProgress() {
  const total=EXERCISES.length, done=progress.done.length;
  document.getElementById('prog-label').textContent = 'Упражнение '+(progress.current+1)+' из '+total;
  document.getElementById('prog-done').textContent  = done+' выполнено';
  document.getElementById('prog-fill').style.width  = (done/total*100)+'%';
}

function renderSlots() {
  const ex=currentEx(), pm=ex.punct||{}, c=document.getElementById('slots');
  c.innerHTML='';
  slots.forEach((slot,idx) => {
    if (slot.word===null) {
      const el=document.createElement('div');
      el.className='slot-token empty';
      c.appendChild(el);
    } else {
      const el=document.createElement('div');
      el.className='slot-token';
      el.textContent = slot.word;
      if (checked) {
        if (slot.locked) {
          el.classList.add('correct');
          // locked = не кликабельно
        } else {
          if (slot.checkState) el.classList.add(slot.checkState);
          el.classList.add('removable');
          el.addEventListener('click', ()=>removeSlot(idx));
        }
      } else {
        el.classList.add('removable');
        el.addEventListener('click', ()=>removeSlot(idx));
      }
      c.appendChild(el);
    }
    if (pm[idx]!==undefined) {
      const p=document.createElement('div');
      p.className='slot-token punct'; p.textContent=pm[idx]; c.appendChild(p);
    }
  });
  if (pm['end']!==undefined) {
    const p=document.createElement('div');
    p.className='slot-token punct'; p.textContent=pm['end']; c.appendChild(p);
  }
}

function renderBank() {
  const c=document.getElementById('word-bank');
  c.innerHTML='';
  bank.forEach(bw => {
    const exhausted = bw.usedCount >= bw.total;
    const el=document.createElement('div');
    el.className='word-chip';
    el.textContent=bw.word;
    if (exhausted) el.classList.add('used');
    if (checked && bw.checkState) el.classList.add('chip-'+bw.checkState);
    el.addEventListener('click', ()=>{
      if (exhausted) {
        // Remove one instance of this word from slots (first non-locked)
        const si=slots.findIndex(s=>s.word===bw.word&&!s.locked);
        if (si!==-1) removeSlot(si);
      } else {
        addWord(bw.word);
      }
    });
    c.appendChild(el);
  });
}

// ================================================================
// INTERACTIONS
// ================================================================
function addWord(word) {
  const bw=bankEntry(word);
  if (!bw || bw.usedCount>=bw.total) return;
  const ei=slots.findIndex(s=>s.word===null);
  if (ei===-1) return;
  slots[ei].word=word;
  bw.usedCount++;
  renderSlots(); renderBank();
}

function removeSlot(idx) {
  const slot=slots[idx];
  if (!slot || slot.word===null || slot.locked) return;
  const bw=bankEntry(slot.word);
  if (bw) bw.usedCount--;
  slot.word=null; slot.checkState=null;
  renderSlots(); renderBank();
}

function checkAnswer() {
  const ex=currentEx();
  if (slots.every(s=>s.word===null)) return;
  checked=true;

  // Reset checkStates on bank before recomputing
  bank.forEach(bw=>bw.checkState=null);

  slots.forEach((slot,idx)=>{
    if (slot.word===null) return;
    if (idx<ex.answer.length && ex.answer[idx]===slot.word) {
      slot.checkState='correct'; slot.locked=true;
    } else if (ex.answer.includes(slot.word)) {
      slot.checkState='misplaced';
    } else {
      slot.checkState='wrong';
    }
    // Mirror worst state to bank chip:
    // correct > misplaced > wrong (don't downgrade if already correct)
    const bw=bankEntry(slot.word);
    if (bw) {
      const rank = {correct:3, misplaced:2, wrong:1};
      if (!bw.checkState || rank[slot.checkState]>rank[bw.checkState])
        bw.checkState=slot.checkState;
    }
  });

  const allOk = slots.length===ex.answer.length &&
    slots.every((s,i)=> s.word===ex.answer[i]);

  if (allOk) {
    solved=true;
    if (!progress.done.includes(progress.order[progress.current])) {
      progress.done.push(progress.order[progress.current]);
      saveProgress();
    }
    const pm=ex.punct||{};
    let disp=ex.answer.map((w,i)=>{
      let t=w;
      if (pm[i]!==undefined) t+=pm[i];
      return t;
    }).join(' ');
    if (pm['end']) disp+=pm['end'];
    document.getElementById('el-answer-display').textContent=disp;
    document.getElementById('success-msg').classList.add('show');
    document.getElementById('btn-check').disabled=true;
    if (ex.hint) {
      document.getElementById('hint-msg').textContent='💡 '+ex.hint;
      document.getElementById('hint-msg').classList.add('show');
    }
    document.getElementById('btn-next').style.display='inline-flex';
    renderProgress();
  }
  renderSlots(); renderBank();
}

function clearAnswer() {
  slots.forEach(s=>{ s.word=null; s.locked=false; s.checkState=null; });
  bank.forEach(bw=>{ bw.usedCount=0; bw.checkState=null; });
  checked=false; solved=false;
  document.getElementById('btn-check').disabled=false;
  document.getElementById('success-msg').classList.remove('show');
  document.getElementById('hint-msg').classList.remove('show');
  document.getElementById('btn-next').style.display='none';
  document.getElementById('btn-check').disabled=false;
  renderSlots(); renderBank();
}

function nextExercise() {
  let a=0;
  do {
    progress.current=(progress.current+1)%progress.order.length; a++;
  } while (progress.done.includes(progress.order[progress.current]) && a<progress.order.length);
  saveProgress(); renderExercise();
}

function renderExercise() {
  if (progress.done.length>=EXERCISES.length) {
    document.getElementById('exercise-area').style.display='none';
    document.getElementById('completed-area').classList.add('show');
    document.getElementById('total-count').textContent=EXERCISES.length;
    renderProgress(); return;
  }
  let g=0;
  while (progress.done.includes(progress.order[progress.current])&&g++<progress.order.length)
    progress.current=(progress.current+1)%progress.order.length;

  document.getElementById('exercise-area').style.display='block';
  document.getElementById('completed-area').classList.remove('show');

  const ex=currentEx();
  checked=false; solved=false;
  document.getElementById('ru-text').textContent=ex.ru;

  slots=ex.answer.map(()=>({word:null, locked:false, checkState:null}));

  // Build bank: count occurrences of each word in ex.words
  const counts={};
  ex.words.forEach(w=>{ counts[w]=(counts[w]||0)+1; });
  const uniqueWords=Object.keys(counts);
  bank=shuffle(uniqueWords).map(w=>({ word:w, total:counts[w], usedCount:0, checkState:null }));

  document.getElementById('success-msg').classList.remove('show');
  document.getElementById('hint-msg').classList.remove('show');
  document.getElementById('btn-next').style.display='none';
  document.getElementById('btn-check').disabled=false;
  renderSlots(); renderBank(); renderProgress();
}

loadProgress();
renderExercise();
