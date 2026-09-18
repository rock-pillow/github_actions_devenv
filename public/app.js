const $ = (s, root = document) => root.querySelector(s);
const setup = $("#setup");
const app = $("#app");
const projectsEl = $("#projects");
const yen = n => new Intl.NumberFormat("ja-JP",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(Number(n||0));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "content-type":"application/json", ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function statusLabel(s) {
  return ({draft:"下書き",pending:"承認待ち",confirmed:"承認済み",changes_requested:"修正依頼",invoiced:"請求済み"})[s] || s;
}

async function load() {
  try {
    const data = await api("/api/state");
    setup.hidden = true;
    app.hidden = false;
    $("#workspace-name").textContent = data.workspace.name;
    render(data);
  } catch {
    setup.hidden = false;
    app.hidden = true;
  }
}

function render(data) {
  const changes = data.changes || [];
  const projects = data.projects || [];
  const unbilled = changes.filter(c => c.status === "confirmed").reduce((a,c)=>a+Number(c.amount||0),0);
  $("#unbilled").textContent = yen(unbilled);

  projectsEl.innerHTML = projects.filter(p=>!p.archived).map(p => {
    const pcs = changes.filter(c=>c.project_id===p.id);
    return `<article class="card project" data-project="${p.id}">
      <div class="project-head"><div><p class="eyebrow">${esc(p.client)}</p><h2>${esc(p.name)}</h2></div><span>${yen(p.budget)}</span></div>
      <details><summary>当初スコープ</summary><p class="pre">${esc(p.baseline)}</p></details>
      <div class="changes">${pcs.length ? pcs.map(changeCard).join("") : '<p class="muted">変更依頼はまだありません。</p>'}</div>
      <form class="change-form stack">
        <h3>変更依頼を追加</h3>
        <input type="hidden" name="project_id" value="${p.id}">
        <label>タイトル<input name="title" maxlength="120" required></label>
        <label>内容<textarea name="description" maxlength="4000" required></textarea></label>
        <div class="row"><label>追加費用（円）<input name="amount" type="number" min="0" required></label><label>納期影響（日）<input name="days" type="number" min="0" max="365" required></label></div>
        <button>下書きを作る</button>
      </form>
    </article>`;
  }).join("") || '<section class="card"><p class="muted">最初の案件を作成してください。</p></section>';
}

function changeCard(c) {
  const actions = [];
  if (c.status === "draft" || c.status === "pending") actions.push(`<button data-action="share" data-id="${c.id}" class="secondary">承認URLを発行</button>`);
  if (c.status === "confirmed") actions.push(`<button data-action="invoice" data-id="${c.id}">請求済みにする</button>`);
  actions.push(`<button data-action="history" data-id="${c.id}" class="ghost">履歴</button>`);
  return `<div class="change">
    <div><strong>${esc(c.title)}</strong><span class="status ${c.status}">${statusLabel(c.status)}</span></div>
    <p class="muted">${yen(c.amount)} / +${Number(c.days)}日 / v${c.version}</p>
    <p class="pre clamp">${esc(c.description)}</p>
    <div class="actions">${actions.join("")}</div>
  </div>`;
}

$("#workspace-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  try {
    await api("/api/workspaces",{method:"POST",body:JSON.stringify({name:fd.get("name")})});
    await load();
  } catch (err) { alert(err.message); }
});

$("#project-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  try {
    await api("/api/action",{method:"POST",body:JSON.stringify({action:"create_project",payload:{
      name:fd.get("name"),client:fd.get("client"),baseline:fd.get("baseline"),budget:Number(fd.get("budget"))
    }})});
    e.currentTarget.reset(); await load();
  } catch (err) { alert(err.message); }
});

projectsEl.addEventListener("submit", async e => {
  if (!e.target.matches(".change-form")) return;
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api("/api/action",{method:"POST",body:JSON.stringify({action:"create_change",payload:{
      project_id:fd.get("project_id"),title:fd.get("title"),description:fd.get("description"),
      amount:Number(fd.get("amount")),days:Number(fd.get("days"))
    }})});
    await load();
  } catch (err) { alert(err.message); }
});

projectsEl.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  try {
    const action = b.dataset.action;
    const data = await api("/api/action",{method:"POST",body:JSON.stringify({action,payload:{id:b.dataset.id}})});
    if (action === "share") {
      await navigator.clipboard.writeText(data.review_url);
      alert("承認URLをコピーしました。");
    } else if (action === "history") {
      alert((data || []).map(x=>`#${x.id} ${x.kind} v${x.version} — ${new Date(x.created_at).toLocaleString("ja-JP")}`).join("\n") || "履歴はありません");
    } else {
      await load();
    }
  } catch (err) { alert(err.message); }
});

$("#logout").addEventListener("click", async () => {
  await api("/api/logout",{method:"POST",body:"{}"}); location.reload();
});

load();
