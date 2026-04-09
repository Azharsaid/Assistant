import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, serverTimestamp, collection, addDoc,
  onSnapshot, query, orderBy, deleteDoc, updateDoc, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  user: null,
  activeView: "dashboard",
  settings: { waterGoal: 8, reduceMotion: false },
  expenses: [],
  tasks: [],
  appointments: [],
  habits: [],
  goals: [],
  notes: [],
  shopping: [],
  journal: [],
  stats: {}
};

const navItems = [
  ["dashboard","لوحة التحكم","⌂"],
  ["expenses","المصاريف","💸"],
  ["appointments","المواعيد","📅"],
  ["tasks","المهام","✅"],
  ["habits","العادات","🔥"],
  ["goals","الأهداف","🎯"],
  ["notes","الملاحظات","📝"],
  ["shopping","المشتريات","🛒"],
  ["journal","اليوميات","📔"],
  ["ai","AI","✨"],
  ["settings","الإعدادات","⚙️"]
];

const modalTemplates = {
  quickAddModal: {
    title: "إضافة سريعة",
    body: `
      <div class="form-grid">
        <button class="primary-btn" data-open-modal="expenseModal">مصروف</button>
        <button class="primary-btn" data-open-modal="taskModal">مهمة</button>
        <button class="primary-btn" data-open-modal="appointmentModal">موعد</button>
        <button class="primary-btn" data-open-modal="noteModal">ملاحظة</button>
      </div>`
  },
  expenseModal: formModal("expense", [
    field("title","اسم المصروف"),
    selectField("category","التصنيف",["أكل","مواصلات","فواتير","تسوق","ترفيه","أخرى"]),
    field("amount","المبلغ","number","full"),
    field("date","التاريخ","date"),
    field("note","ملاحظة","text","full")
  ]),
  appointmentModal: formModal("appointment", [
    field("title","عنوان الموعد"),
    field("date","التاريخ","date"),
    field("time","الوقت","time"),
    field("location","المكان"),
    field("note","ملاحظة","text","full")
  ]),
  taskModal: formModal("task", [
    field("title","اسم المهمة"),
    selectField("priority","الأولوية",["منخفضة","متوسطة","عالية"]),
    selectField("status","الحالة",["pending","in-progress","done"]),
    field("dueDate","آخر موعد","date"),
    field("note","ملاحظة","text","full")
  ]),
  habitModal: formModal("habit", [
    field("title","اسم العادة"),
    field("target","الهدف اليومي","number"),
    field("unit","الوحدة","text"),
    field("note","ملاحظة","text","full")
  ]),
  goalModal: formModal("goal", [
    field("title","اسم الهدف"),
    field("target","الهدف النهائي","number"),
    field("progress","التقدم الحالي","number"),
    field("deadline","الموعد النهائي","date"),
    field("note","ملاحظة","text","full")
  ]),
  noteModal: formModal("note", [
    field("title","العنوان"),
    field("content","المحتوى","textarea","full"),
    selectField("pinned","تثبيت",["لا","نعم"])
  ]),
  shoppingModal: formModal("shopping", [
    field("title","اسم العنصر"),
    field("quantity","الكمية","number"),
    field("category","التصنيف"),
    selectField("done","تم شراؤه؟",["لا","نعم"])
  ]),
  journalModal: formModal("journal", [
    selectField("mood","المزاج",["😴","🙂","😄","🔥","😵"]),
    field("water","عدد أكواب الماء","number"),
    field("content","ماذا حدث اليوم؟","textarea","full")
  ])
};

const els = {
  authScreen: qs("#authScreen"),
  appShell: qs("#appShell"),
  loginForm: qs("#loginForm"),
  signupForm: qs("#signupForm"),
  logoutBtn: qs("#logoutBtn"),
  sideNav: qs("#sideNav"),
  bottomNav: qs("#bottomNav"),
  mobileMenuBtn: qs("#mobileMenuBtn"),
  sidebar: qs(".sidebar"),
  modalHost: qs("#modalHost"),
  toastHost: qs("#toastHost")
};

init();

