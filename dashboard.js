import { supabase, emailToUsername, isAdminUsername } from "./lib/auth.js";

requestAnimationFrame(() => {
  document.body.classList.add("page-entered");
});

const ENABLE_LIGHTWEIGHT_UI = true;
if (ENABLE_LIGHTWEIGHT_UI) {
  document.body.classList.add("lite-ui");
}

const adminLabel = document.getElementById("admin-label");
const statusEl = document.getElementById("dashboard-status");

const studentPickerViewEl = document.getElementById("student-picker-view");
const studentDetailViewEl = document.getElementById("student-detail-view");
const backToStudentsBtn = document.getElementById("back-to-students-btn");

const studentsCountEl = document.getElementById("students-count");
const studentsListEl = document.getElementById("students-list");
const studentSearchEl = document.getElementById("student-search");
const selectedStudentNameEl = document.getElementById("selected-student-name");
const completedCountEl = document.getElementById("completed-count");
const achievementsCountEl = document.getElementById("achievements-count");
const achievementsSummaryBtn = document.getElementById("achievements-summary-btn");
const achievementsDetailPanelEl = document.getElementById("achievements-detail-panel");
const closeAchievementsDetailBtn = document.getElementById("close-achievements-detail-btn");
const achievementsDetailTitleEl = document.getElementById("achievements-detail-title");
const achievementsDetailListEl = document.getElementById("achievements-detail-list");
const achievementsDetailCardEl = achievementsDetailPanelEl?.querySelector(".achievements-modal-card") || null;

const javaQuizLevelsEl = document.getElementById("java-quiz-levels");
const javaPuzzleLevelsEl = document.getElementById("java-puzzle-levels");
const csharpQuizLevelsEl = document.getElementById("csharp-quiz-levels");
const csharpPuzzleLevelsEl = document.getElementById("csharp-puzzle-levels");

const selectedLevelNameEl = document.getElementById("selected-level-name");
const levelCompletionEl = document.getElementById("level-completion");
const levelFailedAttemptsEl = document.getElementById("level-failed-attempts");
const levelHintsUsedEl = document.getElementById("level-hints-used");

const languageButtonsEl = document.getElementById("language-buttons");
const levelButtonsEl = document.getElementById("level-buttons");
const questionCountBadgeEl = document.getElementById("question-count-badge");
const removeQuestionBtn = document.getElementById("remove-question-btn");
const addQuestionBtn = document.getElementById("add-question-btn");
const saveLayoutBtn = document.getElementById("save-layout-btn");
const questionEditorList = document.getElementById("question-editor-list");
const menuToggleBtn = document.getElementById("menu-toggle");
const dashboardMenu = document.getElementById("dashboard-menu");
const pageLoader = document.getElementById("page-loader");
const pageLoaderText = document.getElementById("page-loader-text");
const TRANSITION_DELAY_MS = 520;

const QUIZ_MIN = 1;
const QUIZ_MAX = 5;
const LANGUAGES = [
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
];
const LEVELS = [1, 2, 3];
const CHOICE_LETTERS = ["A", "B", "C", "D"];
const FALLBACK_ACHIEVEMENT_CATALOG = [
  {
    id: 1,
    code: "first_steps",
    title: "First Steps",
    description: "Complete your first quiz level",
  },
  {
    id: 2,
    code: "csharp_beginner",
    title: "CSharp Master",
    description: "Complete CSharp Quiz Level 3",
  },
  {
    id: 3,
    code: "java_beginner",
    title: "Java Master",
    description: "Complete Java Quiz Level 3",
  },
  {
    id: 4,
    code: "perfect_answer",
    title: "Perfect Solve",
    description: "Complete 2 puzzles without using hints",
  },
  {
    id: 5,
    code: "efficient_learner",
    title: "Efficient Learner",
    description: "Complete 3 levels with 3 or fewer wrong attempts",
  },
  {
    id: 6,
    code: "quiz_master",
    title: "Quiz Master",
    description: "Complete all quiz levels",
  },
];

const editorState = {
  language: "java",
  level: 1,
};

const quizEditorStore = {};

const dashboardParts = Array.from(document.querySelectorAll(".dashboard-part"));
const menuLinks = Array.from(document.querySelectorAll(".menu-link"));

