// ========== BudgetAce - Frontend Startup MVP (LocalStorage demo auth) ==========

const LS_KEYS = {
  users: "budgetace_users",         // { [nameLower]: {name, passHashLike} }
  session: "budgetace_session",     // { name }
  state: "budgetace_state",         // current working month state
  history: "budgetace_history"      // [{ monthLabel, income, cats, totals, savingsPct, savedAt }]
};

// ---------- Helpers ----------
function $(id){ return document.getElementById(id); }
function money(n){
  const x = Number.isFinite(n) ? n : 0;
  return `$${Math.round(x * 100) / 100}`;
}
function pct(n){
  const x = Number.isFinite(n) ? n : 0;
  return `${(Math.round(x * 100) / 100).toFixed(2)}%`;
}
function safeNum(v){
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function nowMonthDefault(){
  const d = new Date();
  const m = d.toLocaleString(undefined, { month:"short" });
  return `${m} ${d.getFullYear()}`;
}
function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{
    return fallback;
  }
}
function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

// Not real hashing (demo only)
function simplePassTransform(p){ return btoa(unescape(encodeURIComponent(p))).slice(0, 24); }

// ---------- Default categories ----------
function defaultCats(){
  return [
    { id: crypto.randomUUID?.() ?? String(Date.now())+"a", name:"Rent", icon:"🏠", budget:200, spent:200 },
    { id: crypto.randomUUID?.() ?? String(Date.now())+"b", name:"Groceries", icon:"🛒", budget:100, spent:100 },
    { id: crypto.randomUUID?.() ?? String(Date.now())+"c", name:"Bills", icon:"💡", budget:80, spent:80 },
    { id: crypto.randomUUID?.() ?? String(Date.now())+"d", name:"Transport", icon:"🚗", budget:50, spent:50 },
    { id: crypto.randomUUID?.() ?? String(Date.now())+"e", name:"Entertainment", icon:"🎉", budget:40, spent:40 },
  ];
}

// ---------- State ----------
let state = load(LS_KEYS.state, {
  monthLabel: nowMonthDefault(),
  income: 0,
  cats: defaultCats()
});

let pieChart = null;
let barChart = null;

// ---------- Elements ----------
const authView = $("authView");
const appView = $("appView");
const btnLogout = $("btnLogout");

const tabSignIn = $("tabSignIn");
const tabSignUp = $("tabSignUp");
const signInForm = $("signInForm");
const signUpForm = $("signUpForm");

const inName = $("inName");
const inPass = $("inPass");
const upName = $("upName");
const upPass = $("upPass");

const helloTitle = $("helloTitle");
const subTitle = $("subTitle");
const monthChip = $("monthChip");

const incomeInput = $("incomeInput");
const monthLabel = $("monthLabel");

const catBody = $("catBody");

const sumAllocated = $("sumAllocated");
const sumSpent = $("sumSpent");
const sumRemaining = $("sumRemaining");
const sumSavingsPct = $("sumSavingsPct");
const insightBox = $("insightBox");

const btnAddCat = $("btnAddCat");
const btnResetMonth = $("btnResetMonth");
const btnSaveMonth = $("btnSaveMonth");
const btnClearHistory = $("btnClearHistory");
const historyList = $("historyList");

// Modal
const modal = $("modal");
const btnModalCancel = $("btnModalCancel");
const btnModalAdd = $("btnModalAdd");
const newCatName = $("newCatName");
const newCatBudget = $("newCatBudget");
const newCatSpent = $("newCatSpent");

// ---------- Auth UI switching ----------
tabSignIn.addEventListener("click", () => {
  tabSignIn.classList.add("active");
  tabSignUp.classList.remove("active");
  signInForm.classList.remove("hidden");
  signUpForm.classList.add("hidden");
});

tabSignUp.addEventListener("click", () => {
  tabSignUp.classList.add("active");
  tabSignIn.classList.remove("active");
  signUpForm.classList.remove("hidden");
  signInForm.classList.add("hidden");
});

// ---------- Auth handlers ----------
signUpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = upName.value.trim();
  const pass = upPass.value;

  if(!name || !pass){
    alert("Please enter name and passcode.");
    return;
  }

  const users = load(LS_KEYS.users, {});
  const key = name.toLowerCase();

  if(users[key]){
    alert("Account already exists. Please Sign In.");
    return;
  }

  users[key] = { name, pass: simplePassTransform(pass) };
  save(LS_KEYS.users, users);

  // auto login
  save(LS_KEYS.session, { name });
  bootApp();
});

signInForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = inName.value.trim();
  const pass = inPass.value;

  const users = load(LS_KEYS.users, {});
  const key = name.toLowerCase();

  if(!users[key]){
    alert("No account found. Please Sign Up.");
    return;
  }

  if(users[key].pass !== simplePassTransform(pass)){
    alert("Wrong passcode.");
    return;
  }

  save(LS_KEYS.session, { name: users[key].name });
  bootApp();
});

btnLogout.addEventListener("click", () => {
  localStorage.removeItem(LS_KEYS.session);
  showAuth();
});

// ---------- App boot ----------
function showAuth(){
  btnLogout.classList.add("hidden");
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
}
function showApp(userName){
  btnLogout.classList.remove("hidden");
  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  helloTitle.textContent = `Hi ${userName} 👋`;
  subTitle.textContent = "Plan your month and track progress 🌸";
}

function bootApp(){
  const session = load(LS_KEYS.session, null);
  if(!session?.name){
    showAuth();
    return;
  }
  showApp(session.name);

  // load persisted state
  state = load(LS_KEYS.state, state);

  // initialize inputs
  monthLabel.value = state.monthLabel || nowMonthDefault();
  incomeInput.value = state.income || "";
  monthChip.textContent = state.monthLabel || nowMonthDefault();

  renderCats();
  recalcAndRender();
  renderHistory();
}

// ---------- Category rendering ----------
function renderCats(){
  catBody.innerHTML = "";
  const income = safeNum(incomeInput.value);

  state.cats.forEach((c) => {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.innerHTML = `
      <div class="cat-name">
        <span class="tag">${c.icon || "💸"}</span>
        <span>${escapeHtml(c.name)}</span>
      </div>
    `;

    const tdBudget = document.createElement("td");
    const budgetInput = document.createElement("input");
    budgetInput.type = "number";
    budgetInput.min = "0";
    budgetInput.step = "1";
    budgetInput.value = c.budget ?? 0;
    budgetInput.addEventListener("input", () => {
      c.budget = safeNum(budgetInput.value);
      persistState();
      recalcAndRender();
    });
    tdBudget.appendChild(budgetInput);

    const tdSpent = document.createElement("td");
    const spentInput = document.createElement("input");
    spentInput.type = "number";
    spentInput.min = "0";
    spentInput.step = "1";
    spentInput.value = c.spent ?? 0;
    spentInput.addEventListener("input", () => {
      c.spent = safeNum(spentInput.value);
      persistState();
      recalcAndRender();
    });
    tdSpent.appendChild(spentInput);

    const tdPct = document.createElement("td");
    tdPct.className = "kpi";
    tdPct.textContent = income > 0 ? pct((safeNum(c.spent) / income) * 100) : "—";

    const tdActions = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.title = "Remove category";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => {
      state.cats = state.cats.filter(x => x.id !== c.id);
      persistState();
      renderCats();
      recalcAndRender();
    });
    tdActions.appendChild(delBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdBudget);
    tr.appendChild(tdSpent);
    tr.appendChild(tdPct);
    tr.appendChild(tdActions);

    catBody.appendChild(tr);
  });
}

// ---------- Calculations + UI ----------
incomeInput.addEventListener("input", () => {
  state.income = safeNum(incomeInput.value);
  persistState();
  renderCats();
  recalcAndRender();
});

monthLabel.addEventListener("input", () => {
  state.monthLabel = monthLabel.value.trim() || nowMonthDefault();
  monthChip.textContent = state.monthLabel;
  persistState();
});

function totals(){
  const income = safeNum(incomeInput.value);
  const allocated = state.cats.reduce((a,c)=> a + safeNum(c.budget), 0);
  const spent = state.cats.reduce((a,c)=> a + safeNum(c.spent), 0);
  const remaining = income - spent;
  const savingsPct = income > 0 ? (remaining / income) * 100 : 0;

  return { income, allocated, spent, remaining, savingsPct };
}