function init(){
  buildNav();
  bindGlobalUi();
  bindAuthForms();
  bindSettingsUi();
  tickClock();
  setInterval(tickClock, 1000);
  maybeRegisterServiceWorker();
  onAuthStateChanged(auth, async(user)=>{
    if(!user){
      state.user = null;
      hideApp();
      return;
    }
    state.user = user;
    showApp();
    await ensureUserProfile();
    subscribeAll();
  });
}

function buildNav(){
  const html = navItems.map(([key,label,icon]) => `
    <button class="nav-btn ${key==="dashboard"?"active":""}" data-nav="${key}">
      <span>${icon}</span><span>${label}</span>
    </button>`).join("");
  els.sideNav.innerHTML = html;
  els.bottomNav.innerHTML = html;
}

function bindGlobalUi(){
  document.addEventListener("click",(e)=>{
    const navBtn = e.target.closest("[data-nav]");
    const modalBtn = e.target.closest("[data-open-modal]");
    const modalClose = e.target.closest("[data-close-modal]");
    const deleteBtn = e.target.closest("[data-delete]");
    const toggleBtn = e.target.closest("[data-toggle]");
    const incGoalBtn = e.target.closest("[data-inc-goal]");
    const incHabitBtn = e.target.closest("[data-inc-habit]");

    if(navBtn){ navigate(navBtn.dataset.nav); if(window.innerWidth<1101) els.sidebar.classList.remove("open"); }
    if(modalBtn){ openModal(modalBtn.dataset.openModal); }
    if(modalClose){ closeModal(); }
    if(deleteBtn){ handleDelete(deleteBtn.dataset.delete, deleteBtn.dataset.id); }
    if(toggleBtn){ handleToggle(toggleBtn.dataset.toggle, toggleBtn.dataset.id); }
    if(incGoalBtn){ incrementGoal(incGoalBtn.dataset.id); }
    if(incHabitBtn){ incrementHabit(incHabitBtn.dataset.id); }
  });

  document.addEventListener("submit",(e)=>{
    const form = e.target.closest("[data-entity-form]");
    if(form){
      e.preventDefault();
      submitEntityForm(form.dataset.entityForm, new FormData(form));
    }
  });

  els.logoutBtn.addEventListener("click", async()=> {
    await signOut(auth);
    toast("تم تسجيل الخروج");
  });

  els.mobileMenuBtn.addEventListener("click", ()=> els.sidebar.classList.toggle("open"));
  qs("#refreshAiBtn").addEventListener("click", ()=> {
    renderInsights();
    toast("تم تحديث التحليل");
  });

  qs("#expenseSearch").addEventListener("input", renderExpenses);
  qs("#expenseFilter").addEventListener("change", renderExpenses);
  qs("#taskFilter").addEventListener("change", renderTasks);

  qs("#waterPlusBtn").addEventListener("click", ()=> adjustWater(1));
  qs("#waterMinusBtn").addEventListener("click", ()=> adjustWater(-1));
  qsa(".mood-btn").forEach(btn=>btn.addEventListener("click", ()=> setMood(btn.dataset.mood)));
}

function bindAuthForms(){
  qsa("[data-auth-tab]").forEach(btn => btn.addEventListener("click", ()=>{
    qsa("[data-auth-tab]").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    const login = btn.dataset.authTab === "login";
    els.loginForm.classList.toggle("hidden", !login);
    els.signupForm.classList.toggle("hidden", login);
  }));

  els.loginForm.addEventListener("submit", async(e)=>{
    e.preventDefault();
    try{
      await signInWithEmailAndPassword(auth, qs("#loginEmail").value.trim(), qs("#loginPassword").value);
      toast("أهلاً بعودتك");
    }catch(err){
      toast(parseFirebaseError(err), true);
    }
  });

  els.signupForm.addEventListener("submit", async(e)=>{
    e.preventDefault();
    try{
      const cred = await createUserWithEmailAndPassword(auth, qs("#signupEmail").value.trim(), qs("#signupPassword").value);
      await updateProfile(cred.user, { displayName: qs("#signupName").value.trim() });
      toast("تم إنشاء الحساب");
    }catch(err){
      toast(parseFirebaseError(err), true);
    }
  });
}

function bindSettingsUi(){
  qs("#saveSettingsBtn").addEventListener("click", saveSettings);
}