const LEVEL_GROUPS = {
  java: {
    quiz: ["java_quiz_1", "java_quiz_2", "java_quiz_3"],
    puzzle: ["java_puzzle_1", "java_puzzle_2", "java_puzzle_3"],
  },
  csharp: {
    quiz: ["csharp_quiz_1", "csharp_quiz_2", "csharp_quiz_3"],
    puzzle: ["csharp_puzzle_1", "csharp_puzzle_2", "csharp_puzzle_3"],
  },
};

const statsState = {
  students: [],
  studentsFingerprint: "",
  studentSearch: "",
  selectedStudentId: null,
  selectedStudentLabel: "-",
  selectedLevelKey: "java_quiz_1",
  progressByLevel: {},
  metricsByLevel: {},
  unlockedAchievements: [],
  achievementCatalog: [],
  achievementCatalogLoaded: false,
};

const LIVE_REFRESH_DEBOUNCE_MS = 500;
const FALLBACK_POLL_MS = 6000;
let activeDashboardPartId = "stats-part";
const liveState = {
  adminUser: null,
  channel: null,
  refreshTimer: null,
  refreshInFlight: false,
  refreshQueued: false,
  pollIntervalId: null,
  visibilityHandler: null,
};

function buildStudentsFingerprint(students) {
  return students
    .map((student) => `${student.id}:${student.label}`)
    .sort()
    .join("|");
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getVisibleStudents() {
  const query = normalizeSearchText(statsState.studentSearch);
  if (!query) {
    return statsState.students;
  }

  return statsState.students.filter((student) => normalizeSearchText(student.searchText || student.label).includes(query));
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${kind}`.trim();
}

function asNumber(value) {
  return Number(value || 0);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function redirectToLogin() {
  window.location.href = "./index.html";
}

function redirectToLoginAnimated() {
  if (pageLoaderText) {
    pageLoaderText.textContent = "Signing out...";
  }
  pageLoader?.classList.remove("hidden");
  document.body.classList.add("page-leaving");
  window.setTimeout(() => {
    window.location.href = "./index.html";
  }, TRANSITION_DELAY_MS);
}

function animateIn(element) {
  if (!element) return;
  if (ENABLE_LIGHTWEIGHT_UI) return;
  element.classList.remove("screen-animate");
  void element.offsetWidth;
  element.classList.add("screen-animate");
}

function flattenMainLevelKeys() {
  return [
    ...LEVEL_GROUPS.java.quiz,
    ...LEVEL_GROUPS.java.puzzle,
    ...LEVEL_GROUPS.csharp.quiz,
    ...LEVEL_GROUPS.csharp.puzzle,
  ];
}

function toLevelLabel(levelKey) {
  if (!levelKey) return "-";
  const parts = levelKey.split("_");
  if (parts.length < 3) return levelKey;

  const languageLabel = parts[0] === "csharp" ? "C#" : "Java";
  const typeLabel = parts[1] === "puzzle" ? "Puzzle" : "Quiz";
  const levelNo = parts[2];
  const isCheckpoint = levelKey.endsWith("_p1");
  return isCheckpoint
    ? `${languageLabel} ${typeLabel} Level ${levelNo} Problem 1`
    : `${languageLabel} ${typeLabel} Level ${levelNo}`;
}

function getMetricForLevel(levelKey) {
  return (
    statsState.metricsByLevel[levelKey] || {
      failed_attempts_total: 0,
      hints_used_total: 0,
    }
  );
}

function renderStudents() {
  const visibleStudents = getVisibleStudents();
  const totalStudents = statsState.students.length;
  studentsCountEl.textContent = statsState.studentSearch ? `${visibleStudents.length}/${totalStudents}` : String(totalStudents);

  if (totalStudents === 0) {
    studentsListEl.innerHTML = "<p class='muted'>No students available.</p>";
    return;
  }

  if (visibleStudents.length === 0) {
    studentsListEl.innerHTML = "<p class='muted'>No students match that search.</p>";
    return;
  }

  studentsListEl.innerHTML = visibleStudents
    .map((student) => {
      const label = student.label || "student";
      const initials = label.slice(0, 1).toUpperCase();
      const shortId = String(student.id).slice(0, 8);
      const activeClass = student.id === statsState.selectedStudentId ? "active" : "";
      return `
        <button type="button" class="student-btn ${activeClass}" data-student-id="${student.id}">
          <span class="student-main">
            <span class="student-avatar">${escapeHtml(initials)}</span>
            <span class="student-meta">
              <strong>${escapeHtml(label)}</strong>
              <small>ID ${escapeHtml(shortId)}</small>
            </span>
          </span>
          <span class="student-open">Open</span>
        </button>
      `;
    })
    .join("");
}

function showStudentPickerView() {
  studentPickerViewEl.classList.remove("hidden");
  studentDetailViewEl.classList.add("hidden");
  closeAchievementDetailPanel();
  animateIn(studentPickerViewEl);
}

function showStudentDetailView() {
  studentPickerViewEl.classList.add("hidden");
  studentDetailViewEl.classList.remove("hidden");
  animateIn(studentDetailViewEl);
}

function renderLevelGroup(containerEl, levelKeys) {
  containerEl.innerHTML = levelKeys
    .map((levelKey) => {
      const done = Boolean(statsState.progressByLevel[levelKey]);
      const active = statsState.selectedLevelKey === levelKey;
      const statusLabel = done ? "Completed" : "Not done";
      const cls = `${done ? "done" : "not-done"} ${active ? "active" : ""}`;
      return `
        <button type="button" class="level-chip ${cls}" data-level-key="${levelKey}">
          <span>${escapeHtml(toLevelLabel(levelKey))}</span>
          <span class="status-pill">${statusLabel}</span>
        </button>
      `;
    })
    .join("");
}

function renderAllLevelGroups() {
  renderLevelGroup(javaQuizLevelsEl, LEVEL_GROUPS.java.quiz);
  renderLevelGroup(javaPuzzleLevelsEl, LEVEL_GROUPS.java.puzzle);
  renderLevelGroup(csharpQuizLevelsEl, LEVEL_GROUPS.csharp.quiz);
  renderLevelGroup(csharpPuzzleLevelsEl, LEVEL_GROUPS.csharp.puzzle);
}

function renderLevelDetail() {
  const key = statsState.selectedLevelKey;
  if (!key) {
    selectedLevelNameEl.textContent = "Select a level";
    levelCompletionEl.textContent = "-";
    levelFailedAttemptsEl.textContent = "0";
    levelHintsUsedEl.textContent = "0";
    return;
  }

  selectedLevelNameEl.textContent = toLevelLabel(key);
  const done = Boolean(statsState.progressByLevel[key]);
  const metric = getMetricForLevel(key);

  levelCompletionEl.textContent = done ? "Completed" : "Not done";
  levelFailedAttemptsEl.textContent = String(asNumber(metric.failed_attempts_total));
  levelHintsUsedEl.textContent = String(asNumber(metric.hints_used_total));
}

function renderStudentSummary() {
  selectedStudentNameEl.textContent = statsState.selectedStudentLabel || "-";

  const completedCount = flattenMainLevelKeys().filter((key) => Boolean(statsState.progressByLevel[key])).length;
  completedCountEl.textContent = String(completedCount);
  achievementsCountEl.textContent = String(statsState.unlockedAchievements.length);
  achievementsSummaryBtn?.setAttribute("aria-expanded", String(!achievementsDetailPanelEl?.classList.contains("hidden")));

  if (achievementsDetailPanelEl && !achievementsDetailPanelEl.classList.contains("hidden")) {
    renderAchievementDetailPanel();
  }

  renderAllLevelGroups();
  renderLevelDetail();
}

function normalizeAchievementCatalog(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return FALLBACK_ACHIEVEMENT_CATALOG;
  }

  return rows.map((row, index) => ({
    id: Number(row?.id || index + 1),
    code: String(row?.code || "").trim(),
    title: String(row?.title || row?.code || `Achievement ${index + 1}`).trim(),
    description: String(row?.description || "").trim(),
  }));
}

async function ensureAchievementCatalog() {
  if (statsState.achievementCatalogLoaded && statsState.achievementCatalog.length > 0) {
    return;
  }

  const catalogRes = await supabase.from("achievements").select("id,code,title,description").order("id", { ascending: true });
  if (catalogRes.error) {
    statsState.achievementCatalog = FALLBACK_ACHIEVEMENT_CATALOG;
    statsState.achievementCatalogLoaded = false;
    return;
  }

  statsState.achievementCatalog = normalizeAchievementCatalog(catalogRes.data || []);
  statsState.achievementCatalogLoaded = true;
}

function getUnlockedAchievementIdSet() {
  const ids = statsState.unlockedAchievements
    .map((row) => Number(row?.achievement_id))
    .filter((value) => Number.isFinite(value) && value > 0);
  return new Set(ids);
}

function getUnlockedAchievementCodeSet() {
  const codes = statsState.unlockedAchievements
    .map((row) => String(row?.achievements?.code || "").trim())
    .filter(Boolean);
  return new Set(codes);
}

function renderAchievementDetailPanel() {
  if (!achievementsDetailTitleEl || !achievementsDetailListEl) {
    return;
  }

  const studentName = statsState.selectedStudentLabel || "Student";
  achievementsDetailTitleEl.textContent = `${studentName} Achievements`;

  const catalog = statsState.achievementCatalog.length > 0 ? statsState.achievementCatalog : FALLBACK_ACHIEVEMENT_CATALOG;
  const unlockedIds = getUnlockedAchievementIdSet();
  const unlockedCodes = getUnlockedAchievementCodeSet();

  achievementsDetailListEl.innerHTML = catalog
    .map((achievement) => {
      const unlocked = unlockedIds.has(Number(achievement.id)) || unlockedCodes.has(String(achievement.code));
      const rowClass = unlocked ? "unlocked" : "locked";
      const stateLabel = unlocked ? "Completed" : "Locked";
      const title = escapeHtml(achievement.title || achievement.code || "Achievement");
      const description = escapeHtml(achievement.description || "No description available.");

      return `
        <article class="achievement-row ${rowClass}">
          <div>
            <strong>${title}</strong>
            <p>${description}</p>
          </div>
          <span class="achievement-state">${stateLabel}</span>
        </article>
      `;
    })
    .join("");
}

function closeAchievementDetailPanel() {
  if (!achievementsDetailPanelEl) {
    return;
  }
  achievementsDetailPanelEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
  achievementsSummaryBtn?.setAttribute("aria-expanded", "false");
}

function openAchievementDetailPanel() {
  if (!achievementsDetailPanelEl) {
    return;
  }
  if (!statsState.selectedStudentId) {
    setStatus("Select a student first.", "error");
    return;
  }

  document.body.classList.add("modal-open");
  renderAchievementDetailPanel();
  achievementsDetailPanelEl.classList.remove("hidden");
  achievementsSummaryBtn?.setAttribute("aria-expanded", "true");
  closeAchievementsDetailBtn?.focus();
}

async function loadStudentList(adminUser, options = {}) {
  const { silent = false } = options;
  let students = [];
  const adminId = adminUser?.id || "";

  const profilesRes = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .order("username", { ascending: true });

  if (!profilesRes.error && profilesRes.data?.length) {
    students = profilesRes.data
      .map((row) => {
        const username = String(row.username || "").trim();
        const displayName = String(row.display_name || "").trim();
        const label = displayName || username || `student_${String(row.id).slice(0, 6)}`;
        const searchText = [label, username, displayName].filter(Boolean).join(" ");

        return {
          id: row.id,
          label,
          searchText,
        };
      })
      .filter((student) => student.id !== adminId && !isAdminUsername(student.label));
  }

  if (students.length === 0) {
    const fallbackRes = await supabase.from("user_level_progress").select("user_id");
    if (!fallbackRes.error && fallbackRes.data?.length) {
      const seen = new Set();
      students = fallbackRes.data
        .map((row) => row.user_id)
        .filter((id) => {
          if (!id || seen.has(id) || id === adminId) return false;
          seen.add(id);
          return true;
        })
        .map((id) => {
          const label = `student_${String(id).slice(0, 6)}`;
          return { id, label, searchText: label };
        });
    }
  }

  const newFingerprint = buildStudentsFingerprint(students);
  const studentsChanged = newFingerprint !== statsState.studentsFingerprint;
  statsState.students = students;
  statsState.studentsFingerprint = newFingerprint;

  if (studentsChanged || !silent) {
    renderStudents();
  }

  if (silent) {
    return;
  }

  if (students.length > 0) {
    setStatus("Student records loaded.", "ok");
  } else {
    setStatus("No student records found (admin excluded).", "error");
  }
}

async function selectStudent(studentId, options = {}) {
  const { silent = false, openDetail = true } = options;
  const selected = statsState.students.find((student) => student.id === studentId);
  if (!selected) return;

  await ensureAchievementCatalog();

  statsState.selectedStudentId = studentId;
  statsState.selectedStudentLabel = selected.label;
  if (!silent) {
    renderStudents();
  }

  const [progressRes, metricsRes, userAchievementsRes] = await Promise.all([
    supabase.from("user_level_progress").select("level_key,completed").eq("user_id", studentId),
    supabase
      .from("user_level_metrics")
      .select("level_key,failed_attempts_total,hints_used_total")
      .eq("user_id", studentId),
    supabase.from("user_achievements").select("achievement_id,achievements(code)").eq("user_id", studentId),
  ]);

  if (progressRes.error || metricsRes.error || userAchievementsRes.error) {
    if (!silent) {
      setStatus("Could not load selected student stats. Check table policies for admin access.", "error");
    }
    statsState.progressByLevel = {};
    statsState.metricsByLevel = {};
    statsState.unlockedAchievements = [];
    renderStudentSummary();
    return;
  }

  const progressMap = {};
  for (const row of progressRes.data || []) {
    progressMap[row.level_key] = Boolean(row.completed);
  }

  const metricsMap = {};
  for (const row of metricsRes.data || []) {
    metricsMap[row.level_key] = {
      failed_attempts_total: asNumber(row.failed_attempts_total),
      hints_used_total: asNumber(row.hints_used_total),
    };
  }

  const unlockedAchievements = userAchievementsRes.data || [];

  statsState.progressByLevel = progressMap;
  statsState.metricsByLevel = metricsMap;
  statsState.unlockedAchievements = unlockedAchievements;

  if (!statsState.selectedLevelKey) {
    statsState.selectedLevelKey = "java_quiz_1";
  }

  renderStudentSummary();
  if (openDetail) {
    showStudentDetailView();
  }
  if (!silent) {
    setStatus(`Loaded stats for ${selected.label}.`, "ok");
  }
}

function clearLiveRefreshTimer() {
  if (liveState.refreshTimer) {
    window.clearTimeout(liveState.refreshTimer);
    liveState.refreshTimer = null;
  }
}

function queueRealtimeRefresh(immediate = false) {
  if (activeDashboardPartId !== "stats-part") return;
  if (immediate) {
    clearLiveRefreshTimer();
    void runRealtimeRefresh();
    return;
  }
  if (liveState.refreshTimer) return;
  liveState.refreshTimer = window.setTimeout(() => {
    liveState.refreshTimer = null;
    void runRealtimeRefresh();
  }, LIVE_REFRESH_DEBOUNCE_MS);
}

async function runRealtimeRefresh() {
  if (!liveState.adminUser) return;
  if (activeDashboardPartId !== "stats-part") return;

  if (liveState.refreshInFlight) {
    liveState.refreshQueued = true;
    return;
  }

  liveState.refreshInFlight = true;
  try {
    const selectedId = statsState.selectedStudentId;
    const detailVisible = !studentDetailViewEl.classList.contains("hidden");

    await loadStudentList(liveState.adminUser, { silent: true });

    if (!selectedId) {
      return;
    }

    const stillExists = statsState.students.some((student) => student.id === selectedId);
    if (!stillExists) {
      statsState.selectedStudentId = null;
      statsState.selectedStudentLabel = "-";
      statsState.progressByLevel = {};
      statsState.metricsByLevel = {};
      statsState.unlockedAchievements = [];
      renderStudentSummary();
      showStudentPickerView();
      return;
    }

    await selectStudent(selectedId, { silent: true, openDetail: detailVisible });
  } finally {
    liveState.refreshInFlight = false;
    if (liveState.refreshQueued) {
      liveState.refreshQueued = false;
      queueRealtimeRefresh();
    }
  }
}

function teardownRealtimeStats() {
  clearLiveRefreshTimer();
  liveState.refreshQueued = false;
  liveState.adminUser = null;

  if (liveState.pollIntervalId) {
    window.clearInterval(liveState.pollIntervalId);
    liveState.pollIntervalId = null;
  }

  if (liveState.visibilityHandler) {
    document.removeEventListener("visibilitychange", liveState.visibilityHandler);
    liveState.visibilityHandler = null;
  }

  if (liveState.channel) {
    supabase.removeChannel(liveState.channel);
    liveState.channel = null;
  }
}

function setupRealtimeStats(adminUser) {
  teardownRealtimeStats();
  liveState.adminUser = adminUser;

  const queue = () => queueRealtimeRefresh();
  const queueMetrics = () => queueRealtimeRefresh(true);
  liveState.channel = supabase
    .channel(`admin-dashboard-live-${adminUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, queue)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_level_progress" }, queue)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_level_metrics" }, queueMetrics)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_achievements" }, queue)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        queueRealtimeRefresh();
      }
    });

  // Fallback for environments where Realtime is not enabled or delayed.
  liveState.pollIntervalId = window.setInterval(() => {
    if (document.hidden) return;
    queueRealtimeRefresh();
  }, FALLBACK_POLL_MS);

  liveState.visibilityHandler = () => {
    if (!document.hidden) {
      queueRealtimeRefresh();
    }
  };
  document.addEventListener("visibilitychange", liveState.visibilityHandler);
}

