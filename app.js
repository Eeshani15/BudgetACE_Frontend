// ===== BudgetACE Dashboard (Frontend -> Django Budget APIs) =====
const API_BASE = "https://budgetace-backend.onrender.com"; // later replace with Render backend URL

const LS = {
  session: "budgetace_session_v2",
  statePrefix: "budgetace_state_",
  historyPrefix: "budgetace_history_",
  spentPrefix: "budgetace_spent_" // store spent per category per user
};

function load(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch{ return fallback; }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function safeNum(v){ const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function money(n){ return `$${(Math.round((safeNum(n))*100)/100).toFixed(2)}`; }
function pct(n){ return `${(Math.round((safeNum(n))*100)/100).toFixed(2)}%`; }

function mustBeLoggedIn(){
  const sess = load(LS.session, null);
  if(!sess?.email){
    window.location.href = "signin.html";
    return null;
  }
  return sess;
}

async function postJSON(path, bodyObj){
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj)
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

function monthDefaultLabel(d = new Date()){
  const m = d.toLocaleString(undefined, { month:"short" });
  return `${m} ${d.getFullYear()}`;
}
function toMonthYYYYMM(dateStr){
  // from "YYYY-MM-DD" -> "YYYY-MM"
  if(!dateStr) return "";
  return String(dateStr).slice(0, 7);
}
function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

// UI refs
const sess = mustBeLoggedIn();
if(!sess) throw new Error("Not logged in");

const email = String(sess.email).toLowerCase();
const displayName = sess.username || sess.name || "User";

const stateKey = LS.statePrefix + email;
const historyKey = LS.historyPrefix + email;
const spentKey = LS.spentPrefix + email;

const helloEl = document.getElementById("hello");
const emailLineEl = document.getElementById("emailLine");
const syncMsgEl = document.getElementById("syncMsg");

const monthLabelEl = document.getElementById("monthLabel");
const payDateEl = document.getElementById("payDate");
const incomeEl = document.getElementById("income");
const catBody = document.getElementById("catBody");

const kAllocated = document.getElementById("kAllocated");
const kSpent = document.getElementById("kSpent");
const kRemain = document.getElementById("kRemain");
const kSavePct = document.getElementById("kSavePct");
const insight = document.getElementById("insight");

const saveMonthBtn = document.getElementById("saveMonth");
const resetBtn = document.getElementById("resetMonth");
const clearHistoryBtn = document.getElementById("clearHistory");
const historyDiv = document.getElementById("history");

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(LS.session);
  window.location.href = "index.html";
});

helloEl.textContent = `Hi ${displayName} 👋`;
emailLineEl.textContent = email;

// Charts
let pieChart = null;
let barChart = null;

// State holds categories from backend + spent from local
let state = load(stateKey, {
  monthLabel: "",
  payDate: "",
  income: 0,
  categories: [] // {id, name, default_amount, spent}
});

function persist(){ save(stateKey, state); }

function getSpentMap(){
  return load(spentKey, {}); // { "Rent": 12, "Groceries": 50 }
}
function setSpent(name, val){
  const map = getSpentMap();
  map[name] = safeNum(val);
  save(spentKey, map);
}
function getSpent(name){
  const map = getSpentMap();
  return safeNum(map[name]);
}

function totals(){
  const income = safeNum(incomeEl.value);
  const allocated = state.categories.reduce((a,c)=>a+safeNum(c.default_amount),0);
  const spent = state.categories.reduce((a,c)=>a+safeNum(c.spent),0);
  const remaining = income - spent;
  const savingsPct = income>0 ? (remaining/income)*100 : 0;
  const spentPct = income>0 ? (spent/income)*100 : 0;
  return { income, allocated, spent, remaining, savingsPct, spentPct };
}