async function ensureUserProfile(){
  const profileRef = doc(db, "users", state.user.uid, "profile", "main");
  await setDoc(profileRef, {
    name: state.user.displayName || "مستخدم Life OS",
    email: state.user.email,
    updatedAt: serverTimestamp()
  }, { merge: true });

  const settingsRef = doc(db, "users", state.user.uid, "settings", "preferences");
  onSnapshot(settingsRef, (snap)=>{
    state.settings = { waterGoal: 8, reduceMotion: false, ...(snap.exists() ? snap.data() : {}) };
    qs("#waterGoalInput").value = state.settings.waterGoal ?? 8;
    qs("#reduceMotionToggle").checked = !!state.settings.reduceMotion;
    document.body.classList.toggle("reduce-motion", !!state.settings.reduceMotion);
    renderDashboard();
  });
}

function subscribeAll(){
  subscribeCollection("expenses", "createdAt");
  subscribeCollection("tasks", "createdAt");
  subscribeCollection("appointments", "date");
  subscribeCollection("habits", "createdAt");
  subscribeCollection("goals", "createdAt");
  subscribeCollection("notes", "createdAt");
  subscribeCollection("shopping", "createdAt");
  subscribeCollection("journal", "createdAt");
}

function subscribeCollection(name, orderField){
  const col = collection(db, "users", state.user.uid, name);
  const q = query(col, orderBy(orderField, "desc"));
  onSnapshot(q, (snap)=>{
    state[name] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderEverything();
  }, async() => {
    // fallback for fields that may not exist yet
    const snap = await getDocs(col);
    state[name] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderEverything();
  });
}

function showApp(){
  els.authScreen.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  qs("#userNameSide").textContent = state.user.displayName || "مرحبًا";
  qs("#userEmailPill").textContent = state.user.email || "";
}
function hideApp(){
  els.appShell.classList.add("hidden");
  els.authScreen.classList.remove("hidden");
}

function navigate(view){
  state.activeView = view;
  qsa(".view").forEach(v=>v.classList.remove("active-view"));
  qs(`#view-${view}`)?.classList.add("active-view");
  qsa(".nav-btn").forEach(btn=>btn.classList.toggle("active", btn.dataset.nav === view));
  qs("#pageTitle").textContent = navItems.find(n=>n[0]===view)?.[1] || "Life OS";
  qs("#pageSubtitle").textContent = subtitleMap()[view] || "نظرة منظمة على حياتك";
}

function subtitleMap(){
  return {
    dashboard:"ملخص سريع لحياتك الرقمية",
    expenses:"تابع مصاريفك وراقب الميزانية",
    appointments:"رتّب مواعيدك القادمة",
    tasks:"أنجز مهامك بوضوح",
    habits:"ابنِ عادات يومية أقوى",
    goals:"تابع أهدافك بالتدريج",
    notes:"مساحة سريعة للأفكار والملاحظات",
    shopping:"نظّم قائمة المشتريات",
    journal:"مزاجك، يومياتك، وماءك اليومي",
    ai:"تحليل ذكي لبياناتك",
    settings:"عدّل مظهر التطبيق وتفضيلاته"
  };
}

function renderEverything(){
  renderDashboard();
  renderExpenses();
  renderAppointments();
  renderTasks();
  renderHabits();
  renderGoals();
  renderNotes();
  renderShopping();
  renderJournal();
  renderInsights();
}

