'use strict';
const $=s=>document.querySelector(s),app=$('#app'),teacher=document.body.dataset.role==='teacher';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=n=>Number(n).toLocaleString('ko-KR')+'원';let session=null,state=null,polling=false,lastView='',clockOffset=0,questions=[],draft={text:'',prefix:''},draftRound=-2,editing=false,sortNames=false,failures=0;
function read(k,kind=localStorage){try{return JSON.parse(kind.getItem(k));}catch{return null;}}
function save(k,v,kind=localStorage){try{kind.setItem(k,JSON.stringify(v));}catch{}}
function status(msg='',bad=true){$('#status').className=msg?(bad?'error':'success'):'';$('#status').textContent=msg;}
function error(e){status(e.message||String(e));}
async function api(path,body=null,key=session?.key){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{let r=await fetch(path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{'Authorization':'Bearer '+key}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});let d;try{d=await r.json();}catch{throw Error('서버가 준비 중이거나 응답하지 않습니다. 잠시 후 다시 시도하세요.');}if(!r.ok){let e=Error(d.error||'요청에 실패했어요.');e.status=r.status;throw e;}return d;}finally{clearTimeout(timer);}}
function busy(btn,fn){return async()=>{if(btn.disabled)return;btn.disabled=true;try{await fn();}catch(e){error(e);}finally{if(btn.isConnected)btn.disabled=false;}};}
function on(id,fn){let b=$('#'+id);if(b)b.onclick=busy(b,fn);}
function adopt(s){session=s;if(teacher)save('price.teacher',s,sessionStorage);else save('price.student.'+s.code,s);lastView='';poll();}
async function poll(){if(!session||polling)return;polling=true;try{let d=await api('/api/state?room='+encodeURIComponent(session.code));clockOffset=d.serverNow-Date.now();if(failures>=3)status();failures=0;$('#net').textContent='● 연결됨 · 약 1초마다 동기화';let key=d.phase+':'+d.round+':'+d.version;state=d;if(key!==lastView){render(d);lastView=key;}timer();}catch(e){failures++;$('#net').textContent='연결 재시도 중…';if(e.status===403||e.status===404){status(e.message);leave(false);}else if(failures===3)status('연결이 끊겼어요. 답안을 보관하며 자동으로 재연결합니다.');}finally{polling=false;}}
function leave(clearStatus=true){if(teacher)sessionStorage.removeItem('price.teacher');else if(session)localStorage.removeItem('price.student.'+session.code);session=null;state=null;lastView='';if(clearStatus)status();init();}
async function action(a,extra={}){status();let r=await api('/api/control',{code:session.code,action:a,...extra});if(r.deleted){leave();return;}await poll();}
function timer(){if(!state)return;let el=$('#timer');if(!el)return;if(state.phase==='question'&&state.deadline){let n=Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000));el.textContent=n+'초';el.classList.toggle('urgent',n<=10);}else{el.textContent=state.phase==='question'?'직접 마감':'';el.classList.remove('urgent');}}
function ranking(d){return `<div class="scroll"><table><thead><tr><th>순위</th><th>학생</th><th>점수</th><th>Perfect</th></tr></thead><tbody>${(d.ranking||[]).map(s=>`<tr${s.id===d.me?.id?' class="podium"':''}><td>${s.rank<=3?['🥇','🥈','🥉'][s.rank-1]:s.rank}</td><td>${esc(s.name)}</td><td>${s.score}</td><td>${s.perfect}</td></tr>`).join('')}</tbody></table></div>`;}
function header(d){return `<div class="row between actions"><div class="row"><span class="pill">방 ${d.code}</span><span class="pill">${d.round<0?'입장 중':`${d.round+1} /${d.total} 문제`}</span>${!teacher?`<span class="pill">${esc(d.me.name)}</span>`:''}</div><div class="row">${teacher?'<button id="showQR" class="secondary">📱 접속 QR</button><button id="endRoom" class="danger">방 삭제</button>':'<button id="leave" class="secondary">나가기</button>'}</div></div>`;}
function bindCommon(){on('showQR',showQR);on('endRoom',async()=>{if(confirm('방과 모든 답안 기록을 삭제할까요?'))await action('delete');});on('leave',()=>{if(confirm('기기 저장 정보도 지워집니다. 나가면 같은 이름으로 재입장할 수 없습니다. 나갈까요?'))leave();});}
function joinURL(){return location.origin+'/?room='+session.code;}
function qrHTML(){let u=joinURL();return `<img class="qr" src="/qr?text=${encodeURIComponent(u)}" alt="학생 입장 QR"><div id="code">${session.code}</div><p><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></p><p class="subtle">QR 또는 위 주소로 접속하세요. 번호·별명을 사용하세요.</p>`;}
function showQR(){$('#qrContent').innerHTML=qrHTML();$('#qrDialog').showModal();}
$('#closeQR').onclick=()=>$('#qrDialog').close();
function render(d){if(teacher)renderTeacher(d);else renderStudent(d);bindCommon();}
function students(d){let list=[...(d.students||[])];if(sortNames)list.sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));return `<div class="row between"><h3>학생 ${d.studentCount}명 · 제출 ${d.submitted}명</h3><button id="sort" class="secondary">${sortNames?'이름·번호순':'접속순'}</button></div><div class="chips">${list.map(s=>`<button class="chip ${s.submitted?'done':''}" data-kick="${s.id}" title="클릭하면 내보내기">${esc(s.name)}${s.submitted?' ✓':''}</button>`).join('')||'<p class="subtle">학생을 기다리고 있어요.</p>'}</div>`;}
function bindStudents(){on('sort',()=>{sortNames=!sortNames;renderTeacher(state);bindCommon();});documentquerySelectorAll('[data-kick]').forEach(b=>b.onclick=busy(b,async()=>{if(confirm(b.textContent+' 학생을 이 방에서 내보낼까요?'))await action('kick',{id:b.dataset.kick});}));}
function answers(d){return `<div class="scroll"><table><thead><tr><th>학생</th><th>예측 가격</th><th>문장</th>${d.phase==='reveal'?'<th>점수</th>':''}</tr></thead><tbody>${(d.answers||[]).map(a=>`<tr><td>${esc(a.name)}</td><td>${won(a.value)}</td><td>${esc(a.prefix+' '+a.text)}</td>${d.phase==='reveal'?`<td>+${a.result?.points||0}${a.result?.perfect?' 🎯':''}</td>`:''}</tr>`).join('')||'<tr><td colspan="4">제출한 답안이 없습니다.</td></tr>'}</tbody></table></div>`;}

