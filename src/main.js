import './style.css';
import './theme.css';
import { PRESETS, clone, initialState, item, world, setWorld, attach, removeItem, width, depth, humanSize, cm, issues, margins, validate } from './model.js';
import {createProject,validateProject,switchLayout,copyLayout} from './project.js';
import {readPosterImage} from './images.js';
import {projectionShape} from './projection.js';
import { BoothScene } from './scene.js';
import {canToggleStand,hasStand,setDisplayStand} from './display.js';
import {mountPoster} from './model.js';

const icons={
  poster:'<rect x="4" y="2" width="16" height="20" rx="1"/><circle cx="9" cy="8" r="2"/><path d="m5 18 5-5 3 3 3-5 3 7"/>',
  tv:'<rect x="2" y="3" width="20" height="15" rx="1"/><path d="m7 18-2 4m12-4 2 4"/>',
  table:'<path d="M3 8h18v3H3zM5 11v9m14-9v9"/>',
  imac:'<rect x="3" y="3" width="18" height="13" rx="1.5"/><path d="M9 21h6m-3-5v5M3 13h18"/>',
  monitor:'<rect x="2" y="4" width="20" height="13" rx="1"/><path d="M8 21h8m-4-4v4"/>',
  projector:'<rect x="2" y="7" width="20" height="12" rx="3"/><circle cx="16" cy="13" r="3"/><path d="M5 11h4m-4 3h4M6 19v2m12-2v2"/>',
  box:'<path d="m12 2 10 5v10l-10 5-10-5V7l10-5Zm0 10v10M2 7l10 5 10-5M7 4.5l10 5"/>',
  human:'<circle cx="12" cy="4" r="2"/><path d="M8 22v-7L6 9h12l-2 6v7M12 14v8M8 9v5m8-5v5"/>',
  undo:'<path d="M9 5 3 11l6 6M3 11h11a6 6 0 0 1 6 6"/>',
  redo:'<path d="m15 5 6 6-6 6m6-6H10a6 6 0 0 0-6 6"/>',
  save:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  open:'<path d="M3 8V4h7l3 4h8v12H3z"/>',
  camera:'<path d="m8 6 2-3h4l2 3h5v15H3V6z"/><circle cx="12" cy="13" r="4"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  focus:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6"/>',
  rotate:'<path d="M20 8a9 9 0 1 0 1 7M20 3v6h-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v2"/>',
};
const icon=(name)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.box}</svg>`;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='hicd-booth-v1';
let project=createProject(),state=project.layouts.A,loadWarning='';
try {const saved=localStorage.getItem(STORAGE);if(saved){project=validateProject(JSON.parse(saved));state=project.layouts[project.active];}} catch {loadWarning='이전 배치를 읽지 못해 예시 장면을 열었습니다. 저장한 JSON 파일을 불러올 수 있어요.';}
let selected=null,tab='add',preset='table',history=[],future=[],dragBefore=null,noticeTimer,saveFailed=false;
let draft={...PRESETS.table};
function snapshot(){project.layouts[project.active]=state;return clone(project);}
function restore(next){project=next;state=project.layouts[project.active];}

document.querySelector('#app').innerHTML=`
  <header class="header">
    <div class="brand-mark">${icon('box')}</div>
    <div class="brand"><span class="eyebrow">HONGIK DESIGN CONVERGENCE · 2026</span><h1>부스 스케일 테스트<span class="version">BETA 01</span></h1></div>
    <div class="header-actions"><button class="icon-btn" data-action="undo" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소">${icon('undo')}</button><button class="icon-btn" data-action="redo" title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행">${icon('redo')}</button><span class="divider"></span><button data-action="load" aria-label="불러오기">${icon('open')}<span>불러오기</span></button><button data-action="save" aria-label="배치 저장">${icon('save')}<span>배치 저장</span></button><button class="dark" data-action="png" aria-label="이미지 내보내기">${icon('camera')}<span>이미지 내보내기</span></button></div>
  </header>
  <main class="workspace">
    <section class="work-area" aria-label="3D 부스 작업 영역">
      <div class="project-bar"><div><div class="segmented layout-toggle" aria-label="배치 비교"><button data-layout="A">A안</button><button data-layout="B">B안</button></div><button class="copy-layout" data-action="copy-layout" title="현재 안을 다른 안에 복사">${icon('copy')}<span id="copy-layout-label">A → B</span></button><input id="project-name" aria-label="배치 이름" maxlength="80" value="${esc(state.name)}"/><span id="save-status" class="save-status">브라우저에 저장됨</span></div><button class="text-button" data-action="help">${icon('info')} 사용 안내</button></div>
      <div class="viewport-wrap"><div id="viewport"></div>
        <div class="booth-card"><div class="eyebrow">부스 규격</div><div class="segmented booth-toggle"><button data-booth="personal">개인</button><button data-booth="team">팀</button></div><div class="segmented discipline-toggle" aria-label="전시 분야"><button data-discipline="interaction">인터랙션</button><button data-discipline="general">비인터랙션</button></div><div id="booth-size" class="booth-size"></div><div class="booth-note">안쪽 유효 공간 · 가벽 <span id="wall-cm">4</span>cm</div></div>
        <div class="view-controls" aria-label="카메라 보기"><button data-view="3d" class="active">3D</button><button data-view="top">위</button><button data-view="front">앞</button><button data-view="side">옆</button><span></span><button data-action="fit" title="전체 보기" aria-label="전체 보기">${icon('focus')}</button></div>
        <button class="neighbor-toggle" data-action="neighbors" aria-pressed="false" title="양옆에 인터랙션 개인 부스 3개씩 표시">${icon('copy')}<span>부스 복제 배치</span><i aria-hidden="true"></i></button><div class="segmented lighting-controls" aria-label="조명 환경"><button data-lighting="bright">밝음</button><button data-lighting="dark">암실</button></div><div class="scene-caption"><span class="small-dot"></span>실제 치수에 맞춘 3D 공간<span class="caption-secondary">1칸 = 10cm</span></div>
        <div class="viewport-tools"><button data-action="grid">격자</button><button data-action="dimensions">치수</button><button data-action="ghost">가벽 투명</button><span class="tool-divider" aria-hidden="true"></span><button data-wall-toggle="left" aria-pressed="false" title="왼쪽 가벽 표시 / 숨기기">왼쪽 벽</button><button data-wall-toggle="right" aria-pressed="false" title="오른쪽 가벽 표시 / 숨기기">오른쪽 벽</button><label>이동 간격 <select id="snap" aria-label="이동 간격"><option value="0">자유</option><option value="0.01">1cm</option><option value="0.05">5cm</option><option value="0.1">10cm</option></select></label></div>
        <div class="scene-hint">물체 드래그로 이동 <span>·</span> 빈 공간 드래그로 회전 <span>·</span> 휠로 확대</div>
      </div>
      <footer class="statusbar"><button id="review-status" data-action="review"></button><span id="object-count"></span><span class="scale-note">화면 표시는 실물 1:1 크기가 아닙니다</span></footer>
    </section>
    <aside class="sidebar"><div class="sidebar-top"><h2>부스 배치</h2><p>집기 치수 · 위치 · 관람객 비교</p></div><nav class="tabs"><button data-tab="add">집기 추가</button><button data-tab="selected">선택 항목</button><button data-tab="scene">장면 <span id="list-count"></span></button></nav><div id="panel" class="panel"></div><div class="sidebar-foot"><span class="small-dot"></span> 디자인컨버전스 2026 졸업전시/C275147 한상헌</div></aside>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <input type="file" id="poster-input" accept="image/png,image/jpeg,image/webp" hidden /><dialog id="copy-dialog"><h2>다른 안에 현재 배치를 복사할까요?</h2><p>다른 안의 내용이 현재 안으로 바뀝니다. 실행 취소로 복구할 수 있습니다.</p><div class="button-row"><button data-action="close-copy">취소</button><button class="primary" data-action="confirm-copy">복사하기</button></div></dialog><input type="file" id="file-input" accept=".json,application/json" hidden />
  <dialog id="help-dialog"><div class="dialog-heading"><span class="eyebrow">QUICK GUIDE</span><h2>사용 안내</h2></div><p>개인 / 팀과 인터랙션 / 비인터랙션을 선택하고, 오른쪽에서 치수를 입력해 집기를 추가하세요. 프리셋 치수는 예시이므로 사용할 제품의 외형 치수로 바꿔주세요.</p><dl><dt>이동</dt><dd>집기를 드래그하거나 선택 항목의 위치를 입력합니다. 앞·옆 보기에서는 높이도 드래그할 수 있습니다.</dd><dt>테이블 위 배치</dt><dd>장비를 선택하고 ‘배치 기준면’에서 테이블을 지정하세요. 테이블을 움직이면 장비도 따라갑니다.</dd><dt>크기 확인</dt><dd>위·앞·옆 보기는 원근이 없는 직교 뷰입니다. 사람의 키를 바꿔 높이와 공간감을 비교하세요.</dd><dt>단축키</dt><dd>Ctrl+Z 실행 취소 · Ctrl+Shift+Z 다시 실행 · Ctrl+D 복제 · Delete 삭제 · Esc 선택 해제</dd></dl><p class="muted">가벽 두께는 임의값 4cm이며 바닥 크기 바깥쪽에 설치됩니다. 주황 표시와 겹침 검토는 개략적인 형상 기준입니다. 포스터는 벽을 선택해 이미지를 넣습니다. A/B로 두 배치를 비교하고, 암실로 발광 효과를 볼 수 있습니다. 투사 범위는 입력한 거리·투사비에 따른 가상 화면이며 실제 밝기나 장애물 가림을 계산하지 않습니다.</p><button class="primary full" data-action="close-help">시작하기</button></dialog>
  <dialog id="reset-dialog"><h2>빈 부스로 시작할까요?</h2><p>현재 집기를 모두 지웁니다. 실행 취소로 복구할 수 있고, 먼저 배치 파일을 저장해둘 수도 있어요.</p><div class="button-row"><button data-action="close-reset">취소</button><button class="danger" data-action="confirm-reset">빈 부스 만들기</button></div></dialog>
  <dialog id="export-dialog"><span class="eyebrow">EXPORT PREVIEW</span><h2>배치 이미지가 준비됐어요.</h2><img id="export-preview" alt="현재 부스 배치와 치수가 포함된 내보내기 이미지"/><div class="button-row"><button data-action="close-export">닫기</button><a id="export-download" class="primary" download>PNG 다운로드</a></div><p class="hint">앱 안에서 다운로드가 되지 않으면 Chrome 또는 Edge에서 같은 주소를 열어 저장해주세요.</p></dialog>`;

const $=s=>document.querySelector(s);
let scene;
try {
  scene=new BoothScene($('#viewport'),{
    select:id=>{selected=id;tab='selected';render();},
    startDrag:()=>{dragBefore=snapshot();},
    move:(id,position)=>{const o=state.items.find(o=>o.id===id);if(o){setWorld(o,state,position);render();}},
    endDrag:cancel=>{
      if(dragBefore){if(cancel)restore(dragBefore);else if(JSON.stringify(dragBefore)!==JSON.stringify(snapshot())){history.push(dragBefore);history=history.slice(-40);future=[];saveLocal();}dragBefore=null;render();}
    },
  });
} catch(error) {$('#viewport').innerHTML='<div class="webgl-error"><h2>3D 화면을 시작하지 못했어요.</h2><p>Chrome 또는 Edge의 그래픽 가속을 켜고 다시 열어주세요.</p></div>';console.error(error);}

function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function saveLocal(){try{localStorage.setItem(STORAGE,JSON.stringify(snapshot()));saveFailed=false;}catch{saveFailed=true;notify('브라우저 저장에 실패했습니다. 배치 저장 버튼으로 JSON 파일을 보관해주세요.');}}
function commit(fn){const before=snapshot();try{fn();validateProject(snapshot());}catch(e){restore(before);notify(e.message);render();return false;}if(JSON.stringify(before)!==JSON.stringify(snapshot())){history.push(before);history=history.slice(-40);future=[];saveLocal();}render();return true;}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());saveLocal();render();}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());saveLocal();render();}
function selectedItem(){return state.items.find(o=>o.id===selected);}
function number(label,value,attrs=''){return `<label class="field"><span>${label}</span><div class="number-wrap"><input type="number" value="${value}" step="0.1" ${attrs}/><span>cm</span></div></label>`;}
let panelKey='';
function updatePanel(html){
  const key=`${project.active}:${tab}:${selected}:${preset}`;
  const panel=$('#panel');
  if(key!==panelKey){panel.innerHTML=html;panelKey=key;return;}
  const template=document.createElement('template');template.innerHTML=html;
  // Preserve controls during property edits so a blur does not swallow the next click.
  const morph=(old,fresh)=>{
    if(!old||old.nodeType!==fresh.nodeType||old.nodeName!==fresh.nodeName){old?.replaceWith(fresh.cloneNode(true));return;}
    if(old.nodeType===Node.TEXT_NODE){if(old.textContent!==fresh.textContent)old.textContent=fresh.textContent;return;}
    if(old.nodeType!==Node.ELEMENT_NODE)return;
    for(const a of [...old.attributes])if(!fresh.hasAttribute(a.name))old.removeAttribute(a.name);
    for(const a of fresh.attributes)if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
    const previous=[...old.childNodes],next=[...fresh.childNodes];
    for(let i=0;i<Math.max(previous.length,next.length);i++){
      if(!next[i])previous[i]?.remove();else if(!previous[i])old.append(next[i].cloneNode(true));else morph(previous[i],next[i]);
    }
    if(old instanceof HTMLInputElement){if(document.activeElement!==old)old.value=fresh.value;old.checked=fresh.checked;}
    if(old instanceof HTMLSelectElement)old.value=fresh.value;
  };
  const shell=document.createElement('div');shell.append(template.content);morph(panel,shell);panel.id='panel';panel.className='panel';
}
function render(){
  if(selected&&!selectedItem())selected=null;
  const problems=issues(state);
  document.querySelectorAll('[data-layout]').forEach(el=>{const active=el.dataset.layout===project.active;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('#copy-layout-label').textContent=project.active==='A'?'A → B':'B → A';
  document.querySelectorAll('[data-lighting]').forEach(el=>{const active=el.dataset.lighting===state.options.lighting;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('.viewport-wrap').classList.toggle('dark-room',state.options.lighting==='dark');
  document.documentElement.dataset.theme=state.options.lighting==='dark'?'dark':'light';
  $('[data-action=neighbors]').classList.toggle('active',state.options.neighbors);
  $('[data-action=neighbors]').setAttribute('aria-pressed',state.options.neighbors);
  $('[data-action=neighbors]').title='양옆에 인터랙션 개인 부스 3개씩 표시 · 전체 보기로 넓게 확인';
  scene?.sync(state,selected,problems);
  document.querySelectorAll('[data-booth]').forEach(el=>{el.classList.toggle('active',el.dataset.booth===state.booth);el.setAttribute('aria-pressed',el.dataset.booth===state.booth);});
  document.querySelectorAll('[data-tab]').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab);el.setAttribute('aria-pressed',el.dataset.tab===tab);});
  $('#booth-size').innerHTML=`<strong>${cm(width(state))}</strong><span>×</span><strong>${cm(depth(state))}</strong><span>×</span><strong>200</strong><small>cm</small>`;
  document.querySelectorAll('[data-discipline]').forEach(el=>{const active=el.dataset.discipline===state.discipline;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('#wall-cm').textContent=cm(state.walls.thickness);
  $('#list-count').textContent=state.items.length;
  $('#object-count').textContent=`집기 ${state.items.filter(o=>o.type!=='human').length}개 · 사람 ${state.items.filter(o=>o.type==='human').length}명`;
  $('#save-status').textContent=saveFailed?'파일 저장 필요':'브라우저에 저장됨';
  $('#review-status').innerHTML=problems.length?`<span class="warning-dot"></span> 배치 검토 ${problems.length}건 <span>↗</span>`:`${icon('check')} 배치 검토 · 특이 사항 없음`;
  $('#review-status').classList.toggle('warning',!!problems.length);
  $('[data-action="undo"]').disabled=!history.length;$('[data-action="redo"]').disabled=!future.length;
  for(const key of ['grid','dimensions'])$(`[data-action="${key}"]`).classList.toggle('active',state.options[key]);
  $('[data-action="ghost"]').classList.toggle('active',state.walls.ghost);
  $('[data-action="ghost"]').setAttribute('aria-pressed',state.walls.ghost);
  document.querySelectorAll('[data-wall-toggle]').forEach(el=>{const active=state.walls[el.dataset.wallToggle];el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);});
  $('#snap').value=state.options.snap;
  if(document.activeElement!==$('#project-name'))$('#project-name').value=state.name;
  updatePanel(tab==='add'?addPanel():tab==='selected'?selectionPanel(problems):scenePanel(problems));
}
function addPanel(){return `
  <div class="section-label"><span>01 / 집기 선택</span><span>${Object.keys(PRESETS).length} TYPES</span></div>
  <div class="preset-grid">${Object.entries(PRESETS).map(([key,p])=>`<button class="preset ${key===preset?'active':''}" data-preset="${key}" aria-pressed="${key===preset}"><div class="preset-icon">${icon(key)}</div><strong>${p.label}</strong><small>${p.subtitle}</small></button>`).join('')}</div>
  <div class="section-label spacing"><span>02 / 실제 치수 입력</span><span>cm</span></div>
  <div class="fields ${preset==='human'?'one':preset==='poster'?'two':'three'}">${preset==='human'?number('키',cm(draft.h),'data-draft="h" min="1" max="1000" aria-label="추가할 사람 키"'):(preset==='poster'?['w','h']:['w','d','h']).map((k,i)=>number({w:'가로',d:'깊이',h:'높이'}[k],cm(draft[k]),`data-draft="${k}" min="0.1" max="1000" aria-label="추가할 ${{w:'가로',d:'깊이',h:'높이'}[k]}"`)).join('')}</div>
  <p class="hint">${preset==='human'?'키에 비례한 단순 픽토그램으로 표현해요.':['imac','monitor','tv'].includes(preset)?'받침대를 포함한 전체 외형 치수를 입력하세요.':preset==='projector'?'추가 후 거리·투사비·각도를 조절하세요.':'프리셋은 예시 치수입니다. 실측값으로 수정하세요.'}</p>
  <button class="primary full add-button" data-action="add">${icon('plus')} ${PRESETS[preset].label} 추가하기</button>
  ${preset==='poster'?'<p class="hint">추가 후 이미지와 부착할 벽을 선택하세요.</p>':''}<p class="hint spacing">사람을 추가하면 키와 화면 높이를 비교할 수 있습니다.</p>