function improvementMessage(currentSavingsPct){
  const history = load(LS_KEYS.history, []);
  if(history.length === 0){
    return "🌸 First month saved! Save this month to start tracking improvements.";
  }
  const last = history[0]; // most recent
  const lastPct = safeNum(last.savingsPct);
  const diff = (currentSavingsPct - lastPct);

  if(Math.abs(diff) < 0.01){
    return "✨ Same savings as last month. Keep it steady!";
  }
  if(diff > 0){
    return `✅ You improved savings by ${pct(diff)} vs last month (${last.monthLabel}).`;
  }
  return `⚠️ Savings dropped by ${pct(Math.abs(diff))} vs last month (${last.monthLabel}).`;
}

function spendingHealth(spentPct){
  if(spentPct <= 70) return { label:"Great saving 🌸", cls:"good" };
  if(spentPct <= 90) return { label:"Careful 💰", cls:"mid" };
  return { label:"Overspending ⚠️", cls:"bad" };
}

function recalcAndRender(){
  const { income, allocated, spent, remaining, savingsPct } = totals();

  sumAllocated.textContent = money(allocated);
  sumSpent.textContent = money(spent);
  sumRemaining.textContent = money(remaining);
  sumSavingsPct.textContent = pct(savingsPct);

  // Insight logic
  const spentPctOfIncome = income > 0 ? (spent / income) * 100 : 0;
  const health = spendingHealth(spentPctOfIncome);

  let insight = "";
  if(income <= 0){
    insight = "Enter your monthly income to start tracking ✨";
  } else if(remaining < 0){
    insight = `⚠️ You are overspent by ${money(Math.abs(remaining))}. Reduce spending or increase income target.`;
  } else {
    insight = `${health.label} — You’ve spent ${pct(spentPctOfIncome)} of your income. ${improvementMessage(savingsPct)}`;
  }
  insightBox.textContent = insight;

  // update % cells
  renderCats();

  // charts
  renderCharts();
}

function renderCharts(){
  const labels = state.cats.map(c => `${c.icon || "💸"} ${c.name}`);
  const spentData = state.cats.map(c => safeNum(c.spent));
  const budgetData = state.cats.map(c => safeNum(c.budget));

  // Pie (spent)
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  if(pieChart) pieChart.destroy();
  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: spentData
      }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

  // Bar (budget vs spent)
  const barCtx = document.getElementById("barChart").getContext("2d");
  if(barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label:"Budget", data: budgetData },
        { label:"Spent", data: spentData }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// ---------- Modal add category ----------
btnAddCat.addEventListener("click", () => openModal());
btnModalCancel.addEventListener("click", () => closeModal());
modal.addEventListener("click", (e) => {
  if(e.target === modal) closeModal();
});
btnModalAdd.addEventListener("click", () => {
  const name = newCatName.value.trim();
  const budget = safeNum(newCatBudget.value);
  const spent = safeNum(newCatSpent.value);

  if(!name){
    alert("Please enter category name.");
    return;
  }

  const icon = pickIconFromName(name);
  state.cats.push({
    id: crypto.randomUUID?.() ?? String(Date.now()) + Math.random(),
    name,
    icon,
    budget,
    spent
  });

  newCatName.value = "";
  newCatBudget.value = "";
  newCatSpent.value = "";

  persistState();
  closeModal();
  renderCats();
  recalcAndRender();
});

function openModal(){
  modal.classList.remove("hidden");
  newCatName.focus();
}
function closeModal(){
  modal.classList.add("hidden");
}

// ---------- Save / Reset / History ----------
btnResetMonth.addEventListener("click", () => {
  if(!confirm("Reset this month? This clears current inputs (history stays).")) return;
  state = {
    monthLabel: nowMonthDefault(),
    income: 0,
    cats: defaultCats()
  };
  persistState();
  monthLabel.value = state.monthLabel;
  incomeInput.value = "";
  monthChip.textContent = state.monthLabel;
  renderCats();
  recalcAndRender();
});

btnSaveMonth.addEventListener("click", () => {
  const t = totals();
  if(t.income <= 0){
    alert("Please enter income before saving.");
    return;
  }
  const label = (monthLabel.value.trim() || nowMonthDefault());

  const history = load(LS_KEYS.history, []);
  const entry = {
    monthLabel: label,
    income: t.income,
    cats: structuredCloneSafe(state.cats),
    totals: { allocated: t.allocated, spent: t.spent, remaining: t.remaining },
    savingsPct: t.savingsPct,
    savedAt: new Date().toISOString()
  };

  // Put newest first. If same label exists, replace.
  const filtered = history.filter(h => h.monthLabel !== label);
  filtered.unshift(entry);
  save(LS_KEYS.history, filtered);

  // Update chip & state label
  state.monthLabel = label;
  monthChip.textContent = label;
  persistState();

  renderHistory();
  recalcAndRender();
  alert("✅ Month saved to history!");
});