function renderTeacher(d){
  let html=header(d);
  if(d.phase==='lobby'){
    html+=`<div class="grid"><section class="card center"><div class="eyebrow">JOIN THE CLASS</div><h2>가격 탐험에 초대합니다</h2>${qrHTML()}<button id="copyLink" class="secondary">학생 주소 복사</button></section><section class="card">${students(d)}<div class="actions"><button id="start" class="green wide" ${d.studentCount?'':'disabled'}>첫 문제 시작 ▶</button></div><p class="subtle">문제의 그림은 교사 화면에만 나옵니다. TV·프로젝터로 보여 주세요.</p></section></div>`;
  }
  else if(d.phase==='question'){
    let q=d.question;
    html+=`<section class="card"><div class="row between"><h2>How much is it? / How much are they?</h2><span id="timer" class="timer"></span></div><div class="question-art">${q.image?`<img src="${esc(q.image)}" alt="${esc(q.name)}">`:`<div class="emoji" role="img" aria-label="${esc(q.name)}">${esc(q.emoji)}</div>`}</div><h3 class="center">${esc(q.name)}</h3><div class="row actions"><button id="close" class="green">답안 마감 ✋</button>${d.deadline?'<button id="extend" class="secondary">+15초</button>':''}</div>${students(d)}</section>`;
  }
  else if(d.phase==='closed'){
    let q=d.question;
    html+=`<div class="grid" style="grid-template-columns: 45% 53%; gap:2%;"><section class="card center"><div class="eyebrow">QUESTION</div><div class="question-art">${q.image?`<img src="${esc(q.image)}" alt="${esc(q.name)}">`:`<div class="emoji">${esc(q.emoji)}</div>`}</div><h3 style="margin-top:15px;">${esc(q.name)}</h3></section><section class="card"><div class="eyebrow">GUESSES ARE IN</div><h2>누가 가장 가까울까요?</h2><p class="subtle">싼 가격부터 정렬했어요.</p>${answers(d)}<div class="actions" style="margin-top:20px;"><button id="reveal" class="green wide">💰 가격 공개</button></div></section></div>`;
  }
  else if(d.phase==='reveal'){
    let q=d.question,displayImg=q.revealImage||q.image;
    html+=`<div class="grid" style="grid-template-columns: 45% 53%; gap:2%;"><section class="card center"><div class="eyebrow">REVEAL PHOTO</div><div class="question-art">${displayImg?`<img src="${esc(displayImg)}" alt="${esc(q.name)}">`:`<div class="emoji">${esc(q.emoji)}</div>`}</div><h3 style="margin-top:15px;">${esc(q.name)}</h3></section><section class="card center"><div class="eyebrow">THE REAL PRICE · 연습용 가격</div><div class="price" style="margin:10px 0;">${won(q.price)}</div><p class="sentence" style="margin-bottom:15px;">${esc(q.sentence)}</p><button id="speak" class="secondary" style="margin-bottom:15px;">🔊 정답 문장 듣기</button><div class="row actions" style="justify-content:center;margin-bottom:20px;">${d.round+1<d.total?'<button id="next" class="green">다음 문제 ▶</button>':''}<button id="finish" class="secondary">🏆 ${d.round+1<d.total?'여기서 마치고 ':''}시상식</button></div><hr style="border:0;border-top:1px solid #e0e9f0;margin:15px 0;"><div style="text-align:left;"><h3>모두의 예측 및 결과</h3>${answers(d)}</div></section></div>`;
  }
  else {
    html+=`<section class="card"><div class="eyebrow">CLASS CELEBRATION</div><h2>🏆 오늘의 가격 탐험가</h2>${(d.awards||[]).map(a=>`<div class="award"><strong>${esc(a.title)}</strong><br>${esc(a.names)}</div>`).join('')}<h3>최종 순위</h3>${ranking(d)}<div class="actions"><button id="csv" class="secondary">결과 CSV 저장</button></div><p class="subtle">끝났으면 방 삭제를 눌러 학생 기록을 지워 주세요.</p></section>`;
  }
  app.innerHTML=html;bindStudents();on('start',()=>action('start'));on('close',()=>action('close'));on('extend',()=>action('extend'));
  on('reveal', async () => {
    const btn = $('#reveal');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '🥁 두구두구두구...';
    }
    playDrumroll(2200);
    await new Promise(resolve => setTimeout(resolve, 2200));
    await action('reveal');
  });
  on('next',()=>action('next'));on('finish',()=>action('finish'));on('copyLink',async()=>{try{await navigator.clipboard.writeText(joinURL());status('학생 주소를 복사했습니다.',false);}catch{prompt('아래 주소를 복사하세요.',joinURL());}});on('speak',()=>speak(d.question.sentence));on('csv',()=>downloadCSV(d));
}