`;}
function selectionPanel(problems){
  const o=selectedItem();if(!o)return `<div class="empty-state">${icon('focus')}<h3>집기를 선택해주세요.</h3><p>3D 화면이나 장면 목록에서 선택하면<br/>치수와 위치를 조정할 수 있어요.</p><button data-tab="add">집기 추가하기</button></div>`;
  const p=world(o,state),m=margins(o,state),warnings=problems.filter(i=>i.ids.includes(o.id));
  const dis=o.locked?'disabled':'';
  return `<div class="selected-heading"><div class="item-badge">${icon(o.type)}</div><div><span class="eyebrow">${PRESETS[o.type].label}</span><strong>${esc(o.name)}</strong></div><button class="icon-btn" data-action="focus" title="선택 항목에 시점 맞추기" aria-label="선택 항목에 시점 맞추기">${icon('focus')}</button></div>
  <label class="field"><span>이름</span><input data-prop="name" value="${esc(o.name)}" maxlength="80" ${dis}/></label>
  <div class="section-label spacing"><span>외형 치수</span><span>cm</span></div><div class="fields ${o.type==='human'?'one':o.type==='poster'?'two':'three'}">${o.type==='human'?number('키',cm(o.h),`data-prop="h" min="1" max="1000" ${dis}`):(o.type==='poster'?['w','h']:['w','d','h']).map((k,i)=>number({w:'가로',d:'깊이',h:'높이'}[k],cm(o[k]),`data-prop="${k}" min="0.1" max="1000" ${dis}`)).join('')}</div>
  ${canToggleStand(o)?`<label class="check-field spacing-sm"><input type="checkbox" data-stand="enabled" ${hasStand(o)?'checked':''} ${dis}/>받침 표시</label><p class="hint">${hasStand(o)?'받침을 포함한 전체 치수입니다.':'받침을 제외한 본체 치수입니다.'} 받침을 바꾸면 화면 크기는 유지하고 높이·깊이를 환산합니다. 실제 치수로 수정하세요.</p>`:''}
  ${extraPanel(o,dis)}
  ${o.type==='table'?`<div class="spacing-sm">${number('상판 두께',cm(o.thickness),`data-prop="thickness" min="0.1" max="${cm(o.h)-.1}" ${dis}`)}</div>`:''}
  ${!['table','human','poster'].includes(o.type)?`<label class="field spacing"><span>배치 기준면</span><select data-prop="support" ${dis}><option value="" ${!o.support?'selected':''}>바닥 / 직접 높이</option>${state.items.filter(t=>t.type==='table').map(t=>`<option value="${esc(t.id)}" ${o.support===t.id?'selected':''}>${esc(t.name)} 상판 · ${cm(t.y+t.h)}cm</option>`).join('')}</select></label>`:''}
  <div class="section-label spacing"><span>위치 · 부스 중앙 기준</span><span>cm</span></div><div class="fields three">${(o.type==='poster'?['x','y']:['x','z','y']).map((k,i)=>number(o.type==='poster'?{x:'벽 가로 위치',y:'설치 높이'}[k]:{x:'좌우',z:'앞뒤',y:'바닥 높이'}[k],cm(o.type==='poster'?o[k]:p[k]),`${o.type==='poster'?'data-poster-position':'data-position'}="${k}" min="${k==='y'?0:-2000}" max="${k==='y'?1000:2000}" ${o.support&&k==='y'?'disabled':dis}`)).join('')}</div>
  <p class="hint">${o.type==='poster'?'벽 가로 위치는 선택한 벽의 중앙 기준, 설치 높이는 포스터 하단 기준입니다.':'+좌우는 오른쪽, +앞뒤는 관람 방향입니다.'}${o.support?' 테이블을 움직이면 함께 이동해요.':''}</p>
  <div class="fields two"><label class="field"><span>회전 (°)</span><input ${o.type==='poster'?'disabled':''} type="number" data-prop="rotation" value="${Math.round(p.rotation*10)/10}" step="${state.options.rotationSnap||1}" ${dis}/></label><label class="field"><span>색상</span><input type="color" data-prop="color" value="${o.color}" ${dis}/></label></div>
  <div class="button-row spacing-sm"><button data-action="rotate" ${o.type==='poster'?'disabled':dis}>${icon('rotate')} 90° 회전</button><button data-action="ground" ${dis}>바닥에 놓기</button></div>
  ${o.type!=='human'?`<div class="clearance"><div class="section-label"><span>부스 경계까지 여유</span><span>cm</span></div><div class="clearance-grid">${Object.entries(m).map(([key,val])=>`<div class="${val<-.001?'negative':''}"><span>${{left:'왼쪽',right:'오른쪽',back:'뒤쪽',front:'앞쪽'}[key]}</span><strong>${cm(val)}</strong></div>`).join('')}</div><p>축 방향 외곽 기준 · 음수는 부스 밖</p></div>`:''}
  ${warnings.length?`<div class="warning-card">${warnings.map(i=>`<p>${esc(i.text)}</p>`).join('')}</div>`:''}
  <div class="button-row spacing"><button data-action="duplicate">${icon('copy')} 복제</button><button data-action="lock">${icon('lock')} ${o.locked?'잠금 해제':'잠금'}</button><button class="danger-text" data-action="delete" ${dis} aria-label="선택 항목 삭제">${icon('trash')}</button></div>`;
}
function extraPanel(o,dis){
  if(o.type==='poster')return `<div class="feature-card spacing"><div class="section-label">부착할 벽</div><div class="segmented poster-wall-controls" aria-label="포스터 부착 벽">${['back','left','right'].map(k=>`<button data-poster-wall="${k}" class="${o.mount===k?'active':''}" aria-pressed="${o.mount===k}" ${dis}>${{back:'뒤쪽 벽',left:'왼쪽 벽',right:'오른쪽 벽'}[k]}</button>`).join('')}</div><p class="hint">벽을 선택하면 해당 가벽도 켜집니다. 벽을 향해 바라보는 기준으로 가로 위치를 조절하세요.</p><div class="section-label spacing-sm">포스터 이미지</div>${o.image?`<img class="poster-preview" src="${o.image}" alt="포스터 이미지 미리보기"/>`:'<p class="hint">이미지를 넣으면 벽에 표시됩니다.</p>'}<div class="button-row spacing-sm"><button data-action="poster-image" ${dis}>이미지 선택</button><button data-action="poster-clear" ${dis}>이미지 제거</button></div><button class="full spacing-sm" data-action="poster-fit" ${dis}>이미지 비율로 높이 맞춤</button><p class="hint">PNG · JPG · WebP, 최대 10MB. 압축한 이미지가 배치 파일에 포함됩니다. 벽을 끄면 포스터도 숨겨집니다.</p></div>`;
  if(o.type==='projector'){
    const q=o.projection,shape=projectionShape(o);
    return `<div class="feature-card spacing"><div class="section-label">프로젝터 투사 범위</div><label class="check-field"><input type="checkbox" data-projection="enabled" ${q.enabled?'checked':''} ${dis}/>투사 켜기</label><div class="fields two spacing-sm">${number('투사 거리',cm(q.distance),`data-projection="distance" min="10" max="1000" ${dis}`)}<label class="field"><span>투사비 (거리 ÷ 가로)</span><input type="number" data-projection="ratio" value="${q.ratio}" min="0.2" max="4" step="0.01" ${dis}/></label></div><label class="field spacing-sm"><span>화면 비율</span><select data-projection="aspect" ${dis}>${['16:9','4:3','1:1'].map(v=>`<option ${q.aspect===v?'selected':''}>${v}</option>`).join('')}</select></label><div class="fields two spacing-sm"><label class="field"><span>상하 각도 (°)</span><input type="number" data-projection="pitch" value="${q.pitch}" min="-60" max="60" step="1" ${dis}/></label><label class="field"><span>세로 이동 (화면 높이 배수)</span><input type="number" data-projection="shift" value="${q.shift}" min="-1" max="1" step="0.05" ${dis}/></label></div><label class="field spacing-sm"><span>발광 강도 (0–2)</span><input type="number" data-projection="brightness" value="${q.brightness}" min="0" max="2" step="0.1" ${dis}/></label><label class="field spacing-sm"><span>투사 빛 색</span><input type="color" data-projection="color" value="${q.color||'#b6dcff'}" ${dis}/></label><div class="projection-size">투사 화면 ${cm(shape.width)} × ${cm(shape.height)} cm</div><button class="full" data-action="project-back" ${dis}>뒤 벽에 맞추기</button><p class="hint">좌우 방향은 본체 회전으로 조절합니다. 설정 거리의 가상 화면이며 가림·초점·실제 밝기는 계산하지 않습니다. 벽 맞춤 후 이동하면 거리를 다시 맞춰주세요.</p></div>`;
  }
  if(o.screen)return `<div class="feature-card spacing"><div class="section-label">화면 발광</div><label class="check-field"><input type="checkbox" data-screen="enabled" ${o.screen.enabled?'checked':''} ${dis}/>화면 켜기</label><label class="field spacing-sm"><span>발광 강도 (0–2)</span><input type="number" data-screen="brightness" value="${o.screen.brightness}" min="0" max="2" step="0.1" ${dis}/></label><p class="hint">암실에서 화면과 주변의 빛을 비교합니다.</p></div>`;
  return '';
}
function scenePanel(problems){return `
  <div class="section-label"><span>가벽 설정</span><span>높이 200cm</span></div>
  <div class="wall-options">${['back','left','right'].map(k=>`<label><input type="checkbox" data-wall="${k}" ${state.walls[k]?'checked':''}/>${{back:'뒤쪽',left:'왼쪽',right:'오른쪽'}[k]}</label>`).join('')}</div>
  ${number('가벽 두께',cm(state.walls.thickness),'data-wall="thickness" min="1" max="15" aria-label="가벽 두께"')}
  <p class="hint">가벽은 부스 바닥 바깥쪽에 설치돼요.<br/>기본 4cm는 임의값이며 실제 규격과 다를 수 있어요.</p>
  <div class="section-label spacing"><span>회전 스냅</span></div><select id="rotation-snap" aria-label="회전 스냅">${[0,15,45,90].map(n=>`<option value="${n}" ${state.options.rotationSnap===n?'selected':''}>${n?n+'°':'자유'}</option>`).join('')}</select>
  <div class="section-label spacing"><span>배치 목록</span><span>${state.items.length} ITEMS</span></div>
  <div class="object-list">${state.items.map(o=>`<div class="object-row ${o.hidden?'is-hidden':''}"><button class="object-select" data-select="${esc(o.id)}">${icon(o.type)}<span>${esc(o.name)}<small>${o.type==='human'?cm(o.h)+'cm':`${cm(o.w)} × ${cm(o.d)} × ${cm(o.h)}cm`}${o.support?' · 상판 위':''}</small></span></button><button class="icon-btn ${o.locked?'active':''}" data-lock="${esc(o.id)}" aria-label="${esc(o.name)} ${o.locked?'잠금 해제':'잠금'}">${icon('lock')}</button><button class="icon-btn ${o.hidden?'':'active'}" data-hide="${esc(o.id)}" aria-label="${esc(o.name)} ${o.hidden?'표시':'숨기기'}">${icon('eye')}</button></div>`).join('')||'<p class="hint">오른쪽 집기 추가 탭에서 시작하세요.</p>'}</div>
  <div class="section-label spacing" id="review-heading"><span>배치 검토</span><span>${problems.length?problems.length+'건':'CLEAR'}</span></div>
  ${problems.length?`<div class="issue-list">${problems.map(i=>`<button data-issue="${esc(i.ids[0])}"><span class="warning-dot"></span>${esc(i.text)}<span>↗</span></button>`).join('')}</div>`:'<div class="clear-message">현재 배치에서 특이 사항이 없어요.</div>'}
  <p class="hint">단순 형상 기준의 검토입니다. 숨긴 집기도 포함돼요. 실제 설치·동선은 현장에서 확인해주세요.</p>
  <button class="full spacing" data-action="reset">빈 부스로 새로 시작</button>`;}

function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function filename(){return state.name.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,70)||'부스배치';}
function duplicate(){const o=selectedItem();if(!o)return;if(state.items.length>=100)return notify('한 배치에 최대 100개까지 추가할 수 있어요.');commit(()=>{const copy=clone(o);copy.id=crypto.randomUUID();copy.name=(o.name+' 복사').slice(0,80);copy.locked=false;copy.x+=.1;if(copy.type!=='poster')copy.z+=.1;state.items.push(copy);selected=copy.id;});}
async function action(name){
  const o=selectedItem();
  if(name==='undo')return undo();if(name==='redo')return redo();
  if(name==='copy-layout'){if(project.layouts[project.active==='A'?'B':'A'])return $('#copy-dialog').showModal();return commit(()=>{copyLayout(project);notify('현재 배치를 다른 안에 복사했습니다.');});}
  if(name==='close-copy')return $('#copy-dialog').close();
  if(name==='confirm-copy'){$('#copy-dialog').close();return commit(()=>{copyLayout(project);notify('복사했습니다. 실행 취소로 복구할 수 있습니다.');});}
  if(name==='help')return $('#help-dialog').showModal();if(name==='close-help')return $('#help-dialog').close();
  if(name==='close-export')return $('#export-dialog').close();
  if(name==='reset')return $('#reset-dialog').showModal();if(name==='close-reset')return $('#reset-dialog').close();
  if(name==='confirm-reset'){$('#reset-dialog').close();return commit(()=>{state.items=[];selected=null;tab='add';});}
  if(name==='add'){
    if(state.items.length>=100)return notify('한 배치에 최대 100개까지 추가할 수 있어요.');
    const fields=[...document.querySelectorAll('[data-draft]')];if(fields.some(input=>!input.reportValidity()))return;
    return commit(()=>{const count=state.items.filter(o=>o.type===preset).length;const obj=item(preset,{w:draft.w,d:draft.d,h:draft.h,name:PRESETS[preset].label+(count?' '+(count+1):'')});
      if(preset==='human'){Object.assign(obj,humanSize(obj.h));obj.z=depth(state)/2+.35;obj.rotation=180;}
      else {obj.x=Math.min(count*.1,.4);obj.z=Math.min(count*.1,.4);}
      if(preset==='poster'){obj.y=.9;obj.x=0;obj.z=0;mountPoster(obj,state,obj.mount);}
      if(preset==='projector'){obj.rotation=180;obj.z=.4;}
      if(preset==='table')obj.thickness=Math.min(.035,obj.h/4);
      state.items.push(obj);selected=obj.id;tab='selected';notify(`${obj.name}을 추가했어요. 드래그하거나 위치 값을 조정하세요.`);});
  }
  if(name==='save'){download(new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),filename()+'.json');return notify('배치 파일을 저장했어요.');}
  if(name==='load')return $('#file-input').click();
  if(name==='png'){
    if(!scene)return notify('3D 화면을 먼저 시작해주세요.');
    await scene.readyImages();
    const canvas=scene.exportImage('홍익대학교 디자인컨버전스 2026 졸업전시 부스 스케일 테스트',`${project.active}안 · ${state.name} · ${state.options.lighting==='dark'?'암실':'밝음'} · ${state.discipline==='general'?'비인터랙션':'인터랙션'} · ${state.booth==='team'?'팀':'개인'} ${cm(width(state))} × ${cm(depth(state))} × 200cm · 가벽 ${cm(state.walls.thickness)}cm · ${new Date().toLocaleDateString('ko-KR')}`);
    const data=canvas.toDataURL('image/png');$('#export-preview').src=data;$('#export-download').href=data;$('#export-download').download=filename()+'.png';$('#export-dialog').showModal();return;
  }
  if(name==='fit'){scene?.fit();return;}
  if(name==='review'){tab='scene';render();$('#review-heading')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
  if(['grid','dimensions','neighbors'].includes(name))return commit(()=>state.options[name]=!state.options[name]);
  if(name==='ghost')return commit(()=>state.walls.ghost=!state.walls.ghost);
  if(!o)return;
  if(name==='focus')return scene?.focus(o,state);
  if(name==='duplicate')return duplicate();
  if(name==='lock')return commit(()=>o.locked=!o.locked);
  if(o.locked)return;
  if(name==='poster-image')return $('#poster-input').click();
  if(name==='poster-clear')return commit(()=>o.image=null);
  if(name==='poster-fit')return commit(()=>o.h=o.w/o.imageAspect);
  if(name==='project-back')return commit(()=>{const p=world(o,state);setWorld(o,state,{rotation:180});o.projection.pitch=0;const distance=p.z+depth(state)/2-o.d/2-.015;if(distance<.1||distance>10)throw new Error('뒤 벽과 렌즈 사이 거리를 10–1000cm 범위로 조절하세요.');o.projection.distance=distance;state.walls.back=true;});
  if(name==='delete')return commit(()=>{removeItem(state,o.id);selected=null;});
  if(name==='rotate')return commit(()=>o.rotation+=90);
  if(name==='ground')return commit(()=>{if(o.type!=='poster')attach(o,state,null);o.y=0;});
}
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.layout)return commit(()=>{project.layouts[project.active]=state;state=switchLayout(project,button.dataset.layout);selected=null;});
  if(button.dataset.lighting)return commit(()=>state.options.lighting=button.dataset.lighting);
  if(button.dataset.action)return action(button.dataset.action);
  if(button.dataset.discipline)return commit(()=>state.discipline=button.dataset.discipline);
  if(button.dataset.wallToggle)return commit(()=>{const side=button.dataset.wallToggle;state.walls[side]=!state.walls[side];});
  if(button.dataset.booth)return commit(()=>state.booth=button.dataset.booth);
  if(button.dataset.view){scene?.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===button));return;}
  if(button.dataset.tab){tab=button.dataset.tab;render();return;}
  if(button.dataset.posterWall){const o=selectedItem();if(!o||o.locked)return;const wall=button.dataset.posterWall;if(commit(()=>mountPoster(o,state,wall))){scene?.viewPosterWall(wall);document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view==='3d'));}return;}
  if(button.dataset.preset){preset=button.dataset.preset;draft={...PRESETS[preset]};render();return;}
  if(button.dataset.select||button.dataset.issue){selected=button.dataset.select||button.dataset.issue;tab='selected';render();if(button.dataset.issue){scene?.focus(selectedItem(),state);if(selectedItem().hidden)notify('숨겨진 집기입니다. 장면 탭에서 표시를 켤 수 있어요.');}return;}
  if(button.dataset.lock)return commit(()=>{const o=state.items.find(o=>o.id===button.dataset.lock);o.locked=!o.locked;});
  if(button.dataset.hide)return commit(()=>{const o=state.items.find(o=>o.id===button.dataset.hide);o.hidden=!o.hidden;});
});
function handleEdit(e){
  const input=e.target;
  if(input.type==='number'&&(!input.value.trim()||(!input.checkValidity()&&input.dataset.prop!=='rotation'))){input.reportValidity();return;}
  if(input.dataset.draft){draft[input.dataset.draft]=Number(input.value)/100;return;}
  if(input.id==='project-name')return commit(()=>state.name=input.value.trim()||'부스');
  if(input.id==='snap')return commit(()=>state.options.snap=Number(input.value));
  if(input.id==='rotation-snap')return commit(()=>state.options.rotationSnap=Number(input.value));
  if(input.dataset.wall)return commit(()=>state.walls[input.dataset.wall]=input.type==='checkbox'?input.checked:Number(input.value)/100);
  const o=selectedItem();if(!o||o.locked)return;
  if(input.dataset.stand)return commit(()=>setDisplayStand(o,input.checked));
  if(input.dataset.posterPosition)return commit(()=>o[input.dataset.posterPosition]=Number(input.value)/100);
  if(input.dataset.projection)return commit(()=>{const key=input.dataset.projection;o.projection[key]=input.type==='checkbox'?input.checked:['aspect','color'].includes(key)?input.value:Number(input.value)/(key==='distance'?100:1);});
  if(input.dataset.screen)return commit(()=>o.screen[input.dataset.screen]=input.type==='checkbox'?input.checked:Number(input.value));
  if(input.dataset.position)return commit(()=>setWorld(o,state,{[input.dataset.position]:Number(input.value)/100}));
  const prop=input.dataset.prop;if(!prop)return;
  commit(()=>{
    if(prop==='support')attach(o,state,input.value||null);
    else if(prop==='rotation')setWorld(o,state,{rotation:Number(input.value)});
    else if(['name','color'].includes(prop))o[prop]=input.value;
    else {o[prop]=Number(input.value)/100;if(o.type==='human'){Object.assign(o,humanSize(o.h));}}
  });
}
document.addEventListener('input',e=>{
  if(e.target.matches('input:not([type=file]),select'))e.target.dataset.pendingEdit='true';
});
document.addEventListener('change',e=>{delete e.target.dataset.pendingEdit;handleEdit(e);});
document.addEventListener('focusout',e=>{if(e.target.dataset.pendingEdit){delete e.target.dataset.pendingEdit;handleEdit(e);}});
$('#file-input').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>12_000_000)throw new Error('12MB 이하의 배치 파일을 선택해주세요.');const next=validateProject(JSON.parse(await file.text()));commit(()=>{restore(next);selected=null;tab='scene';});notify('저장한 배치를 불러왔어요.');}
  catch(error){notify(error instanceof SyntaxError?'JSON 배치 파일을 읽을 수 없습니다.':error.message);}
  e.target.value='';
});
$('#poster-input').addEventListener('change',async e=>{
  const file=e.target.files[0],target=selectedItem(),layout=project.active;
  if(!file||target?.type!=='poster')return;
  try {
    notify('포스터 이미지를 준비하고 있습니다.');
    const result=await readPosterImage(file);
    if(layout!==project.active||!state.items.includes(target)||target.locked){notify('배치가 바뀌었습니다. 포스터를 선택하고 다시 시도하세요.');return;}
    const height=target.w/result.imageAspect;
    if(commit(()=>{Object.assign(target,result);if(height<=10&&height>=.001)target.h=height;}))notify('이미지를 적용했습니다. 가로와 설치 높이를 조절하세요.');
  } catch(error){notify(error.message||'이미지를 읽지 못했습니다.');}
  finally {e.target.value='';}
});
document.addEventListener('keydown',e=>{
  if(e.target.closest('input,select,textarea')||document.querySelector('dialog[open]'))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();action('delete');}
  if(e.key==='Escape'){selected=null;render();}
});
render();if(!loadWarning)saveLocal();if(loadWarning)notify(loadWarning);