function setupStatsListeners() {
  studentsListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-student-id]");
    if (!button) return;
    await selectStudent(button.dataset.studentId);
  });

  backToStudentsBtn.addEventListener("click", () => {
    showStudentPickerView();
  });

  studentSearchEl?.addEventListener("input", () => {
    statsState.studentSearch = studentSearchEl.value || "";
    renderStudents();
  });

  achievementsSummaryBtn?.addEventListener("click", () => {
    const isOpen = achievementsDetailPanelEl && !achievementsDetailPanelEl.classList.contains("hidden");
    if (isOpen) {
      closeAchievementDetailPanel();
      return;
    }
    openAchievementDetailPanel();
  });

  closeAchievementsDetailBtn?.addEventListener("click", () => {
    closeAchievementDetailPanel();
  });

  achievementsDetailPanelEl?.addEventListener("click", (event) => {
    if (event.target === achievementsDetailPanelEl) {
      closeAchievementDetailPanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && achievementsDetailPanelEl && !achievementsDetailPanelEl.classList.contains("hidden")) {
      closeAchievementDetailPanel();
    }
  });

  const levelContainers = [javaQuizLevelsEl, javaPuzzleLevelsEl, csharpQuizLevelsEl, csharpPuzzleLevelsEl];
  for (const container of levelContainers) {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-level-key]");
      if (!button) return;
      statsState.selectedLevelKey = button.dataset.levelKey;
      renderAllLevelGroups();
      renderLevelDetail();
    });
  }
}