function keyboard(){return `<div class="keyboard" aria-label="영어 화면 키보드">${['qwertyuiop','asdfghjkl','zxcvbnm'].map(row=>`<div class="keyrow">${[...row].map(k=>`<button class="key" data-key="${k}" type="button">${k}</button>`).join('')}</div>`).join('')}<div class="keyrow"><button class="key widekey" data-key="clear">지우기</button><button class="key space" data-key=" ">space</button><button class="key widekey" data-key="back">⌫</button></div></div>`;}
function studentAnswer(d){let a=d.me.answer;if(a&&!editing)return `<div class="hero"><div class="badge">제출 완료 ✓</div><p class="sentence">${esc(a.prefix+' '+a.text)} won.</p><div class="big-number">${won(a.value)}</div><p>마감 전에는 답을 바꿀 수 있어요.</p><button id="edit" class="secondary">✏️ 고치기</button></div>`;return `<p class="subtle">TV의 그림을 보고 가격을 영어로 써 주세요.</p>${d.settings.sentence?`<div class="prefix"><button id="it" type="button">It is</button><button id="they" type="button">They are</button></div>`:''}<label for="answer">${d.settings.allowDigits?'가격 (영어 또는 숫자)':'가격 (영어 단어)'}</label><textarea id="answer" class="answer" readonly inputmode="none" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="none" placeholder="예: eleven thousand three hundred"></textarea><div class="row"><span class="pill">won.</span><button id="systemKeyboard" class="secondary">기기 키보드 사용</button><button id="mic" class="secondary">🎤 말해서 쓰기</button></div><div id="feedback" class="feedback" aria-live="polite"></div>${keyboard()}<button id="submit" class="green wide">답안 제출 ✓</button><p class="subtle">기본 화면 키보드는 자동 완성 없이 철자를 연습합니다.</p>`;}
function renderStudent(d){const changedRound=d.round!==draftRound;if(changedRound){draftRound=d.round;draft={text:d.me.answer?.text||'',prefix:d.me.answer?.prefix||''};editing=false;}let html=header(d);if(d.phase==='lobby')html+=`<section class="card narrow hero"><div class="emoji">🛍️</div><h2>준비됐어요!</h2><p>${esc(d.me.name)}, 선생님이 시작할 때까지 기다려 주세요.</p><p class="subtle">How much is it? · It is … won.</p></section>`;
 else if(d.phase==='question'){html+=`<section class="card narrow"><div class="row between"><h2>Guess the price!</h2><span id="timer" class="timer"></span></div><div id="answerArea">${studentAnswer(d)}</div></section>`;}
 else if(d.phase==='closed')html+=`<section class="card narrow hero"><div class="badge">답안 마감 ✋</div><p>TV 화면을 보세요. 진짜 가격은 얼마일까요?</p>${d.me.answer?`<p class="sentence">${esc(d.me.answer.prefix+' '+d.me.answer.text)} won.</p>`:'<p>이번 문제는 제출하지 않았어요. 다음 문제에 도전해요.</p>'}</section>`;
 else if(d.phase==='reveal'){let a=d.me.answer,res=a?.result;html+=`<section class="card narrow center"><div class="badge">${!res?'Next time!':res.perfect?'Perfect! 🎯':res.great?'Great! 🌟':'Good try! 💪'}</div><div class="price">${won(d.question.price)}</div><p class="sentence">${esc(d.question.sentence)}</p>${res?`<div class="muted-block"><p>내 예측: ${won(a.value)}</p><p>${res.difference?`${won(res.difference)} 차이 · 실제보다 ${res.direction==='high'?'비싸게':'싸게'} 예측했어요.`:'가격을 정확히 맞혔어요!'}</p>${d.settings.sentence?`<p>${res.grammar?'It is / They are 선택도 맞았어요!':'It is / They are 선택을 확인해 보세요.'}</p>`:''}<div class="big-number">+${res.points}점</div></div>`:'<p>제출한 답안이 없어요.</p>'}<p>누적 ${d.me.score}점 · 현재 ${d.me.rank}등</p><p class="subtle">다음 문제를 기다려 주세요.</p></section>`;}
 else html+=`<section class="card narrow center"><h2>🏆 Well done!</h2><div class="badge">${d.me.rank}등</div><div class="big-number">${d.me.score}점</div><p>가격을 영어로 말하는 연습을 마쳤어요.</p>${ranking(d)}</section>`;
 let old=changedRound?null:$('#answer'),selection=old?{start:old.selectionStart,end:old.selectionEnd,focus:document.activeElement===old,readonly:old.readOnly}:null;if(old)draft.text=old.value;
 app.innerHTML=html;if(d.phase==='question'){on('edit',()=>{editing=true;draft={text:d.me.answer.text,prefix:d.me.answer.prefix};renderStudent(state);bindCommon();});bindAnswer(d,selection);}}