function renderDashboard(){
  const totalExpenses = sum(state.expenses.map(x=>Number(x.amount)||0));
  const upcomingAppointments = state.appointments.filter(a => futureDate(`${a.date || ""}T${a.time || "00:00"}`)).length;
  const pendingTasks = state.tasks.filter(t => t.status !== "done").length;
  const activeGoals = state.goals.filter(g => progressPct(g) < 100).length;
  const todayJournal = getTodayJournal();
  const habitsCompleted = state.habits.filter(h => Number(h.current || 0) >= Number(h.target || 1)).length;
  const productivityRate = state.tasks.length ? Math.round((state.tasks.filter(t=>t.status==="done").length/state.tasks.length)*100) : 0;

  state.stats = { totalExpenses, upcomingAppointments, pendingTasks, activeGoals, habitsCompleted, productivityRate };

  qs("#statsGrid").innerHTML = [
    statCard("إجمالي المصاريف", `${totalExpenses.toFixed(0)} JOD`, "💸"),
    statCard("المواعيد القادمة", upcomingAppointments, "📅"),
    statCard("المهام الحالية", pendingTasks, "✅"),
    statCard("الأهداف النشطة", activeGoals, "🎯")
  ].join("");

  qs("#waterToday").textContent = `${todayJournal.water || 0} / ${state.settings.waterGoal || 8}`;
  qs("#waterCounter").textContent = todayJournal.water || 0;
  qs("#moodToday").textContent = todayJournal.mood || "غير محدد";
  qs("#habitsCompleted").textContent = habitsCompleted;
  qs("#productivityRate").textContent = `${productivityRate}%`;

  qs("#dashboardTasks").innerHTML = compactList(state.tasks.slice(0,4), t=>`${t.title} • ${statusLabel(t.status)}`, "لا توجد مهام");
  qs("#dashboardExpenses").innerHTML = compactList(state.expenses.slice(0,4), e=>`${e.title} • ${e.amount} JOD`, "لا توجد مصاريف");
  qs("#dashboardAppointments").innerHTML = compactList(state.appointments.slice(0,4), a=>`${a.title} • ${a.date || "-"}`, "لا توجد مواعيد");
  qs("#dashboardGoals").innerHTML = compactList(state.goals.slice(0,4), g=>`${g.title} • ${progressPct(g)}%`, "لا توجد أهداف");

  drawExpenseChart();
}

function renderExpenses(){
  const search = qs("#expenseSearch").value.trim().toLowerCase();
  const filter = qs("#expenseFilter").value;
  let items = [...state.expenses];
  if(filter !== "all") items = items.filter(x => x.category === filter);
  if(search) items = items.filter(x => `${x.title} ${x.note||""}`.toLowerCase().includes(search));
  qs("#expensesList").innerHTML = items.length ? items.map(expenseCard).join("") : emptyCard("لا توجد مصاريف مطابقة");
}
function renderAppointments(){
  const items = [...state.appointments].sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  qs("#appointmentsList").innerHTML = items.length ? items.map(appointmentCard).join("") : emptyCard("لا توجد مواعيد");
}
function renderTasks(){
  const filter = qs("#taskFilter").value;
  let items = [...state.tasks];
  if(filter !== "all") items = items.filter(t => t.status === filter);
  qs("#tasksList").innerHTML = items.length ? items.map(taskCard).join("") : emptyCard("لا توجد مهام");
}
function renderHabits(){
  qs("#habitsList").innerHTML = state.habits.length ? state.habits.map(habitCard).join("") : emptyCard("لا توجد عادات");
}
function renderGoals(){
  qs("#goalsList").innerHTML = state.goals.length ? state.goals.map(goalCard).join("") : emptyCard("لا توجد أهداف");
}
function renderNotes(){
  qs("#notesList").innerHTML = state.notes.length ? state.notes.sort((a,b)=>(b.pinned==="نعم")-(a.pinned==="نعم")).map(noteCard).join("") : emptyCard("لا توجد ملاحظات");
}
function renderShopping(){
  qs("#shoppingList").innerHTML = state.shopping.length ? state.shopping.map(shoppingCard).join("") : emptyCard("لا توجد عناصر");
}
function renderJournal(){
  const today = getTodayJournal();
  qsa(".mood-btn").forEach(btn=>btn.classList.toggle("active", btn.dataset.mood === today.mood));
  qs("#journalList").innerHTML = state.journal.length ? state.journal.map(journalCard).join("") : emptyCard("لا توجد يوميات");
}
function renderInsights(){
  const insights = buildInsights();
  qs("#insightsList").innerHTML = insights.map(i=>`<div class="insight-card"><strong>${i.title}</strong><div>${i.text}</div></div>`).join("");
  qs("#aiDeepInsights").innerHTML = insights.map(i=>`<div class="insight-card"><strong>${i.title}</strong><div>${i.text}</div></div>`).join("");
  qs("#sideInsightText").textContent = insights[0]?.text || "ابدأ بإضافة بياناتك لتظهر لك الاقتراحات الذكية هنا.";
}