function setActivePart(partId) {
  activeDashboardPartId = partId;

  if (partId !== "stats-part") {
    closeAchievementDetailPanel();
  }

  let activePart = null;
  dashboardParts.forEach((part) => {
    const isActive = part.id === partId;
    part.classList.toggle("hidden", !isActive);
    if (isActive) {
      activePart = part;
    }
  });

  menuLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.targetPart === partId);
  });

  if (partId === "stats-part") {
    queueRealtimeRefresh();
  }

  animateIn(activePart);
}

function setupDashboardMenu() {
  const setMenuOpenState = (isOpen) => {
    dashboardMenu.classList.toggle("open", isOpen);
    menuToggleBtn.setAttribute("aria-expanded", String(isOpen));
  };

  const closeMenu = () => {
    setMenuOpenState(false);
  };

  dashboardMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-target-part]");
    if (!button) return;

    const targetPart = button.dataset.targetPart;
    setActivePart(targetPart);
    closeMenu();
  });

  menuToggleBtn.addEventListener("click", () => {
    const nextOpen = !dashboardMenu.classList.contains("open");
    setMenuOpenState(nextOpen);
  });

  document.addEventListener("click", (event) => {
    if (!dashboardMenu.classList.contains("open")) return;
    if (event.target.closest("#dashboard-menu") || event.target.closest("#menu-toggle")) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dashboardMenu.classList.contains("open")) {
      closeMenu();
    }
  });
}