function updateFeedback(){let field=$('#answer');if(!field)return;draft.text=field.value;$('#it')?.classList.toggle('selected',draft.prefix==='It is');$('#they')?.classList.toggle('selected',draft.prefix==='They are');let p=English.parse(draft.text,state.settings.allowDigits),f=$('#feedback');f.textContent=p.ok?'= '+won(p.value)+' ✓':p.error;f.classList.toggle('bad',!p.ok&&!!draft.text);$('#submit').disabled=!p.ok||(state.settings.sentence&&!draft.prefix);}
function bindAnswer(d,selection){let field=$('#answer');if(!field)return;field.value=draft.text;if(selection){field.readOnly=selection.readonly;field.inputMode=selection.readonly?'none':'text';if(selection.focus)field.focus();field.setSelectionRange(selection.start,selection.end);}on('it',()=>{draft.prefix='It is';updateFeedback();});on('they',()=>{draft.prefix='They are';updateFeedback();});field.oninput=()=>{if(field.value.length>160)field.value=field.value.slice(0,160);updateFeedback();};
 document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>e.preventDefault();b.onclick=()=>{let v=field.value,a=field.selectionStart,z=field.selectionEnd,k=b.dataset.key;if(k==='clear'){field.value='';a=0;}else if(k==='back'){if(a===z)a=Math.max(0,a-1);field.value=v.slice(0,a)+v.slice(z);}else{field.value=(v.slice(0,a)+k+v.slice(z)).slice(0,160);a+=k.length;}field.focus();field.setSelectionRange(a,a);updateFeedback();};});
 on('systemKeyboard',()=>{field.readOnly=!field.readOnly;field.inputMode=field.readOnly?'none':'text';$('#systemKeyboard').textContent=field.readOnly?'기기 키보드 사용':'화면 키보드만 사용';field.focus();});on('submit',async()=>{let submitted={...draft};await api('/api/submit',{code:session.code,round:state.round,...submitted});editing=false;status();lastView='';await poll();});on('mic',()=>{const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){status('이 브라우저에서는 음성인식을 지원하지 않아요. 화면 키보드를 사용하세요.');return;}if(!confirm('음성인식은 브라우저 제공 기능입니다. 목소리가 Google·Apple 등 브라우저 제공업체로 전송될 수 있습니다. 학교 지침을 확인했으며 사용할까요?'))return;const recog=new Speech();recog.lang='en-US';recog.interimResults=false;recog.onresult=e=>{let t=e.results[0][0].transcript.toLowerCase().replace(/[.!?]$/,'').replace(/^it is /,'').replace(/^they are /,'').replace(/ won$/,'');if(/^\d[\d,]*$/.test(t)){let n=Number(t.replace(/,/g,''));t=English.words(n)||t;}draft.text=t.slice(0,160);if($('#answer')){$('#answer').value=draft.text;updateFeedback();}};recog.onerror=()=>status('음성인식을 사용할 수 없어요. 화면 키보드로 입력하세요.');recog.start();});updateFeedback();}