function buildInsights(){
  const todayJournal = getTodayJournal();
  const insights = [];
  const monthlyExpense = sum(state.expenses.filter(x => sameMonth(x.date)).map(x=>Number(x.amount)||0));
  const foodExpense = sum(state.expenses.filter(x => x.category === "أكل" && sameMonth(x.date)).map(x=>Number(x.amount)||0));
  const dueSoon = state.tasks.filter(t => t.status !== "done" && t.dueDate && daysDiff(t.dueDate) <= 2).length;
  const doneTasks = state.tasks.filter(t => t.status === "done").length;
  const pendingTasks = state.tasks.filter(t => t.status !== "done").length;
  const nextAppointment = [...state.appointments].filter(a=>futureDate(`${a.date}T${a.time||"00:00"}`)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];

  insights.push({
    title:"ملخص اليوم",
    text: nextAppointment ? `عندك موعد قريب بعنوان "${nextAppointment.title}" بتاريخ ${fmtDate(nextAppointment.date)}${nextAppointment.time ? ` الساعة ${nextAppointment.time}` : ""}.` : "لا توجد مواعيد قريبة، وهذا وقت ممتاز لإنهاء المهام المهمة."
  });
  insights.push({
    title:"التركيز والإنتاجية",
    text: pendingTasks ? `لديك ${pendingTasks} مهمة غير مكتملة، منها ${dueSoon} مستعجلة خلال يومين. ابدأ بالأولوية العالية أولًا.` : "رائع، لا توجد مهام معلقة حاليًا."
  });
  insights.push({
    title:"الميزانية",
    text: monthlyExpense ? `إجمالي مصاريف هذا الشهر ${monthlyExpense.toFixed(0)} JOD، ومصاريف الأكل ${foodExpense.toFixed(0)} JOD.` : "لم تسجل مصاريف هذا الشهر بعد."
  });
  insights.push({
    title:"العادات",
    text: state.habits.length ? `أكملت ${state.stats.habitsCompleted || 0} من أصل ${state.habits.length} عادة اليوم.` : "أضف عادة يومية مثل القراءة أو المشي لتبدأ تتبع التقدم."
  });
  insights.push({
    title:"الماء والمزاج",
    text: `شربت اليوم ${todayJournal.water || 0} من ${state.settings.waterGoal || 8} أكواب. مزاجك الحالي: ${todayJournal.mood || "غير محدد"}.`
  });
  insights.push({
    title:"الأهداف",
    text: state.goals.length ? `لديك ${state.goals.length} هدف، وأكثرها تقدمًا هو "${bestGoal()?.title || "-"}".` : "أضف هدفًا واضحًا لتحويل الخطة إلى إنجاز."
  });

  return insights;
}

function statCard(label, value, icon){
  return `<div class="stat-card glass"><div class="row"><span class="badge">${icon}</span><span class="stat-label">${label}</span></div><div class="stat-value">${value}</div></div>`;
}
function compactList(items, mapFn, emptyText){
  return items.length ? items.map(item => `<div class="list-item">${mapFn(item)}</div>`).join("") : `<div class="list-item empty">${emptyText}</div>`;
}
function emptyCard(text){ return `<div class="module-card empty">${text}</div>`; }