function makeEmptyQuestion(index) {
  return {
    prompt: "",
    choices: ["", "", "", ""],
    correctChoice: "A",
    hint: "",
    isSyntax: false,
    syntaxSnippet: "",
    syntaxAnswer: "",
    title: `Quiz ${index + 1}`,
  };
}

function getEditorKey() {
  return `${editorState.language}:level${editorState.level}`;
}

function ensureEditorBundle() {
  const key = getEditorKey();
  if (!quizEditorStore[key]) {
    quizEditorStore[key] = {
      count: QUIZ_MAX,
      questions: Array.from({ length: QUIZ_MAX }, (_, idx) => makeEmptyQuestion(idx)),
    };
  }
  return quizEditorStore[key];
}

function renderLanguageButtons() {
  languageButtonsEl.innerHTML = LANGUAGES.map((language) => {
    const activeClass = language.value === editorState.language ? "active" : "";
    return `<button type="button" class="pill-btn ${activeClass}" data-language="${language.value}">${language.label}</button>`;
  }).join("");
}

function renderLevelButtons() {
  levelButtonsEl.innerHTML = LEVELS.map((level) => {
    const activeClass = level === editorState.level ? "active" : "";
    return `<button type="button" class="pill-btn ${activeClass}" data-level="${level}">Level ${level}</button>`;
  }).join("");
}