function speak(text){if(!window.speechSynthesis){status('이 브라우저는 문장 읽기를 지원하지 않습니다.');return;}speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.85;speechSynthesis.speak(u);}
function downloadCSV(d){let cell=s=>'"'+String(s??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';let rows=[['순위','학생','점수','Perfect','문장 정답'],...d.ranking.map(s=>[s.rank,s.name,s.score,s.perfect,s.grammar])];let blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='price-class-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}

function editor(){
  let el=$('#editor');
  el.innerHTML=questions.map((q,i)=>`<div class="editor-item" data-i="${i}">
    <div class="row">
      <strong>${i+1}</strong>
      <input class="mini" data-field="emoji" value="${esc(q.emoji)}" aria-label="그림 이모지">
      <input class="name" data-field="name" value="${esc(q.name)}" aria-label="물건 이름">
      <input class="mini" data-field="price" type="number" min="1" max="999999" value="${q.price}" aria-label="가격">
      <label><input type="checkbox" data-field="plural" ${q.plural?'checked':''}> They are</label>
      <button class="danger" data-remove="${i}">삭제</button>
    </div>
    <div class="row" style="align-items:center;gap:12px;margin-top:8px;">
      <label style="margin:0;">1. 문제 사진 (가격 가려진 사진)
        <input type="file" data-image="${i}" accept="image/*">
      </label>
      ${q.image ? `<div class="row" style="align-items:center;"><img src="${esc(q.image)}" alt="문제 사진" style="height:60px;border-radius:8px;border:1px solid #ccc;"><button data-clear-image="${i}" class="secondary" style="min-height:36px;padding:6px 12px;">지우기</button></div>` : '<span class="subtle">(사진 없음)</span>'}
    </div>
    <div class="row" style="align-items:center;gap:12px;margin-top:8px;">
      <label style="margin:0;">2. 정답 사진 (가격 적힌 사진, 선택)
        <input type="file" data-reveal-image="${i}" accept="image/*">
      </label>
      ${q.revealImage ? `<div class="row" style="align-items:center;"><img src="${esc(q.revealImage)}" alt="정답 사진" style="height:60px;border-radius:8px;border:1px solid #ccc;"><button data-clear-reveal-image="${i}" class="secondary" style="min-height:36px;padding:6px 12px;">지우기</button></div>` : '<span class="subtle">(사진 없음)</span>'}
    </div>
  </div>`).join('');

  el.querySelectorAll('[data-field]').forEach(input=>input.oninput=()=>{let q=questions[Number(input.closest('[data-i]').dataset.i)],k=input.dataset.field;q[k]=k==='plural'?input.checked:k==='price'?Number(input.value):input.value;});
  el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{questions.splice(Number(b.dataset.remove),1);editor();});
  el.querySelectorAll('[data-clear-image]').forEach(b=>b.onclick=()=>{questions[Number(b.dataset.clearImage)].image='';editor();});
  el.querySelectorAll('[data-clear-reveal-image]').forEach(b=>b.onclick=()=>{questions[Number(b.dataset.clearRevealImage)].revealImage='';editor();});

  el.querySelectorAll('[data-image]').forEach(input=>input.onchange=async()=>{
    let f=input.files[0];
    if(!f)return;
    try{
      status('사진 처리 중...', false);
      let image=await compressImage(f);
      questions[Number(input.dataset.image)].image=image;
      status('사진 등록 완료!', false);
      editor();
    }catch(e){
      error(e);
    }
  });

  el.querySelectorAll('[data-reveal-image]').forEach(input=>input.onchange=async()=>{
    let f=input.files[0];
    if(!f)return;
    try{
      status('사진 처리 중...', false);
      let image=await compressImage(f);
      questions[Number(input.dataset.revealImage)].revealImage=image;
      status('정답 사진 등록 완료!', false);
      editor();
    }catch(e){
      error(e);
    }
  });

  $('#questionCount').textContent=questions.length+'문제';
}