function renderCats(){
  catBody.innerHTML = "";
  const income = safeNum(incomeEl.value);

  state.categories.forEach((c) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = c.name;

    // Budget input -> updates backend defaults
    const tdBud = document.createElement("td");
    const bud = document.createElement("input");
    bud.type = "number"; bud.min="0"; bud.step="1";
    bud.value = safeNum(c.default_amount);
    bud.addEventListener("input", () => {
      c.default_amount = safeNum(bud.value);
      persist();
      recalcUI();
    });
    tdBud.appendChild(bud);

    // Spent input -> local only
    const tdSpent = document.createElement("td");
    const sp = document.createElement("input");
    sp.type="number"; sp.min="0"; sp.step="1";
    sp.value = safeNum(c.spent);
    sp.addEventListener("input", () => {
      c.spent = safeNum(sp.value);
      setSpent(c.name, c.spent);
      persist();
      recalcUI();
    });
    tdSpent.appendChild(sp);

    const tdPct = document.createElement("td");
    tdPct.style.fontWeight = "900";
    tdPct.textContent = income > 0 ? pct((safeNum(c.spent)/income)*100) : "—";

    tr.appendChild(tdName);
    tr.appendChild(tdBud);
    tr.appendChild(tdSpent);
    tr.appendChild(tdPct);

    catBody.appendChild(tr);
  });
}

function health(spentPct){
  if(spentPct <= 70) return "✅ Great! You are saving well 🌸";
  if(spentPct <= 90) return "💰 Good, but try to save a bit more.";
  return "⚠️ You are spending too much. Try reducing expenses.";
}

function renderCharts(){
  const labels = state.categories.map(c => c.name);
  const spent = state.categories.map(c => safeNum(c.spent));
  const budget = state.categories.map(c => safeNum(c.default_amount));

  const pieCtx = document.getElementById("pie").getContext("2d");
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type:"pie",
    data:{ labels, datasets:[{ data: spent }] },
    options:{ plugins:{ legend:{ position:"bottom" } } }
  });

  const barCtx = document.getElementById("bar").getContext("2d");
  if(barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type:"bar",
    data:{
      labels,
      datasets:[
        { label:"Budget", data: budget },
        { label:"Spent", data: spent }
      ]
    },
    options:{
      plugins:{ legend:{ position:"bottom" } },
      scales:{ y:{ beginAtZero:true } }
    }
  });
}