function updateQuestionCountUi() {
  const bundle = ensureEditorBundle();
  questionCountBadgeEl.textContent = `${bundle.count} / ${QUIZ_MAX}`;
  removeQuestionBtn.disabled = bundle.count <= QUIZ_MIN;
  addQuestionBtn.disabled = bundle.count >= QUIZ_MAX;
}

function renderQuestionEditors() {
  const bundle = ensureEditorBundle();
  questionEditorList.innerHTML = bundle.questions
    .slice(0, bundle.count)
    .map((question, index) => {
      const choicesHtml = CHOICE_LETTERS.map((letter, choiceIdx) => {
        const choiceValue = escapeHtml(question.choices[choiceIdx]);
        return `
          <div class="choice-item">
            <label class="mini-label" for="q-${index}-choice-${choiceIdx}">${letter} Choice</label>
            <input id="q-${index}-choice-${choiceIdx}" type="text" data-q-index="${index}" data-field="choice" data-choice-index="${choiceIdx}" value="${choiceValue}" placeholder="Type choice ${letter}" />
          </div>
        `;
      }).join("");

      const hintValue = escapeHtml(question.hint);
      const promptValue = escapeHtml(question.prompt);
      const syntaxSnippet = escapeHtml(question.syntaxSnippet);
      const syntaxAnswer = escapeHtml(question.syntaxAnswer);
      const syntaxHidden = question.isSyntax ? "" : "hidden";

      return `
        <article class="question-card" data-card-index="${index}">
          <header>
            <h3>${escapeHtml(question.title)}</h3>
            <p class="q-index">QUIZ #${index + 1}</p>
          </header>

          <div class="question-form">
            <label class="field-label" for="q-${index}-prompt">Question</label>
            <textarea id="q-${index}-prompt" data-q-index="${index}" data-field="prompt" placeholder="Write the quiz question here">${promptValue}</textarea>

            <div class="choices-grid">
              ${choicesHtml}
            </div>

            <div class="inline-grid">
              <div>
                <label class="field-label" for="q-${index}-hint">Hint</label>
                <input id="q-${index}-hint" type="text" data-q-index="${index}" data-field="hint" value="${hintValue}" placeholder="Type a hint to help answer this question" />
              </div>
              <div>
                <label class="field-label" for="q-${index}-correct">Correct Choice</label>
                <select id="q-${index}-correct" data-q-index="${index}" data-field="correctChoice">
                  ${CHOICE_LETTERS.map((letter) => {
                    const selected = question.correctChoice === letter ? "selected" : "";
                    return `<option value="${letter}" ${selected}>${letter}</option>`;
                  }).join("")}
                </select>
              </div>
            </div>

            <label class="toggle-inline" for="q-${index}-syntax-toggle">
              <input id="q-${index}-syntax-toggle" type="checkbox" data-q-index="${index}" data-field="isSyntax" ${
                question.isSyntax ? "checked" : ""
              } />
              Treat this as a syntax problem
            </label>

            <div class="syntax-wrap ${syntaxHidden}" data-syntax-block="${index}">
              <label class="field-label" for="q-${index}-snippet">Syntax Snippet</label>
              <textarea id="q-${index}-snippet" data-q-index="${index}" data-field="syntaxSnippet" placeholder="Paste buggy syntax or code sample">${syntaxSnippet}</textarea>
              <label class="field-label" for="q-${index}-syntax-answer">Fixed Syntax Answer</label>
              <input id="q-${index}-syntax-answer" type="text" data-q-index="${index}" data-field="syntaxAnswer" value="${syntaxAnswer}" placeholder="Write the corrected syntax" />
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateEditorUi() {
  ensureEditorBundle();
  renderLanguageButtons();
  renderLevelButtons();
  updateQuestionCountUi();
  renderQuestionEditors();
}

function updateQuestionField(target) {
  const qIndex = Number(target.dataset.qIndex);
  if (Number.isNaN(qIndex)) return;

  const bundle = ensureEditorBundle();
  const question = bundle.questions[qIndex];
  if (!question) return;

  const field = target.dataset.field;
  if (field === "choice") {
    const choiceIndex = Number(target.dataset.choiceIndex);
    if (!Number.isNaN(choiceIndex)) {
      question.choices[choiceIndex] = target.value;
    }
    return;
  }

  if (field === "isSyntax") {
    question.isSyntax = target.checked;
    renderQuestionEditors();
    return;
  }

  if (field in question) {
    question[field] = target.value;
  }
}

function setupEditorListeners() {
  languageButtonsEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-language]");
    if (!button) return;
    editorState.language = button.dataset.language;
    updateEditorUi();
  });

  levelButtonsEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-level]");
    if (!button) return;
    editorState.level = Number(button.dataset.level);
    updateEditorUi();
  });

  removeQuestionBtn.addEventListener("click", () => {
    const bundle = ensureEditorBundle();
    if (bundle.count <= QUIZ_MIN) {
      setStatus("Minimum is 1 quiz per level.", "error");
      return;
    }
    bundle.count -= 1;
    updateQuestionCountUi();
    renderQuestionEditors();
    setStatus("Removed one quiz card from this level design.", "ok");
  });

  addQuestionBtn.addEventListener("click", () => {
    const bundle = ensureEditorBundle();
    if (bundle.count >= QUIZ_MAX) {
      setStatus("Maximum is 5 quizzes per level.", "error");
      return;
    }
    bundle.count += 1;
    updateQuestionCountUi();
    renderQuestionEditors();
    setStatus("Added one quiz card back to this level design.", "ok");
  });

  saveLayoutBtn.addEventListener("click", () => {
    setStatus("Quiz layout updated.", "ok");
  });

  questionEditorList.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.dataset.qIndex) return;
    updateQuestionField(target);
  });

  questionEditorList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.dataset.qIndex) return;
    updateQuestionField(target);
  });
}

async function requireAdminSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    redirectToLogin();
    return null;
  }

  const user = data.session.user;
  const adminUsername = emailToUsername(user.email || "");
  if (!isAdminUsername(adminUsername)) {
    await supabase.auth.signOut();
    setStatus("This account is not allowed to view admin stats.", "error");
    setTimeout(redirectToLogin, 1200);
    return null;
  }

  adminLabel.textContent = `Signed in as ${adminUsername}`;
  return user;
}

async function boot() {
  const user = await requireAdminSession();
  if (!user) return;

  await ensureAchievementCatalog();

  setupDashboardMenu();
  setActivePart("stats-part");
  showStudentPickerView();

  setupStatsListeners();
  await loadStudentList(user);
  setupRealtimeStats(user);

  setupEditorListeners();
  updateEditorUi();
}

window.addEventListener("beforeunload", teardownRealtimeStats);

document.getElementById("signout-btn").addEventListener("click", async () => {
  teardownRealtimeStats();
  await supabase.auth.signOut();
  redirectToLoginAnimated();
});

boot();