btnClearHistory.addEventListener("click", () => {
  if(!confirm("Clear ALL history?")) return;
  localStorage.removeItem(LS_KEYS.history);
  renderHistory();
  recalcAndRender();
});

function renderHistory(){
  const history = load(LS_KEYS.history, []);
  historyList.innerHTML = "";

  if(history.length === 0){
    historyList.innerHTML = `<div class="history-item">No history yet. Save your month to start tracking 🌸</div>`;
    return;
  }

  history.slice(0, 10).forEach((h) => {
    const spentPct = h.income > 0 ? (safeNum(h.totals?.spent) / safeNum(h.income)) * 100 : 0;
    const health = spendingHealth(spentPct);

    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="history-row">
        <div><strong>${escapeHtml(h.monthLabel)}</strong> <span class="badge ${health.cls}">${health.label}</span></div>
        <div class="muted">${new Date(h.savedAt).toLocaleDateString()}</div>
      </div>
      <div class="history-row" style="margin-top:8px;">
        <div>Income: <strong>${money(h.income)}</strong></div>
        <div>Spent: <strong>${money(h.totals?.spent)}</strong></div>
        <div>Remaining: <strong>${money(h.totals?.remaining)}</strong></div>
        <div>Savings: <strong>${pct(h.savingsPct)}</strong></div>
      </div>
      <div class="history-row" style="margin-top:10px;">
        <button class="btn ghost" data-action="load" data-month="${escapeHtmlAttr(h.monthLabel)}">Load</button>
        <button class="btn ghost" data-action="delete" data-month="${escapeHtmlAttr(h.monthLabel)}">Delete</button>
      </div>
    `;
    historyList.appendChild(div);
  });

  // attach actions
  historyList.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const month = btn.getAttribute("data-month");
      if(action === "load") loadMonth(month);
      if(action === "delete") deleteMonth(month);
    });
  });
}

function loadMonth(monthLabel){
  const history = load(LS_KEYS.history, []);
  const found = history.find(h => h.monthLabel === monthLabel);
  if(!found) return;

  state.monthLabel = found.monthLabel;
  state.income = safeNum(found.income);
  state.cats = structuredCloneSafe(found.cats || defaultCats());
  persistState();

  // update UI
  monthChip.textContent = state.monthLabel;
  $("monthLabel").value = state.monthLabel;
  $("incomeInput").value = state.income;

  renderCats();
  recalcAndRender();
}

function deleteMonth(monthLabel){
  if(!confirm(`Delete ${monthLabel} from history?`)) return;
  const history = load(LS_KEYS.history, []);
  const filtered = history.filter(h => h.monthLabel !== monthLabel);
  save(LS_KEYS.history, filtered);
  renderHistory();
  recalcAndRender();
}

// ---------- Persistence ----------
function persistState(){
  save(LS_KEYS.state, state);
}

// ---------- small helpers ----------
function pickIconFromName(name){
  const n = name.toLowerCase();
  if(n.includes("rent") || n.includes("home")) return "🏠";
  if(n.includes("groc") || n.includes("food")) return "🛒";
  if(n.includes("bill") || n.includes("util")) return "💡";
  if(n.includes("car") || n.includes("bus") || n.includes("transport")) return "🚗";
  if(n.includes("net") || n.includes("wifi") || n.includes("phone")) return "📶";
  if(n.includes("sub") || n.includes("spotify") || n.includes("netflix")) return "🎬";
  if(n.includes("gym") || n.includes("fitness")) return "🏋️";
  if(n.includes("coffee")) return "☕";
  if(n.includes("travel")) return "✈️";
  if(n.includes("save")) return "🪙";
  return "💸";
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeHtmlAttr(str){
  return escapeHtml(str).replaceAll('"',"&quot;");
}
function structuredCloneSafe(obj){
  try{
    return structuredClone(obj);
  }catch{
    return JSON.parse(JSON.stringify(obj));
  }
}

// ---------- Start ----------
bootApp();