function expenseCard(x){
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">${x.category || "أخرى"} • ${fmtDate(x.date)}</div></div><div><strong>${Number(x.amount||0).toFixed(2)} JOD</strong></div></div>
    ${x.note ? `<div class="muted" style="margin-top:10px">${escapeHtml(x.note)}</div>`:""}
    <div class="card-actions" style="margin-top:12px"><button class="action-btn danger" data-delete="expenses" data-id="${x.id}">حذف</button></div>
  </div>`;
}
function appointmentCard(x){
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">${fmtDate(x.date)} ${x.time || ""} • ${escapeHtml(x.location||"")}</div></div><span class="badge">${futureDate(`${x.date}T${x.time||"00:00"}`) ? "قادم" : "منتهي"}</span></div>
    ${x.note ? `<div class="muted" style="margin-top:10px">${escapeHtml(x.note)}</div>`:""}
    <div class="card-actions" style="margin-top:12px"><button class="action-btn danger" data-delete="appointments" data-id="${x.id}">حذف</button></div>
  </div>`;
}
function taskCard(x){
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">${priorityColorDot(x.priority)} ${x.priority || "متوسطة"} • ${statusLabel(x.status)} • ${fmtDate(x.dueDate)}</div></div><span class="badge">${statusLabel(x.status)}</span></div>
    ${x.note ? `<div class="muted" style="margin-top:10px">${escapeHtml(x.note)}</div>`:""}
    <div class="card-actions" style="margin-top:12px">
      <button class="action-btn" data-toggle="tasks" data-id="${x.id}">${x.status === "done" ? "إرجاع" : "تمت"}</button>
      <button class="action-btn danger" data-delete="tasks" data-id="${x.id}">حذف</button>
    </div>
  </div>`;
}
function habitCard(x){
  const pct = Math.min(100, Math.round(((Number(x.current||0))/(Number(x.target||1)))*100));
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">الهدف: ${x.target||1} ${escapeHtml(x.unit||"")}</div></div><span class="badge">Streak ${x.streak || 0}</span></div>
    ${x.note ? `<div class="muted" style="margin-top:10px">${escapeHtml(x.note)}</div>`:""}
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="row" style="margin-top:12px"><span>${x.current||0} / ${x.target||1}</span><div class="card-actions"><button class="action-btn" data-inc-habit data-id="${x.id}">+1</button><button class="action-btn danger" data-delete="habits" data-id="${x.id}">حذف</button></div></div>
  </div>`;
}
function goalCard(x){
  const pct = progressPct(x);
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">${fmtDate(x.deadline)} • ${x.progress||0}/${x.target||0}</div></div><span class="badge">${pct}%</span></div>
    ${x.note ? `<div class="muted" style="margin-top:10px">${escapeHtml(x.note)}</div>`:""}
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="card-actions" style="margin-top:12px"><button class="action-btn" data-inc-goal data-id="${x.id}">تقدم +1</button><button class="action-btn danger" data-delete="goals" data-id="${x.id}">حذف</button></div>
  </div>`;
}
function noteCard(x){
  return `<div class="note-card">
    <div class="row"><div class="card-title">${escapeHtml(x.title)}</div>${x.pinned==="نعم"?'<span class="badge">مثبتة</span>':""}</div>
    <div class="muted" style="margin-top:10px;white-space:pre-wrap">${escapeHtml(x.content||"")}</div>
    <div class="card-actions" style="margin-top:12px"><button class="action-btn danger" data-delete="notes" data-id="${x.id}">حذف</button></div>
  </div>`;
}
function shoppingCard(x){
  return `<div class="module-card">
    <div class="row"><div><div class="card-title">${escapeHtml(x.title)}</div><div class="muted">${escapeHtml(x.category||"")} • الكمية: ${x.quantity||1}</div></div><span class="badge">${x.done==="نعم" ? "تم" : "قيد الشراء"}</span></div>
    <div class="card-actions" style="margin-top:12px"><button class="action-btn" data-toggle="shopping" data-id="${x.id}">${x.done==="نعم"?"غير مكتمل":"تم الشراء"}</button><button class="action-btn danger" data-delete="shopping" data-id="${x.id}">حذف</button></div>
  </div>`;
}
function journalCard(x){
  return `<div class="note-card">
    <div class="row"><div class="card-title">${x.mood || "🙂"} ${fmtDate(x.date)}</div><span class="badge">${x.water||0} أكواب</span></div>
    <div class="muted" style="margin-top:10px;white-space:pre-wrap">${escapeHtml(x.content||"")}</div>
    <div class="card-actions" style="margin-top:12px"><button class="action-btn danger" data-delete="journal" data-id="${x.id}">حذف</button></div>
  </div>`;
}

function openModal(key){
  const t = modalTemplates[key];
  if(!t) return;
  els.modalHost.innerHTML = `
    <div class="modal-overlay" data-close-modal>
      <div class="modal glass" onclick="event.stopPropagation()">
        <div class="panel-head"><h3>${t.title}</h3><button class="ghost-btn" data-close-modal>إغلاق</button></div>
        ${t.body}
      </div>
    </div>`;
}
function closeModal(){ els.modalHost.innerHTML = ""; }

function formModal(entity, fields){
  return {
    title: labels()[entity],
    body: `<form data-entity-form="${entity}">
      <div class="form-grid">${fields.join("")}</div>
      <div class="form-actions"><button type="button" class="ghost-btn" data-close-modal>إلغاء</button><button class="primary-btn" type="submit">حفظ</button></div>
    </form>`
  };
}
function field(name,label,type="text",extra=""){
  if(type==="textarea"){
    return `<div class="${extra || "full"}"><label>${label}</label><textarea name="${name}" required></textarea></div>`;
  }
  return `<div class="${extra}"><label>${label}</label><input name="${name}" type="${type}" required /></div>`;
}
function selectField(name,label,options){
  return `<div><label>${label}</label><select name="${name}">${options.map(o=>`<option>${o}</option>`).join("")}</select></div>`;
}
function labels(){
  return {
    expense:"إضافة مصروف",
    appointment:"إضافة موعد",
    task:"إضافة مهمة",
    habit:"إضافة عادة",
    goal:"إضافة هدف",
    note:"إضافة ملاحظة",
    shopping:"إضافة عنصر مشتريات",
    journal:"إضافة يومية"
  };
}

async function submitEntityForm(entity, formData){
  const payload = Object.fromEntries(formData.entries());
  const colMap = {
    expense:"expenses", appointment:"appointments", task:"tasks",
    habit:"habits", goal:"goals", note:"notes", shopping:"shopping", journal:"journal"
  };
  const collectionName = colMap[entity];
  if(!collectionName || !state.user) return;
  const data = normalizeEntity(entity, payload);
  try{
    await addDoc(collection(db, "users", state.user.uid, collectionName), data);
    toast("تم الحفظ بنجاح");
    closeModal();
  }catch(err){
    toast("فشل الحفظ", true);
    console.error(err);
  }
}

function normalizeEntity(entity, data){
  const base = { createdAt: new Date().toISOString() };
  if(entity==="expense") return { ...base, ...data, amount:Number(data.amount||0) };
  if(entity==="task") return { ...base, ...data };
  if(entity==="habit") return { ...base, ...data, target:Number(data.target||1), current:0, streak:0 };
  if(entity==="goal") return { ...base, ...data, target:Number(data.target||0), progress:Number(data.progress||0) };
  if(entity==="shopping") return { ...base, ...data, quantity:Number(data.quantity||1) };
  if(entity==="journal") return { ...base, ...data, date: todayStr(), water:Number(data.water||0) };
  return { ...base, ...data };
}

async function handleDelete(collectionName, id){
  if(!state.user) return;
  if(!confirm("هل تريد الحذف؟")) return;
  await deleteDoc(doc(db, "users", state.user.uid, collectionName, id));
  toast("تم الحذف");
}
async function handleToggle(collectionName, id){
  const item = state[collectionName].find(x=>x.id===id);
  if(!item) return;
  if(collectionName==="tasks"){
    const next = item.status === "done" ? "pending" : "done";
    await updateDoc(doc(db, "users", state.user.uid, "tasks", id), { status: next });
  }
  if(collectionName==="shopping"){
    const next = item.done === "نعم" ? "لا" : "نعم";
    await updateDoc(doc(db, "users", state.user.uid, "shopping", id), { done: next });
  }
}
async function incrementGoal(id){
  const item = state.goals.find(x=>x.id===id); if(!item) return;
  await updateDoc(doc(db, "users", state.user.uid, "goals", id), { progress: Number(item.progress||0)+1 });
}
async function incrementHabit(id){
  const item = state.habits.find(x=>x.id===id); if(!item) return;
  const nextCurrent = Number(item.current||0)+1;
  const nextStreak = nextCurrent >= Number(item.target||1) ? Number(item.streak||0)+1 : Number(item.streak||0);
  await updateDoc(doc(db, "users", state.user.uid, "habits", id), { current: nextCurrent, streak: nextStreak });
}

function getTodayJournal(){
  return state.journal.find(j => j.date === todayStr()) || { date: todayStr(), water:0, mood:"" };
}
async function adjustWater(delta){
  if(!state.user) return;
  const current = getTodayJournal();
  const next = Math.max(0, Number(current.water||0)+delta);
  if(current.id){
    await updateDoc(doc(db, "users", state.user.uid, "journal", current.id), { water: next });
  }else{
    await addDoc(collection(db, "users", state.user.uid, "journal"), { createdAt:new Date().toISOString(), date:todayStr(), water:next, mood:"", content:"" });
  }
}
async function setMood(mood){
  if(!state.user) return;
  const current = getTodayJournal();
  if(current.id){
    await updateDoc(doc(db, "users", state.user.uid, "journal", current.id), { mood });
  }else{
    await addDoc(collection(db, "users", state.user.uid, "journal"), { createdAt:new Date().toISOString(), date:todayStr(), water:0, mood, content:"" });
  }
}

async function saveSettings(){
  if(!state.user) return;
  const payload = {
    waterGoal: Number(qs("#waterGoalInput").value || 8),
    reduceMotion: qs("#reduceMotionToggle").checked,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(db, "users", state.user.uid, "settings", "preferences"), payload, { merge:true });
  toast("تم حفظ الإعدادات");
}

let expenseChart;
function drawExpenseChart(){
  const el = qs("#expenseChart");
  if(!window.Chart || !el) return;
  const byCat = ["أكل","مواصلات","فواتير","تسوق","ترفيه","أخرى"].map(cat => ({
    cat, total: sum(state.expenses.filter(x=>x.category===cat).map(x=>Number(x.amount)||0))
  }));
  if(expenseChart) expenseChart.destroy();
  expenseChart = new Chart(el.getContext("2d"), {
    type:"bar",
    data:{
      labels: byCat.map(x=>x.cat),
      datasets:[{ label:"JOD", data: byCat.map(x=>x.total), borderRadius:12 }]
    },
    options:{
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:"#d6def7" }, grid:{ display:false } },
        y:{ ticks:{ color:"#d6def7" }, grid:{ color:"rgba(255,255,255,.08)" } }
      }
    }
  });
}

function maybeRegisterServiceWorker(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

function tickClock(){
  const now = new Date();
  qs("#clockPill").textContent = now.toLocaleString("en-GB", { hour12:true });
}

function parseFirebaseError(err){
  const code = err?.code || "";
  if(code.includes("invalid-credential")) return "البيانات غير صحيحة.";
  if(code.includes("email-already-in-use")) return "البريد مستخدم مسبقًا.";
  if(code.includes("weak-password")) return "كلمة المرور ضعيفة.";
  return "حدث خطأ، حاول مرة أخرى.";
}

function statusLabel(status){
  return ({ "pending":"قيد الانتظار", "in-progress":"قيد التنفيذ", "done":"مكتملة" })[status] || status || "-";
}
function priorityColorDot(priority){ return priority ? `●` : ""; }
function progressPct(g){ return Math.min(100, Math.round((Number(g.progress||0)/(Number(g.target||1)))*100)); }
function bestGoal(){ return [...state.goals].sort((a,b)=>progressPct(b)-progressPct(a))[0]; }
function sameMonth(dateStr){
  if(!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth();
}
function futureDate(dateTime){
  if(!dateTime) return false;
  return new Date(dateTime).getTime() >= Date.now();
}
function daysDiff(dateStr){
  return Math.ceil((new Date(dateStr).getTime() - Date.now())/(1000*60*60*24));
}
function fmtDate(dateStr){
  if(!dateStr) return "-";
  const d = new Date(dateStr);
  if(Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}
function todayStr(){ return new Date().toISOString().slice(0,10); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function escapeHtml(str){ return String(str ?? "").replace(/[&<>"']/g, s => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s])); }
function toast(text, isError=false){
  const el = document.createElement("div");
  el.className = "toast";
  el.style.borderColor = isError ? "rgba(251,113,133,.35)" : "rgba(110,231,255,.25)";
  el.textContent = text;
  els.toastHost.appendChild(el);
  setTimeout(()=>el.remove(), 2600);
}
function qs(s){ return document.querySelector(s); }
function qsa(s){ return [...document.querySelectorAll(s)]; }