function renderHistory(){
  const hist = load(historyKey, []);
  historyDiv.innerHTML = "";

  if(hist.length === 0){
    const div = document.createElement("div");
    div.className = "card card-pad";
    div.style.background = "rgba(255,255,255,.75)";
    div.textContent = "No months saved yet. Click “Save & Calculate” to track progress 🌸";
    historyDiv.appendChild(div);
    return;
  }

  hist.slice(0,8).forEach((h) => {
    const box = document.createElement("div");
    box.className = "card card-pad";
    box.style.background = "rgba(255,255,255,.75)";
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div style="font-weight:1000;">${h.monthLabel}</div>
        <div class="muted">${new Date(h.savedAt).toLocaleDateString()}</div>
      </div>
      <div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:8px;">
        <div>Income: <strong>${money(h.income)}</strong></div>
        <div>Allocated: <strong>${money(h.allocated_total)}</strong></div>
        <div>Remaining: <strong>${money(h.remaining)}</strong></div>
        <div>Savings: <strong>${pct(h.saving_percent)}</strong></div>
      </div>
      ${h.improvementMsg ? `<div class="muted" style="margin-top:8px;">${h.improvementMsg}</div>` : ``}
    `;
    historyDiv.appendChild(box);
  });
}

function recalcUI(){
  // update state from inputs
  state.monthLabel = monthLabelEl.value.trim() || monthDefaultLabel(new Date());
  state.payDate = payDateEl.value || "";
  state.income = safeNum(incomeEl.value);
  persist();

  const t = totals();
  kAllocated.textContent = money(t.allocated);
  kSpent.textContent = money(t.spent);
  kRemain.textContent = money(t.remaining);
  kSavePct.textContent = pct(t.savingsPct);

  renderCats(); // refresh % column
  renderCharts();

  if(t.income <= 0){
    insight.textContent = "Enter your income to begin ✨";
  } else if(t.remaining < 0){
    insight.textContent = `⚠️ You are overspent by ${money(Math.abs(t.remaining))}.`;
  } else {
    insight.textContent = `${health(t.spentPct)} (Savings: ${pct(t.savingsPct)})`;
  }
}

async function initFromBackend(){
  try{
    syncMsgEl.textContent = "Loading your categories from backend…";
    const data = await postJSON("/api/budget/init-defaults/", { email });

    // Merge with local spent values
    const spentMap = getSpentMap();
    state.categories = (data.categories || []).map(c => ({
      id: c.id,
      name: c.name,
      default_amount: safeNum(c.default_amount),
      spent: safeNum(spentMap[c.name] ?? 0)
    }));

    persist();
    syncMsgEl.textContent = "✅ Connected. Edit budgets, enter income, then Save & Calculate.";
    recalcUI();
  } catch(e){
    syncMsgEl.textContent = "⚠️ Backend not reachable. Make sure Django is running.";
  }
}

async function pushDefaultsToBackend(){
  // send current budget defaults
  const categories = state.categories.map(c => ({
    name: c.name,
    default_amount: safeNum(c.default_amount)
  }));
  await postJSON("/api/budget/update-defaults/", { email, categories });
}

async function saveAndCalculate(){
  const pay_date = payDateEl.value || todayISO();
  const month = toMonthYYYYMM(pay_date);
  const income = safeNum(incomeEl.value);

  if(income <= 0){
    alert("Please enter income before saving.");
    return;
  }

  try{
    saveMonthBtn.disabled = true;
    saveMonthBtn.textContent = "Saving…";

    // 1) Update defaults first
    await pushDefaultsToBackend();

    // 2) Calculate allocations + improvement using backend
    const calc = await postJSON("/api/budget/set-income/", {
      email,
      month,
      pay_date,
      income
    });

    // Update KPIs using backend allocation results (allocated_total + remaining)
    // Note: "Spent" is still local based on inputs (your choice).
    const localSpent = totals().spent;
    const remainingAfterSpent = income - localSpent;
    const savePct = income > 0 ? (remainingAfterSpent / income) * 100 : 0;

    kAllocated.textContent = money(calc.allocated_total);
    kRemain.textContent = money(remainingAfterSpent);
    kSavePct.textContent = pct(savePct);

    // Improvement message from backend (month-to-month based on allocated remaining)
    const improvementMsg = calc.improvement?.message
      ? String(calc.improvement.message).replace("â", "") // fixes encoding showing â
      : "";

    insight.textContent = improvementMsg
      ? improvementMsg
      : "✅ Saved! Add next month to see improvement tracking 🌸";

    // Save to local history card list
    const label = monthLabelEl.value.trim() || monthDefaultLabel(new Date(pay_date));
    const hist = load(historyKey, []);
    const entry = {
      monthLabel: label,
      month,
      pay_date,
      income,
      allocated_total: safeNum(calc.allocated_total),
      remaining: safeNum(remainingAfterSpent),
      saving_percent: safeNum(savePct),
      improvementMsg,
      savedAt: new Date().toISOString()
    };
    const filtered = hist.filter(x => x.month !== month);
    filtered.unshift(entry);
    save(historyKey, filtered);

    renderHistory();
    alert("✅ Month saved & calculated!");
  } catch(e){
    alert(`❌ Save failed: ${e.message}`);
  } finally {
    saveMonthBtn.disabled = false;
    saveMonthBtn.textContent = "Save & Calculate";
  }
}

saveMonthBtn.addEventListener("click", saveAndCalculate);

resetBtn.addEventListener("click", () => {
  if(!confirm("Reset current month inputs?")) return;

  // Reset local spent only, keep backend categories
  const spentMap = {};
  save(spentKey, spentMap);

  state.monthLabel = monthDefaultLabel(new Date());
  state.payDate = "";
  state.income = 0;
  state.categories = state.categories.map(c => ({ ...c, spent: 0 }));
  persist();

  monthLabelEl.value = state.monthLabel;
  payDateEl.value = "";
  incomeEl.value = "";
  syncMsgEl.textContent = "✅ Reset done (spent cleared). Budgets remain from backend.";
  recalcUI();
});

clearHistoryBtn.addEventListener("click", () => {
  if(!confirm("Clear all history for your account?")) return;
  save(historyKey, []);
  renderHistory();
});

monthLabelEl.addEventListener("input", recalcUI);
payDateEl.addEventListener("change", () => {
  // auto-fill month label when pay date changes (nice UX)
  const d = payDateEl.value ? new Date(payDateEl.value) : new Date();
  if(!monthLabelEl.value.trim()) monthLabelEl.value = monthDefaultLabel(d);
  recalcUI();
});
incomeEl.addEventListener("input", recalcUI);

// init inputs from local state
monthLabelEl.value = state.monthLabel || monthDefaultLabel(new Date());
payDateEl.value = state.payDate || "";
incomeEl.value = state.income || "";

// Boot
renderHistory();
initFromBackend();