// 버전 목록과 티켓 수를 담는 상태
let versionList = [];      // [{version_id, version_name, status, created_at, sort_order}] — sort_order 기준 정렬 유지
let ticketCounts = {};     // { version_id: count }

// 정렬 상태 (페이지 메모리에서만 관리, 저장 불필요)
let sortState = { col: null, dir: 'asc' }; // col: 'name' | 'count' | 'date' | null

// 페이지 진입 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-back').addEventListener('click', () => {
    location.href = 'index.html';
  });

  document.getElementById('btn-add-ver').addEventListener('click', handleAdd);
  document.getElementById('new-version-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });

  // 정렬 가능한 헤더 클릭 이벤트
  document.querySelectorAll('.ver-th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortState.col === col) {
        // 같은 컬럼 재클릭 → 방향 토글
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        // 다른 컬럼 클릭 → 해당 컬럼 오름차순으로 전환
        sortState.col = col;
        sortState.dir = 'asc';
      }
      renderTable();
    });
  });

  await loadData();
});

// ─── 데이터 로드 ──────────────────────────────────────────────────────────────

async function loadData() {
  showLoading(true);
  try {
    // 버전 목록과 전체 티켓을 병렬로 가져옴
    const [vers, allTickets] = await Promise.all([
      getVersions(),
      getTickets()
    ]);

    // versionList는 항상 sort_order 기준으로 유지 (수동 순서 이동을 위해)
    versionList = vers;

    // 버전별 티켓 수 집계
    const flat = [
      ...allTickets.activeWW,
      ...allTickets.activeMVN,
      ...allTickets.done,
      ...allTickets.hold
    ];
    ticketCounts = {};
    flat.forEach(tk => {
      const vid = tk.version_id || '';
      ticketCounts[vid] = (ticketCounts[vid] || 0) + 1;
    });

    renderTable();
  } catch (err) {
    alert('데이터 로드 실패: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── 정렬 ─────────────────────────────────────────────────────────────────────

// 현재 sortState에 따라 표시용 정렬 배열 반환 (versionList 원본은 변경하지 않음)
function getSortedDisplay() {
  if (!sortState.col) return [...versionList];

  return [...versionList].sort((a, b) => {
    let va, vb;
    if (sortState.col === 'name') {
      va = a.version_name.toLowerCase();
      vb = b.version_name.toLowerCase();
    } else if (sortState.col === 'count') {
      va = ticketCounts[a.version_id] || 0;
      vb = ticketCounts[b.version_id] || 0;
    } else if (sortState.col === 'date') {
      va = a.created_at || '';
      vb = b.created_at || '';
    }
    if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
    if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
    return 0;
  });
}

// 헤더의 정렬 아이콘(▲/▼) 갱신
function updateSortHeaders() {
  document.querySelectorAll('.ver-th-sortable').forEach(th => {
    const icon = th.querySelector('.ver-sort-icon');
    if (!icon) return;
    if (sortState.col === th.dataset.col) {
      icon.textContent = sortState.dir === 'asc' ? ' ▲' : ' ▼';
      th.classList.add('ver-th-active');
    } else {
      icon.textContent = '';
      th.classList.remove('ver-th-active');
    }
  });
}

// ─── 테이블 렌더링 ────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.getElementById('ver-tbody');
  if (!tbody) return;

  updateSortHeaders();

  if (versionList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="ver-empty">버전이 없습니다.</td></tr>';
    return;
  }

  // 표시는 sortState 기준, 수동 순서 버튼은 versionList(sort_order) 기준
  const displayList = getSortedDisplay();
  tbody.innerHTML = displayList.map(v => buildRow(v)).join('');

  // 이벤트 연결
  tbody.querySelectorAll('.btn-ver-up').forEach(btn =>
    btn.addEventListener('click', () => handleMoveOrder(btn.dataset.id, -1)));
  tbody.querySelectorAll('.btn-ver-down').forEach(btn =>
    btn.addEventListener('click', () => handleMoveOrder(btn.dataset.id, +1)));
  tbody.querySelectorAll('.btn-ver-edit').forEach(btn =>
    btn.addEventListener('click', () => handleEditStart(btn.dataset.id)));
  tbody.querySelectorAll('.btn-ver-save').forEach(btn =>
    btn.addEventListener('click', () => handleEditSave(btn.dataset.id)));
  tbody.querySelectorAll('.btn-ver-cancel').forEach(btn =>
    btn.addEventListener('click', () => renderTable()));
  tbody.querySelectorAll('.btn-ver-delete').forEach(btn =>
    btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function buildRow(v) {
  const count   = ticketCounts[v.version_id] || 0;
  const dateStr = v.created_at ? v.created_at.substring(0, 10) : '—';

  // isFirst/isLast는 sort_order 기준 위치로 판단 (정렬 표시와 무관하게 수동 순서 이동을 위해)
  const sortOrderIdx = versionList.indexOf(v);
  const isFirst = sortOrderIdx === 0;
  const isLast  = sortOrderIdx === versionList.length - 1;

  return `
    <tr data-id="${escHtml(v.version_id)}">
      <td class="ver-name-cell">
        <span class="ver-name-text">${escHtml(v.version_name)}</span>
      </td>
      <td class="ver-count-cell">${count}</td>
      <td class="ver-date-cell">${dateStr}</td>
      <td class="ver-action-cell">
        <button class="btn btn-secondary btn-sm btn-ver-edit" data-id="${escHtml(v.version_id)}">수정</button>
        <button class="btn btn-danger btn-sm btn-ver-delete" data-id="${escHtml(v.version_id)}">삭제</button>
      </td>
      <td class="ver-order-cell">
        <button class="btn-ver-order btn-ver-up" data-id="${escHtml(v.version_id)}" ${isFirst ? 'disabled' : ''}>▲</button>
        <button class="btn-ver-order btn-ver-down" data-id="${escHtml(v.version_id)}" ${isLast ? 'disabled' : ''}>▼</button>
      </td>
    </tr>`;
}

// ─── 인라인 편집 ──────────────────────────────────────────────────────────────

function handleEditStart(versionId) {
  const v = versionList.find(x => x.version_id === versionId);
  if (!v) return;

  const row = document.querySelector(`tr[data-id="${CSS.escape(versionId)}"]`);
  if (!row) return;

  // 버전명 셀 → input으로 전환
  const nameCell = row.querySelector('.ver-name-cell');
  nameCell.innerHTML = `<input type="text" class="ver-name-input ver-edit-input" value="${escHtml(v.version_name)}" maxlength="50">`;
  nameCell.querySelector('input').focus();

  // 작업 버튼 → 저장/취소로 전환
  const actionCell = row.querySelector('.ver-action-cell');
  actionCell.innerHTML = `
    <button class="btn btn-primary btn-sm btn-ver-save" data-id="${escHtml(versionId)}">저장</button>
    <button class="btn btn-ghost btn-sm btn-ver-cancel" data-id="${escHtml(versionId)}">취소</button>`;

  actionCell.querySelector('.btn-ver-save').addEventListener('click', () => handleEditSave(versionId));
  actionCell.querySelector('.btn-ver-cancel').addEventListener('click', () => renderTable());

  nameCell.querySelector('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter')  handleEditSave(versionId);
    if (e.key === 'Escape') renderTable();
  });
}

async function handleEditSave(versionId) {
  const row = document.querySelector(`tr[data-id="${CSS.escape(versionId)}"]`);
  if (!row) return;

  const input = row.querySelector('.ver-edit-input');
  const newName = input ? input.value.trim() : '';
  if (!newName) { input && input.focus(); return; }

  showLoading(true);
  try {
    await updateVersion({ version_id: versionId, version_name: newName });
    const v = versionList.find(x => x.version_id === versionId);
    if (v) v.version_name = newName;
    renderTable();
  } catch (err) {
    alert('수정 실패: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── 순서 이동 ────────────────────────────────────────────────────────────────

async function handleMoveOrder(versionId, direction) {
  const idx = versionList.findIndex(v => v.version_id === versionId);
  if (idx < 0) return;

  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= versionList.length) return;

  const a = versionList[idx];
  const b = versionList[swapIdx];
  const tmpOrder = a.sort_order;

  showLoading(true);
  try {
    await Promise.all([
      updateVersion({ version_id: a.version_id, sort_order: String(b.sort_order) }),
      updateVersion({ version_id: b.version_id, sort_order: String(tmpOrder) })
    ]);
    // 로컬 상태 반영 후 sort_order 기준 재정렬
    a.sort_order = b.sort_order;
    b.sort_order = tmpOrder;
    versionList.sort((x, y) => x.sort_order - y.sort_order);
    renderTable();
  } catch (err) {
    alert('순서 변경 실패: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── 삭제 ─────────────────────────────────────────────────────────────────────

async function handleDelete(versionId) {
  const v = versionList.find(x => x.version_id === versionId);
  if (!v) return;

  const count = ticketCounts[versionId] || 0;
  const msg = count > 0
    ? `[${v.version_name}]을(를) 삭제하시겠습니까?\n소속 티켓 ${count}개의 버전 정보가 초기화됩니다. 티켓 자체는 유지됩니다.`
    : `[${v.version_name}]을(를) 삭제하시겠습니까?`;

  if (!confirm(msg)) return;

  showLoading(true);
  try {
    await deleteVersion(versionId);
    versionList = versionList.filter(x => x.version_id !== versionId);
    delete ticketCounts[versionId];
    // localStorage에 저장된 선택 버전이 삭제된 경우 초기화
    if (localStorage.getItem('dqa_current_version') === versionId) {
      localStorage.removeItem('dqa_current_version');
    }
    renderTable();
  } catch (err) {
    alert('삭제 실패: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── 새 버전 추가 ─────────────────────────────────────────────────────────────

async function handleAdd() {
  const input = document.getElementById('new-version-name');
  const name  = input.value.trim();
  if (!name) { input.focus(); return; }

  showLoading(true);
  try {
    await addVersion(name);
    input.value = '';
    await loadData(); // 목록 전체 재로드
  } catch (err) {
    alert('버전 추가 실패: ' + err.message);
  } finally {
    showLoading(false);
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