async function compressImage(f){
  if(!f) throw Error('파일을 선택해 주세요.');
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(Error('파일을 읽지 못했어요.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(Error('이미지 파일을 읽을 수 없어요.'));
      img.onload = () => {
        try {
          let maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          let out = canvas.toDataURL('image/jpeg', 0.65);
          if (out.length > 160000) {
            out = canvas.toDataURL('image/jpeg', 0.35);
          }
          resolve(out);
        } catch (err) {
          reject(Error('사진 변환 중 오류가 발생했습니다.'));
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(f);
  });
}

function exportQuestions(){let blob=new Blob([JSON.stringify(questions,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='my-price-questions.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
async function setup(){app.innerHTML=`<section class="card narrow"><div class="eyebrow">TEACHER STUDIO</div><h2>우리 반 가격 맞히기</h2><p class="subtle">방 만들기 → 학생 입장 → 사진·그림 → 영어 답안 → 가격 공개 → 시상식</p><label>교사 비밀번호<input id="pin" type="password" autocomplete="current-password" placeholder="배포할 때 정한 TEACHER_PIN"></label><div class="grid"><label>문제당 제한 시간<select id="seconds">${[20,30,45,60,90,120,0].map(n=>`<option value="${n}" ${n===60?'selected':''}>${n?n+'초':'없음 · 직접 마감'}</option>`).join('')}</select></label><label>가격 입력<select id="digits"><option value="no">영어 단어로만</option><option value="yes">숫자도 허용</option></select></label></div><label><input id="sentence" type="checkbox" checked> It is / They are 고르기</label><label><input id="auto" type="checkbox" checked> 모두 제출하면 자동 마감</label><p class="muted-block">기본 20문제는 이모지 그림과 연습용 가격입니다. 원본 사이트의 상품 사진·판매가격을 복사하지 않았습니다. 아래에서 직접 사진과 가격을 바꿀 수 있어요.</p><button id="create" class="green wide">수업 방 만들기</button></section><section class="card"><details><summary>📦 문제 세트 편집 · <span id="questionCount">불러오는 중</span></summary><div class="row"><button id="add" class="secondary">문제 추가</button><button id="exportQ" class="secondary">내 문제 저장</button><label>내 문제 불러오기<input id="importQ" type="file" accept="application/json,.json"></label></div><p class="subtle">사진은 브라우저에서 축소 후 서버 메모리에 저장됩니다. 학생 얼굴·이름이 담긴 사진은 사용하지 마세요.</p><div id="editor"></div></details></section>`;
 try{if(!questions.length)questions=await api('/api/samples',null,'');editor();}catch(e){error(e);}
 on('add',()=>{if(questions.length>=40)throw Error('최대 40문제까지 가능합니다.');questions.push({emoji:'🛍️',name:'A bag',price:10000,plural:false,image:'',revealImage:''});editor();});on('exportQ',exportQuestions);$('#importQ').onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(f.size>7*1024*1024)throw Error('파일은 7MB 이하여야 합니다.');let q=JSON.parse(await f.text());if(!Array.isArray(q)||!q.length||q.length>40)throw Error('문제 배열(1~40개) 파일이 필요합니다.');questions=q.map(x=>({emoji:String(x.emoji||'🛍️').slice(0,10),name:String(x.name||''),price:Number(x.price),plural:!!x.plural,image:typeof x.image==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(x.image)?x.image:'',revealImage:typeof x.revealImage==='string'&&/^data:image\/(jpeg\vert{}png\vert{}webp);base64,[A-Za-z0-9+/]+=*$/.test(x.revealImage)?x.revealImage:''}));editor();}catch(e){error(e);}};
 on('create',async()=>{status();let s=await api('/api/create',{pin:$('#pin').value,questions,settings:{seconds:Number($('#seconds').value),allowDigits:$('#digits').value==='yes',sentence:$('#sentence').checked,autoClose:$('#auto').checked}},'');adopt(s);});}
function joinForm(){let initial=new URLSearchParams(location.search).get('room')||'';app.innerHTML=`<section class="card narrow"><div class="hero"><div class="eyebrow">GUESS • WRITE • SPEAK</div><h2>가격 탐험에 참여하기</h2><div class="big-number">🛍️ 🧃 🎈</div></div><form id="joinForm" class="stack"><label>방 번호<input id="room" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" value="${esc(initial)}" placeholder="선생님 화면의 6자리" required></label><label>번호 또는 별명<input id="name" maxlength="18" autocomplete="off" placeholder="예: 12번 또는 Bluebird" required></label><button id="joinBtn" class="green wide" type="submit">입장하기 →</button></form><p class="subtle">실명 대신 번호·별명을 쓰세요. 가입·학생 비밀번호는 필요 없습니다.</p><p class="subtle">기록은 방 삭제·서버 재시작 시 삭제되며, 교사가 90분간 진행하지 않으면 방이 만료됩니다. 음성인식은 선택 기능입니다.</p><a href="/tv">선생님 화면 열기</a></section>`;
 $('#joinForm').onsubmit=async e=>{e.preventDefault();let b=$('#joinBtn');b.disabled=true;try{let code=$('#room').value.trim(),prev=read('price.student.'+code);let s=await api('/api/join',{code,name:$('#name').value,key:prev?.key},'');status();adopt(s);}catch(e){error(e);}finally{if(b.isConnected)b.disabled=false;}};}
function init(){if(teacher){let stored=read('price.teacher',sessionStorage);if(stored){adopt(stored);return;}setup();}else{let code=new URLSearchParams(location.search).get('room');let stored=code&&read('price.student.'+code);if(stored){adopt(stored);return;}joinForm();}}
setInterval(poll,1100);setInterval(timer,200);window.addEventListener('online',()=>{lastView='';poll();});init();

function playDrumroll(durationMs = 2200) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = durationMs / 1000;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const pulseRate = 18;

    for (let t = 0; t < duration; t += 1 / pulseRate) {
      const pTime = now + t;
      gain.gain.setValueAtTime(0.6, pTime);
      gain.gain.exponentialRampToValueAtTime(0.01, pTime + (1 / pulseRate) * 0.85);
    }

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    setTimeout(() => {
      try {
        const osc = ctx.createOscillator();
        const hitGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);

        hitGain.gain.setValueAtTime(1.0, ctx.currentTime);
        hitGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(hitGain);
        hitGain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } catch (e) {}
    }, durationMs);
  } catch (e) {}
}
