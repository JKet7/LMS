/* ============================================================
   INDEX.JS — логика просмотра курса
   Требует: data.js загружен ДО этого файла (allLessons, courseSettings)
   ============================================================ */

const THEME_KEY = "kp_course_theme";

// ============================================================
// ЗАЩИТА ОТ ПОВРЕЖДЁННОГО data.js
// ============================================================
(function checkData() {
    let problem = null;

    if (typeof courseSettings === "undefined") {
        problem = "Файл <code>data.js</code> не загрузился или содержит синтаксическую ошибку (переменная <code>courseSettings</code> не найдена).";
    } else if (typeof allLessons === "undefined") {
        problem = "В <code>data.js</code> отсутствует переменная <code>allLessons</code>.";
    } else if (allLessons === null || typeof allLessons !== "object" || Array.isArray(allLessons)) {
        problem = "Переменная <code>allLessons</code> в <code>data.js</code> должна быть объектом (словарь блоков).";
    } else if (Object.keys(allLessons).length === 0) {
        problem = "В курсе нет ни одного блока. Добавь хотя бы один блок через <code>admin.html</code>.";
    }

    if (problem) {
        showFatalError(problem);
        throw new Error("data.js check failed");
    }
})();

function showFatalError(reason) {
    document.body.innerHTML = `
        <div style="
            font-family: 'M PLUS Rounded 1c', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            max-width: 640px;
            margin: 80px auto;
            padding: 32px 24px;
            background: #FAF6EC;
            border: 1px solid #E0D6C0;
            border-radius: 14px;
            box-shadow: 0 1px 2px rgba(43,43,43,.08);
            color: #1A1A1A;
            line-height: 1.6;
        ">
            <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #000;">⚠ Курс не загрузился</h1>
            <p style="margin: 0 0 16px; font-size: 15px; color: #4A4540;">${reason}</p>
            <div style="padding: 14px 18px; background: #F0D8DC; border-left: 4px solid #8B1A2B; border-radius: 8px; font-size: 14px; line-height: 1.7;">
                <strong>Если вы автор курса:</strong><br>
                1. Откройте <code style="background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace;">admin.html</code> этого курса.<br>
                2. Нажмите кнопку <strong>↻ Откатить</strong> в шапке.<br>
                3. Проверьте, что файл <code style="background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace;">data.js</code> не повреждён.
            </div>
            <div style="margin-top: 16px; padding: 14px 18px; background: #EBE4D4; border-radius: 8px; font-size: 14px; line-height: 1.7;">
                <strong>Если вы читатель:</strong><br>
                1. Обновите страницу (<code style="background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace;">Ctrl+F5</code>).<br>
                2. Если не помогает — сообщите автору курса.
            </div>
        </div>
    `;
}

const COURSE_KEY = (courseSettings && courseSettings.courseKey)
    ? String(courseSettings.courseKey).trim()
    : "default";

const STORAGE_KEY = "kp_course_v1_" + COURSE_KEY;

let currentLessonId = null;
let currentSlide = 0;
let slides = [];
let lessonState = {};
let quizTimerInterval = null;

let glossaryState = {
    selectedTermIndex: 0,
    searchQuery: ""
};

let navHistory = null;

const appContainer = document.getElementById("app-container");
const menuList = document.getElementById("menu-list");
const lessonTitleEl = document.getElementById("lesson-title");
const quizTitleEl = document.getElementById("quiz-title");
const progressFill = document.getElementById("progress-fill");
const quizProgressFill = document.getElementById("quiz-progress-fill");
const slideContent = document.getElementById("slide-content");
const topicList = document.getElementById("topic-list");
const quizContent = document.getElementById("quiz-content");
const quizNavGrid = document.getElementById("quiz-nav-grid");
const quizTimerEl = document.getElementById("quiz-timer");
const memoTitleEl = document.getElementById("memo-title");
const memoGridEl = document.getElementById("memo-grid");
const glossaryTitleEl = document.getElementById("glossary-title");
const glossaryListEl = document.getElementById("glossary-list");
const glossaryContentEl = document.getElementById("glossary-content");
const glossarySearchEl = document.getElementById("glossary-search");

function openAdmin() {
    window.open("admin.html", "_blank");
}
(function setupDoubleTap() {
    const titleEl = document.getElementById("course-title");
    if (!titleEl) return;
    let lastTap = 0;
    titleEl.addEventListener("touchend", (e) => {
        const now = Date.now();
        if (now - lastTap < 400) {
            e.preventDefault();
            openAdmin();
            lastTap = 0;
        } else {
            lastTap = now;
        }
    }, { passive: false });
})();

function normalizeCorrect(correct) {
    if (Array.isArray(correct)) return correct;
    return [correct];
}
function detectType(q) {
    if (q.type) return q.type;
    if (q.pairs && Array.isArray(q.pairs)) return "match";
    if ((q.front !== undefined) || (q.back !== undefined)) return "card";
    const c = normalizeCorrect(q.correct);
    return c.length > 1 ? "multi" : "single";
}

// ============================================================
// Миграция старых списков
// ============================================================
function migrateListBlock(b) {
    if (!b || b.type !== "ul") return;
    if (!b.style) b.style = "bullet";
    if (!Array.isArray(b.items)) b.items = [];
    b.items = b.items.map(item => {
        if (typeof item === "string") return { text: item, level: 0 };
        if (item && typeof item === "object") {
            if (item.level === undefined) item.level = 0;
            if (item.text === undefined) item.text = "";
            return item;
        }
        return { text: String(item || ""), level: 0 };
    });
}
function migrateListBlocksInContent(content) {
    if (!Array.isArray(content)) return;
    content.forEach(b => migrateListBlock(b));
}

Object.values(allLessons).forEach(lesson => {
    if (lesson.type === "quiz") {
        if (!lesson.groups) lesson.groups = [];
        if (lesson.randomizeQuestions === undefined) lesson.randomizeQuestions = false;
        if (lesson.randomizeOptions === undefined) lesson.randomizeOptions = false;
        if (lesson.questions) {
            lesson.questions.forEach(q => {
                q.type = detectType(q);
                if (q.type === "single" || q.type === "multi") {
                    q.correct = normalizeCorrect(q.correct);
                }
                if (q.group === undefined) q.group = null;
            });
        }
    } else if (lesson.type === "memo") {
        if (!lesson.cells) lesson.cells = [];
        lesson.cells.forEach(cell => {
            if (!cell.content) cell.content = [];
            if (cell.title === undefined) cell.title = "";
            migrateListBlocksInContent(cell.content);
        });
    } else if (lesson.type === "glossary") {
        if (!lesson.terms) lesson.terms = [];
        lesson.terms.forEach(term => {
            if (!term.content) term.content = [];
            if (term.name === undefined) term.name = "";
            migrateListBlocksInContent(term.content);
        });
    } else if (lesson.type === "theory" && lesson.slides) {
        lesson.slides.forEach(slide => {
            if (!slide.content) slide.content = [];
            migrateListBlocksInContent(slide.content);
        });
    }
});

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll('.btn-icon[onclick*="toggleTheme"]').forEach(btn => {
        btn.textContent = theme === "dark" ? "☀️" : "🌙";
        btn.title = theme === "dark" ? "Светлая тема" : "Тёмная тема";
    });
}
function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}
(function initTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    applyTheme(current);
})();

if (typeof courseSettings !== "undefined") {
    if (courseSettings.pageTitle) document.title = courseSettings.pageTitle;
    if (courseSettings.courseTitle) document.getElementById("course-title").textContent = courseSettings.courseTitle;
}

function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById("screen-" + name).classList.add("active");
    appContainer.classList.remove("wide", "narrow");
    if (name === "memo") appContainer.classList.add("wide");
    else if (name === "quiz") appContainer.classList.add("narrow");
    updateBackButton();
}

function updateBackButton() {
    const show = navHistory !== null;
    ["back-btn-lesson", "back-btn-quiz", "back-btn-memo", "back-btn-glossary"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? "inline-flex" : "none";
    });
}

function loadAll() { try { const raw = localStorage.getItem(STORAGE_KEY); lessonState = raw ? JSON.parse(raw) : {}; } catch(e) { lessonState = {}; } }
function saveAll() { localStorage.setItem(STORAGE_KEY, JSON.stringify(lessonState)); }
function getState(id) {
    if (!lessonState[id]) lessonState[id] = { currentSlide:0, visited:[], completed:false };
    if (!lessonState[id].visited) lessonState[id].visited = [];
    return lessonState[id];
}
function getQuizState(id) {
    if (!lessonState[id]) lessonState[id] = { currentQuestion:0, questionState:[], score:0, timerSeconds:0, completed:false };
    if (!lessonState[id].questionState) lessonState[id].questionState = [];
    if (!lessonState[id]._questionsOrder) lessonState[id]._questionsOrder = null;
    if (!lessonState[id]._optionsOrder) lessonState[id]._optionsOrder = null;
    if (!lessonState[id]._matchOrder) lessonState[id]._matchOrder = null;
    return lessonState[id];
}

function getNextLessonId(currentId) {
    const ids = Object.keys(allLessons);
    const idx = ids.indexOf(currentId);
    if (idx === -1 || idx === ids.length - 1) return null;
    return ids[idx + 1];
}

function renderMenu() {
    loadAll();
    let html = "";
    for (const id in allLessons) {
        const lesson = allLessons[id];
        const isQuiz = lesson.type === "quiz";
        const isMemo = lesson.type === "memo";
        const isGlossary = lesson.type === "glossary";
        const state = lessonState[id] || {};
        const started = isQuiz
            ? (state.questionState || []).some(q => q && q.done)
            : (isMemo || isGlossary ? false : (state.visited || []).length > 0);

        let cls = "menu-item " + (isQuiz ? "quiz" : (isMemo ? "memo" : (isGlossary ? "glossary" : "theory")));
        const badge = isQuiz
            ? `<span class="menu-type-badge quiz">Тест</span>`
            : (isMemo ? `<span class="menu-type-badge memo">Памятка</span>`
                : (isGlossary ? `<span class="menu-type-badge glossary">Глоссарий</span>`
                    : `<span class="menu-type-badge theory">Теория</span>`));
        const icon = isQuiz ? "🧪 " : (isMemo ? "📌 " : (isGlossary ? "📖 " : "📖 "));

        html += `<div class="${cls}"><div class="menu-info">`;
        html += `<h3>${icon}${lesson.title} ${badge}</h3>`;
        if (isQuiz) html += `<p>${lesson.questions.length} вопросов</p>`;
        else if (isMemo) {
            const cellCount = (lesson.cells || []).length;
            html += `<p>${cellCount} ${pluralizeCells(cellCount)}</p>`;
        }
        else if (isGlossary) {
            const termsCount = (lesson.terms || []).length;
            html += `<p>${termsCount} ${pluralizeTerms(termsCount)}</p>`;
        }
        else html += `<p>${lesson.slides.length} слайдов</p>`;
        html += `</div><div class="menu-actions">`;

        if (isMemo) {
            html += `<button class="btn btn-primary" onclick="openMemo('${id}')">Открыть</button>`;
        } else if (isGlossary) {
            html += `<button class="btn btn-primary" onclick="openGlossary('${id}')">Открыть</button>`;
        } else if (isQuiz) {
            if (started) {
                html += `<button class="btn btn-primary" onclick="startQuiz('${id}')">Продолжить</button>`;
                html += `<button class="btn btn-text" onclick="resetBlock('${id}')">Сначала</button>`;
            } else {
                html += `<button class="btn btn-primary" onclick="startQuiz('${id}')">Начать</button>`;
            }
        } else {
            if (started) {
                html += `<button class="btn btn-primary" onclick="continueLesson('${id}')">Продолжить</button>`;
                html += `<button class="btn btn-text" onclick="resetBlock('${id}')">Сначала</button>`;
            } else {
                html += `<button class="btn btn-primary" onclick="startLesson('${id}')">Начать</button>`;
            }
        }
        html += `</div></div>`;
    }
    menuList.innerHTML = html;
}

function pluralizeCells(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "ячейка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ячейки";
    return "ячеек";
}

function pluralizeTerms(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "термин";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "термина";
    return "терминов";
}

function resetBlock(id) { delete lessonState[id]; saveAll(); renderMenu(); }

function startLesson(id) {
    const lesson = allLessons[id];
    currentLessonId = id; slides = lesson.slides; currentSlide = 0;
    lessonTitleEl.textContent = lesson.title;
    showScreen("lesson"); markVisited(0); renderSlide();
}
function continueLesson(id) {
    const lesson = allLessons[id]; const state = getState(id);
    currentLessonId = id; slides = lesson.slides; currentSlide = state.currentSlide || 0;
    lessonTitleEl.textContent = lesson.title;
    showScreen("lesson"); markVisited(currentSlide); renderSlide();
}
function exitToMenu() {
    stopQuizTimer();
    if (currentLessonId) {
        const lesson = allLessons[currentLessonId];
        if (lesson && lesson.type === "quiz") saveAll();
        else if (lesson && lesson.type === "theory") { const s = getState(currentLessonId); s.currentSlide = currentSlide; saveAll(); }
    }
    navHistory = null;
    showScreen("menu"); renderMenu();
}
function markVisited(i) { const s = getState(currentLessonId); if (!s.visited.includes(i)) s.visited.push(i); s.currentSlide = i; saveAll(); }
function updateProgressBar() { const s = getState(currentLessonId); progressFill.style.width = (s.visited.length / slides.length) * 100 + "%"; }
function renderTopicList() {
    const s = getState(currentLessonId);
    let html = "";
    slides.forEach((slide, i) => {
        let cls = "topic-item";
        if (i === currentSlide) cls += " current";
        else if (s.visited.includes(i)) cls += " visited";
        html += `<button class="${cls}" onclick="goToSlide(${i})">${slide.shortName}</button>`;
    });
    topicList.innerHTML = html;
}
function goToSlide(i) { currentSlide = i; markVisited(i); renderSlide(); }

function renderTable(b) {
    const rows = b.rows || [];
    if (!rows.length) return "";
    const hasHeader = b.header === true;
    let html = `<div class="slide-table-wrap"><table class="slide-table">`;

    let maxCols = 0;
    rows.forEach(r => { if (Array.isArray(r) && r.length > maxCols) maxCols = r.length; });
    if (maxCols === 0) return "";

    rows.forEach((row, ri) => {
        const isHeaderRow = hasHeader && ri === 0;
        html += `<tr>`;
        for (let ci = 0; ci < maxCols; ci++) {
            const cell = (row && row[ci] !== undefined) ? String(row[ci]) : "";
            if (isHeaderRow) {
                html += `<th>${cell}</th>`;
            } else {
                html += `<td>${cell}</td>`;
            }
        }
        html += `</tr>`;
    });

    html += `</table></div>`;
    return html;
}

function renderList(b) {
    const style = b.style || "bullet";
    const items = b.items || [];
    if (!items.length) return "";
    let html = `<ul class="slide-list slide-list-${style}">`;
    let numCounter = [0, 0, 0];
    items.forEach(item => {
        const text = (typeof item === "string") ? item : (item.text || "");
        const level = (typeof item === "object" && item.level !== undefined) ? item.level : 0;
        const safeLevel = Math.max(0, Math.min(2, level));
        if (style === "number") {
            numCounter[safeLevel] = (numCounter[safeLevel] || 0) + 1;
            for (let k = safeLevel + 1; k < numCounter.length; k++) numCounter[k] = 0;
        }
        let markerHtml = "";
        if (style === "bullet") {
            const m = safeLevel === 0 ? "•" : (safeLevel === 1 ? "◦" : "▪");
            markerHtml = `<span class="slide-list-marker">${m}</span>`;
        } else if (style === "number") {
            markerHtml = `<span class="slide-list-marker">${numCounter[safeLevel]}.</span>`;
        } else if (style === "checkbox") {
            markerHtml = `<span class="slide-list-check">☐</span>`;
        }
        html += `<li class="slide-list-item level-${safeLevel}">${markerHtml}<span class="slide-list-text">${text}</span></li>`;
    });
    html += `</ul>`;
    return html;
}

function renderContentBlocks(blocks) {
    let html = "";
    (blocks || []).forEach(b => {
        if (b.type === "p") html += `<p>${b.text || ""}</p>`;
        else if (b.type === "h3") html += `<h3>${b.text || ""}</h3>`;
        else if (b.type === "ul") html += renderList(b);
        else if (b.type === "quote") html += `<div class="quote">${b.text || ""}</div>`;
        else if (b.type === "link") html += renderLinkBlock(b);
        else if (b.type === "image" && b.src) html += `<div class="slide-media"><img src="${b.src}" alt="${b.alt || ''}" loading="lazy"></div>`;
        else if (b.type === "video" && b.src) {
            html += `<div class="slide-media has-video">`;
            html += `<video src="${b.src}" controls preload="metadata"></video>`;
            html += `<div class="print-video-placeholder">🎬 [Видео: ${escapeHtml(b.src)}]</div>`;
            html += `</div>`;
        }
        else if (b.type === "table") html += renderTable(b);
    });
    return html;
}

function renderSlide() {
    const slide = slides[currentSlide];
    const isLast = currentSlide === slides.length - 1;

    let html = `<h2 class="slide-title">${slide.title}</h2>`;
    html += `<div class="slide-content">`;
    html += renderContentBlocks(slide.content);
    html += `</div>`;

    html += `<div class="nav-row">`;
    if (currentSlide > 0) html += `<button class="nav-btn" onclick="goPrev()">← Назад</button>`;
    else html += `<div></div>`;

    if (isLast) {
        html += `<div class="nav-row-right">`;
        html += `<button class="nav-btn" onclick="finishLesson()">Завершить блок</button>`;
        const nextId = getNextLessonId(currentLessonId);
        if (nextId) {
            const nextTitle = escapeHtml(allLessons[nextId].title || "далее");
            html += `<button class="nav-btn primary" onclick="goToNextLesson()">${nextTitle} →</button>`;
        } else {
            html += `<button class="nav-btn primary" onclick="exitToMenu()">← В меню</button>`;
        }
        html += `</div>`;
    } else {
        html += `<button class="nav-btn primary" onclick="goNext()">Дальше →</button>`;
    }
    html += `</div>`;

    slideContent.innerHTML = html;

    slideContent.querySelectorAll('.slide-media img, .slide-media video').forEach(el => {
        el.addEventListener('error', () => {
            const wrap = el.closest('.slide-media');
            if (!wrap) return;
            const src = el.getAttribute('src') || '';
            const isVideo = el.tagName === 'VIDEO';
            wrap.innerHTML = `<div class="slide-media-error">
                ⚠ ${isVideo ? 'Видео' : 'Картинка'} не найдено:<br>
                <code>${escapeHtml(src)}</code>
            </div>`;
        });
    });

    renderTopicList(); updateProgressBar();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}
function renderLinkBlock(b) {
    const href = b.href || ""; const text = b.text || "Ссылка";
    const isInternal = href.startsWith("#");
    if (isInternal) return `<div class="link-block"><a class="slide-link internal" href="javascript:void(0)" onclick="goToInternalLink('${href}')">🔗 ${text}</a></div>`;
    return `<div class="link-block"><a class="slide-link" href="${href}" target="_blank" rel="noopener">🔗 ${text}</a></div>`;
}
function goToInternalLink(href) {
    const raw = href.slice(1); const parts = raw.split(":");
    const lessonId = parts[0]; const slideNum = parts[1] ? parseInt(parts[1]) - 1 : 0;
    const lesson = allLessons[lessonId];
    if (!lesson) { alert("Блок не найден: " + lessonId); return; }

    saveNavHistory();

    if (lesson.type === "quiz") { startQuiz(lessonId); return; }
    if (lesson.type === "memo") { openMemo(lessonId); return; }
    if (lesson.type === "glossary") { openGlossary(lessonId); return; }

    if (currentLessonId) {
        const cur = allLessons[currentLessonId];
        if (cur && cur.type === "theory") { const s = getState(currentLessonId); s.currentSlide = currentSlide; saveAll(); }
    }
    currentLessonId = lessonId; slides = lesson.slides;
    lessonTitleEl.textContent = lesson.title; showScreen("lesson");
    currentSlide = (slideNum >= 0 && slideNum < slides.length) ? slideNum : 0;
    markVisited(currentSlide); renderSlide();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveNavHistory() {
    if (!currentLessonId) { navHistory = null; return; }
    const lesson = allLessons[currentLessonId];
    if (!lesson) { navHistory = null; return; }
    if (lesson.type === "theory") {
        navHistory = { lessonId: currentLessonId, slideIndex: currentSlide, lessonType: "theory" };
    } else if (lesson.type === "quiz") {
        const qs = getQuizState(currentLessonId);
        navHistory = { lessonId: currentLessonId, slideIndex: qs.currentQuestion || 0, lessonType: "quiz" };
    } else {
        navHistory = { lessonId: currentLessonId, slideIndex: 0, lessonType: lesson.type };
    }
}

function goBack() {
    if (!navHistory) return;
    const h = navHistory;
    navHistory = null;
    const lesson = allLessons[h.lessonId];
    if (!lesson) { updateBackButton(); return; }

    if (lesson.type === "quiz") {
        startQuiz(h.lessonId);
        const qs = getQuizState(h.lessonId);
        qs.currentQuestion = h.slideIndex || 0;
        saveAll();
        renderQuiz();
        updateBackButton();
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
    }
    if (lesson.type === "memo") {
        openMemo(h.lessonId);
        updateBackButton();
        return;
    }
    if (lesson.type === "glossary") {
        openGlossary(h.lessonId);
        updateBackButton();
        return;
    }
    currentLessonId = h.lessonId; slides = lesson.slides;
    currentSlide = (h.slideIndex >= 0 && h.slideIndex < slides.length) ? h.slideIndex : 0;
    lessonTitleEl.textContent = lesson.title;
    showScreen("lesson"); markVisited(currentSlide); renderSlide();
    updateBackButton();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function goNext() { if (currentSlide < slides.length - 1) { currentSlide++; markVisited(currentSlide); renderSlide(); window.scrollTo({top:0,behavior:"smooth"}); } }
function goPrev() { if (currentSlide > 0) { currentSlide--; markVisited(currentSlide); renderSlide(); window.scrollTo({top:0,behavior:"smooth"}); } }

function finishLesson() {
    const s = getState(currentLessonId);
    s.completed = true; s.currentSlide = currentSlide; saveAll();
    showScreen("menu"); renderMenu();
}

function finishLessonSilent() {
    const s = getState(currentLessonId);
    s.completed = true;
    s.currentSlide = currentSlide;
    saveAll();
}

function goToNextLesson() {
    finishLessonSilent();
    const nextId = getNextLessonId(currentLessonId);
    if (!nextId) { showScreen("menu"); renderMenu(); return; }

    const lesson = allLessons[nextId];
    currentLessonId = nextId;

    if (lesson.type === "quiz") {
        startQuiz(nextId);
    } else if (lesson.type === "memo") {
        openMemo(nextId);
    } else if (lesson.type === "glossary") {
        openGlossary(nextId);
    } else {
        currentSlide = 0;
        slides = lesson.slides;
        lessonTitleEl.textContent = lesson.title;
        showScreen("lesson");
        markVisited(0);
        renderSlide();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== ПАМЯТКА ===== */
function openMemo(id) {
    stopQuizTimer();
    const lesson = allLessons[id];
    if (!lesson || lesson.type !== "memo") return;
    currentLessonId = id;
    memoTitleEl.textContent = lesson.title;
    renderMemo(lesson);
    showScreen("memo");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getMemoCols(count) {
    if (count <= 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    if (count === 4) return 2;
    if (count === 5) return 3;
    if (count === 6) return 3;
    if (count === 7) return 4;
    return 4;
}

function renderMemo(lesson) {
    const cells = lesson.cells || [];
    const count = cells.length;
    const cols = getMemoCols(count);
    memoGridEl.className = "memo-grid cols-" + cols;

    const oldNav = memoGridEl.parentNode.querySelector(".memo-nav-row");
    if (oldNav) oldNav.remove();

    let html = "";
    cells.forEach(cell => {
        html += `<div class="memo-cell">`;
        if (cell.title) {
            html += `<div class="memo-cell-header">${cell.title}</div>`;
        }
        html += `<div class="memo-cell-body">`;
        html += renderContentBlocks(cell.content);
        html += `</div>`;
        html += `</div>`;
    });
    memoGridEl.innerHTML = html;

    memoGridEl.querySelectorAll('.slide-media img, .slide-media video').forEach(el => {
        el.addEventListener('error', () => {
            const wrap = el.closest('.slide-media');
            if (!wrap) return;
            const src = el.getAttribute('src') || '';
            const isVideo = el.tagName === 'VIDEO';
            wrap.innerHTML = `<div class="slide-media-error">
                ⚠ ${isVideo ? 'Видео' : 'Картинка'} не найдено:<br>
                <code>${escapeHtml(src)}</code>
            </div>`;
        });
    });

    let navHtml = `<div class="memo-nav-row">`;
    const nextId = getNextLessonId(currentLessonId);
    if (nextId) {
        const nextTitle = escapeHtml(allLessons[nextId].title || "далее");
        navHtml += `<button class="btn btn-outline" onclick="exitToMenu()">Завершить блок</button>`;
        navHtml += `<button class="btn btn-primary" onclick="goToNextLesson()">${nextTitle} →</button>`;
    } else {
        navHtml += `<button class="btn btn-primary" onclick="exitToMenu()">← В меню</button>`;
    }
    navHtml += `</div>`;
    memoGridEl.insertAdjacentHTML("afterend", navHtml);
}

/* ===== ГЛОССАРИЙ ===== */
function openGlossary(id) {
    stopQuizTimer();
    const lesson = allLessons[id];
    if (!lesson || lesson.type !== "glossary") return;
    currentLessonId = id;
    glossaryTitleEl.textContent = lesson.title;
    glossaryState.selectedTermIndex = 0;
    glossaryState.searchQuery = "";
    if (glossarySearchEl) glossarySearchEl.value = "";
    renderGlossary(lesson);
    showScreen("glossary");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getSortedTermsWithIndexes(lesson) {
    const arr = (lesson.terms || []).map((term, origIndex) => ({ term, origIndex }));
    arr.sort((a, b) => {
        const na = String(a.term.name || "").trim().toLowerCase();
        const nb = String(b.term.name || "").trim().toLowerCase();
        if (na < nb) return -1;
        if (na > nb) return 1;
        return a.origIndex - b.origIndex;
    });
    return arr;
}

function getFirstLetter(name) {
    const s = String(name || "").trim();
    if (!s) return "—";
    const ch = s.charAt(0).toUpperCase();
    return ch;
}

function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const q = query.trim();
    if (!q) return safe;
    try {
        const re = new RegExp("(" + escapeRegExp(q) + ")", "gi");
        return safe.replace(re, "<mark>$1</mark>");
    } catch (e) {
        return safe;
    }
}

function renderGlossary(lesson) {
    renderGlossaryList(lesson);
    renderGlossaryTerm(lesson);
}

function renderGlossaryList(lesson) {
    const sorted = getSortedTermsWithIndexes(lesson);
    const query = String(glossaryState.searchQuery || "").trim().toLowerCase();

    let html = "";
    let shown = 0;
    let lastLetter = null;

    sorted.forEach(item => {
        const name = String(item.term.name || "").trim();
        if (query && !name.toLowerCase().includes(query)) return;
        shown++;

        const letter = getFirstLetter(name);
        if (letter !== lastLetter) {
            html += `<div class="glossary-letter">${escapeHtml(letter)}</div>`;
            lastLetter = letter;
        }

        const isCurrent = item.origIndex === glossaryState.selectedTermIndex;
        const displayName = name || "(без названия)";
        html += `<button class="glossary-term${isCurrent ? ' current' : ''}" onclick="glossarySelect(${item.origIndex})">${highlightMatch(displayName, query)}</button>`;
    });

    if (shown === 0) {
        html = `<div class="glossary-empty">Ничего не найдено</div>`;
    }

    glossaryListEl.innerHTML = html;
}

function renderGlossaryTerm(lesson) {
    const term = (lesson.terms || [])[glossaryState.selectedTermIndex];
    if (!term) {
        glossaryContentEl.innerHTML = `<p style="color:var(--text-muted);">Термин не выбран.</p>`;
        return;
    }

    const query = String(glossaryState.searchQuery || "").trim().toLowerCase();
    const name = String(term.name || "").trim() || "(без названия)";

    let html = `<h2 class="glossary-term-title">${highlightMatch(name, query)}</h2>`;
    html += `<div class="slide-content">`;
    html += renderContentBlocks(term.content);
    html += `</div>`;

    html += `<div class="glossary-nav-row">`;
    const nextId = getNextLessonId(currentLessonId);
    if (nextId) {
        const nextTitle = escapeHtml(allLessons[nextId].title || "далее");
        html += `<button class="btn btn-outline" onclick="exitToMenu()">Завершить блок</button>`;
        html += `<button class="btn btn-primary" onclick="goToNextLesson()">${nextTitle} →</button>`;
    } else {
        html += `<button class="btn btn-primary" onclick="exitToMenu()">← В меню</button>`;
    }
    html += `</div>`;

    glossaryContentEl.innerHTML = html;

    glossaryContentEl.querySelectorAll('.slide-media img, .slide-media video').forEach(el => {
        el.addEventListener('error', () => {
            const wrap = el.closest('.slide-media');
            if (!wrap) return;
            const src = el.getAttribute('src') || '';
            const isVideo = el.tagName === 'VIDEO';
            wrap.innerHTML = `<div class="slide-media-error">
                ⚠ ${isVideo ? 'Видео' : 'Картинка'} не найдено:<br>
                <code>${escapeHtml(src)}</code>
            </div>`;
        });
    });
}

function onGlossarySearch() {
    glossaryState.searchQuery = glossarySearchEl ? glossarySearchEl.value : "";
    const lesson = allLessons[currentLessonId];
    if (lesson) renderGlossary(lesson);
}

function glossarySelect(origIndex) {
    glossaryState.selectedTermIndex = origIndex;
    const lesson = allLessons[currentLessonId];
    if (lesson) renderGlossary(lesson);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ===== ТЕСТ ===== */
function startQuiz(id) {
    const lesson = allLessons[id];
    currentLessonId = id;
    const qs = getQuizState(id);

    // Если количество вопросов изменилось — сбрасываем всё состояние
    if (qs.questionState.length !== lesson.questions.length) {
        qs.questionState = lesson.questions.map(q => makeFreshQuestionState(q));
        qs.currentQuestion = 0;
        qs.score = 0;
        qs.timerSeconds = 0;
        qs.completed = false;
        qs._questionsOrder = null;
        qs._optionsOrder = null;
        qs._matchOrder = null;
    }

    // Восстановление полей questionState (на случай старых данных)
    qs.questionState.forEach((s, i) => {
        if (!s) {
            qs.questionState[i] = makeFreshQuestionState(lesson.questions[i]);
            return;
        }
        if (!s.selected) s.selected = [];
        if (s.lastCheckWrong === undefined) s.lastCheckWrong = false;
        if (s.matchedPairs === undefined) s.matchedPairs = [];
        if (s.hadError === undefined) s.hadError = false;
        if (s.userAnswer === undefined) s.userAnswer = null;
    });

    // ===== _questionsOrder =====
    let needQOrder = !qs._questionsOrder || qs._questionsOrder.length !== lesson.questions.length;
    if (!needQOrder) {
        for (const idx of qs._questionsOrder) {
            if (idx < 0 || idx >= lesson.questions.length) { needQOrder = true; break; }
        }
    }
    if (needQOrder) {
        let order = lesson.questions.map((_, i) => i);
        if (lesson.randomizeQuestions) order = shuffle(order);
        qs._questionsOrder = order;
    }

    // ===== _optionsOrder =====
    let needOptOrder = !qs._optionsOrder || qs._optionsOrder.length !== lesson.questions.length;
    if (!needOptOrder) {
        for (let i = 0; i < lesson.questions.length; i++) {
            const q = lesson.questions[i];
            const order = qs._optionsOrder[i];
            if (q.type === "single" || q.type === "multi") {
                const optCount = (q.options || []).length;
                if (!order || !Array.isArray(order) || order.length !== optCount) {
                    needOptOrder = true;
                    break;
                }
                for (const idx of order) {
                    if (idx < 0 || idx >= optCount) { needOptOrder = true; break; }
                }
                if (needOptOrder) break;
            } else {
                if (order !== null) { needOptOrder = true; break; }
            }
        }
    }
    if (needOptOrder) {
        qs._optionsOrder = lesson.questions.map(q => {
            if (q.type !== "single" && q.type !== "multi") return null;
            let idxs = (q.options || []).map((_, i) => i);
            if (lesson.randomizeOptions) idxs = shuffle(idxs);
            return idxs;
        });
    }

    // ===== _matchOrder =====
    let needMatchOrder = !qs._matchOrder || qs._matchOrder.length !== lesson.questions.length;
    if (!needMatchOrder) {
        for (let i = 0; i < lesson.questions.length; i++) {
            const q = lesson.questions[i];
            const order = qs._matchOrder[i];
            if (q.type === "match") {
                const pairsCount = (q.pairs || []).length;
                if (!order
                    || !order.leftOrder || !order.rightOrder
                    || !Array.isArray(order.leftOrder) || !Array.isArray(order.rightOrder)
                    || order.leftOrder.length !== pairsCount
                    || order.rightOrder.length !== pairsCount) {
                    needMatchOrder = true;
                    break;
                }
                for (const idx of order.leftOrder) {
                    if (idx < 0 || idx >= pairsCount) { needMatchOrder = true; break; }
                }
                if (needMatchOrder) break;
                for (const idx of order.rightOrder) {
                    if (idx < 0 || idx >= pairsCount) { needMatchOrder = true; break; }
                }
                if (needMatchOrder) break;
            } else {
                if (order !== null) { needMatchOrder = true; break; }
            }
        }
    }
    if (needMatchOrder) {
        qs._matchOrder = lesson.questions.map(q => {
            if (q.type !== "match") return null;
            const n = (q.pairs || []).length;
            const leftOrder = shuffle([...Array(n).keys()]);
            const rightOrder = shuffle([...Array(n).keys()]);
            return { leftOrder, rightOrder };
        });
    }

    quizTitleEl.textContent = lesson.title;
    showScreen("quiz");
    startQuizTimer();
    renderQuiz();
}

function makeFreshQuestionState(q) {
    const base = { done: false, wrong: false, selected: [], lastCheckWrong: false };
    if (q.type === "match") {
        base.matchedPairs = [];
        base.hadError = false;
        base._pendingLeft = null;
        base._pendingRight = null;
    }
    if (q.type === "card") {
        base.userAnswer = null;
    }
    return base;
}
function continueQuiz(id) { startQuiz(id); }
function startQuizTimer() {
    stopQuizTimer();
    updateQuizTimerDisplay();
    quizTimerInterval = setInterval(() => {
        const qs = getQuizState(currentLessonId);
        qs.timerSeconds = (qs.timerSeconds || 0) + 1;
        updateQuizTimerDisplay();
        if (qs.timerSeconds % 10 === 0) saveAll();
    }, 1000);
}
function stopQuizTimer() { if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; } }
function updateQuizTimerDisplay() { quizTimerEl.textContent = formatTime(getQuizState(currentLessonId).timerSeconds || 0); }
function formatTime(s) { const m = Math.floor(s / 60); const ss = s % 60; return String(m).padStart(2,"0") + ":" + String(ss).padStart(2,"0"); }

function renderQuiz() {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    const done = qs.questionState.filter(q => q && q.done).length;
    quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";

    if (qs.currentQuestion >= lesson.questions.length) {
        renderQuizResult(lesson, qs); renderQuizNavGrid(); return;
    }

    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const q = lesson.questions[origIdx];
    const state = qs.questionState[origIdx];
    if (!state.selected) state.selected = [];

    let html = "";
    if (q.type === "single" || q.type === "multi") {
        html = renderChoiceQuestion(lesson, q, state, origIdx, qs);
    } else if (q.type === "match") {
        html = renderMatchQuestion(lesson, q, state, origIdx, qs);
    } else if (q.type === "card") {
        html = renderCardQuestion(lesson, q, state, origIdx, qs);
    }
    quizContent.innerHTML = html;
    renderQuizNavGrid();
}

function renderChoiceQuestion(lesson, q, state, origIdx, qs) {
    const correctArr = normalizeCorrect(q.correct);
    const isMulti = q.type === "multi";
    const optOrder = qs._optionsOrder[origIdx] || (q.options || []).map((_, i) => i);

    let html = "";
    html += `<div class="quiz-question-text">${q.text}</div>`;
    if (isMulti) html += `<div class="quiz-hint">Выберите один или несколько правильных ответов</div>`;

    html += `<div class="quiz-options">`;
    optOrder.forEach((origOptIdx) => {
        const opt = q.options[origOptIdx];
        const isCorrectOpt = correctArr.includes(opt);
        const wasSelected = state.selected.includes(origOptIdx);
        let cls = "quiz-opt";
        if (state.done) {
            if (isCorrectOpt) cls += " correct";
            else if (wasSelected) cls += " wrong";
        } else if (state.lastCheckWrong) {
            if (wasSelected && !isCorrectOpt) cls += " wrong";
            else if (wasSelected) cls += " selected";
        } else {
            if (wasSelected) cls += " selected";
        }
        const disabled = state.done ? " disabled" : "";
        const onclick = isMulti ? `onclick="quizToggleOption(${origOptIdx})"` : `onclick="quizAnswer(${origOptIdx})"`;
        html += `<button class="${cls}"${disabled} ${onclick}>${opt}</button>`;
    });
    html += `</div>`;

    if (q.explain) {
        html += `<div class="quiz-explain${state.done ? ' show' : ''}"><strong>💡 Почему так:</strong> ${q.explain}</div>`;
    }

    html += `<div class="quiz-nav-row">`;
    if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
    else html += `<div></div>`;

    if (isMulti) {
        if (state.done) {
            const isLast = qs.currentQuestion === lesson.questions.length - 1;
            const label = isLast ? "К результату →" : "Дальше →";
            html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()">${label}</button>`;
        } else {
            const canCheck = state.selected.length > 0;
            html += `<button class="quiz-nav-btn check" onclick="quizCheckMulti()" ${canCheck ? '' : 'disabled'}>Проверить</button>`;
        }
    } else {
        const isLast = qs.currentQuestion === lesson.questions.length - 1;
        const label = isLast ? "К результату →" : "Дальше →";
        html += `<button class="quiz-nav-btn primary" id="quiz-next-btn" onclick="quizGoNext()" ${state.done ? '' : 'disabled'}>${label}</button>`;
    }
    html += `</div>`;
    return html;
}

function renderMatchQuestion(lesson, q, state, origIdx, qs) {
    let order = qs._matchOrder[origIdx];
    const total = (q.pairs || []).length;

    // Защита: если order сломан — пересобираем на месте
    if (!order
        || !order.leftOrder || !order.rightOrder
        || !Array.isArray(order.leftOrder) || !Array.isArray(order.rightOrder)
        || order.leftOrder.length !== total
        || order.rightOrder.length !== total) {
        const leftOrder = shuffle([...Array(total).keys()]);
        const rightOrder = shuffle([...Array(total).keys()]);
        order = { leftOrder, rightOrder };
        qs._matchOrder[origIdx] = order;
        saveAll();
    }

    const matchedCount = state.matchedPairs.length;
    const allMatched = matchedCount === total;

    const pendingLeft = state._pendingLeft;
    const pendingRight = state._pendingRight;

    let html = "";
    html += `<div class="quiz-question-text">${q.text || "Соедини пары"}</div>`;
    html += `<div class="match-counter">Соединено: ${matchedCount} / ${total}</div>`;

    html += `<div class="match-grid">`;

    html += `<div class="match-col">`;
    order.leftOrder.forEach(pairIdx => {
        const isMatched = state.matchedPairs.includes(pairIdx);
        const isSelected = pendingLeft === pairIdx;
        let cls = "match-item";
        if (isMatched) cls += " matched";
        else if (isSelected) cls += " selected";
        const onclick = isMatched ? "" : `onclick="matchClickLeft(${pairIdx})"`;
        html += `<button class="${cls}" ${onclick}>${q.pairs[pairIdx].left}</button>`;
    });
    html += `</div>`;

    html += `<div class="match-col">`;
    order.rightOrder.forEach(pairIdx => {
        const isMatched = state.matchedPairs.includes(pairIdx);
        const isSelected = pendingRight === pairIdx;
        let cls = "match-item";
        if (isMatched) cls += " matched";
        else if (isSelected) cls += " selected";
        const onclick = isMatched ? "" : `onclick="matchClickRight(${pairIdx})"`;
        html += `<button class="${cls}" ${onclick}>${q.pairs[pairIdx].right}</button>`;
    });
    html += `</div>`;

    html += `</div>`;

    if (allMatched && q.explain) {
        html += `<div class="quiz-explain show"><strong>💡 Почему так:</strong> ${q.explain}</div>`;
    }

    html += `<div class="quiz-nav-row">`;
    if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
    else html += `<div></div>`;
    const isLast = qs.currentQuestion === lesson.questions.length - 1;
    const label = isLast ? "К результату →" : "Дальше →";
    html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()" ${allMatched ? '' : 'disabled'}>${label}</button>`;
    html += `</div>`;

    return html;
}

function matchClickLeft(pairIdx) {
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const state = qs.questionState[origIdx];
    if (state.matchedPairs.includes(pairIdx)) return;

    if (state._pendingLeft === pairIdx) {
        state._pendingLeft = null;
        saveAll(); renderQuiz(); return;
    }
    state._pendingLeft = pairIdx;

    if (state._pendingRight !== null && state._pendingRight !== undefined) {
        const rightIdx = state._pendingRight;
        state._pendingLeft = null;
        state._pendingRight = null;
        checkMatchPair(pairIdx, rightIdx);
        return;
    }
    saveAll(); renderQuiz();
}

function matchClickRight(pairIdx) {
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const state = qs.questionState[origIdx];
    if (state.matchedPairs.includes(pairIdx)) return;

    if (state._pendingRight === pairIdx) {
        state._pendingRight = null;
        saveAll(); renderQuiz(); return;
    }
    state._pendingRight = pairIdx;

    if (state._pendingLeft !== null && state._pendingLeft !== undefined) {
        const leftIdx = state._pendingLeft;
        state._pendingLeft = null;
        state._pendingRight = null;
        checkMatchPair(leftIdx, pairIdx);
        return;
    }
    saveAll(); renderQuiz();
}

function checkMatchPair(leftIdx, rightIdx) {
    const qs = getQuizState(currentLessonId);
    const lesson = allLessons[currentLessonId];
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const q = lesson.questions[origIdx];
    const state = qs.questionState[origIdx];

    if (leftIdx === rightIdx) {
        state.matchedPairs.push(leftIdx);
        state._pendingLeft = null;
        state._pendingRight = null;
        const total = q.pairs.length;
        if (state.matchedPairs.length === total) {
            state.done = true;
            if (!state.hadError) {
                qs.score++;
            }
        }
        saveAll();
        renderQuizNavGrid();
        renderQuiz();
        const done = qs.questionState.filter(s => s && s.done).length;
        quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
    } else {
        state.hadError = true;
        state.wrong = true;
        state._pendingLeft = null;
        state._pendingRight = null;
        saveAll();
        flashMatchWrong(leftIdx, rightIdx);
    }
}

function flashMatchWrong(leftIdx, rightIdx) {
    const qs = getQuizState(currentLessonId);
    const order = qs._matchOrder[qs._questionsOrder[qs.currentQuestion]];
    if (!order || !order.leftOrder || !order.rightOrder) { renderQuiz(); return; }
    const leftPos = order.leftOrder.indexOf(leftIdx);
    const rightPos = order.rightOrder.indexOf(rightIdx);
    const cols = quizContent.querySelectorAll(".match-col");
    if (cols.length < 2) { renderQuiz(); return; }
    const leftBtn = cols[0].querySelectorAll(".match-item")[leftPos];
    const rightBtn = cols[1].querySelectorAll(".match-item")[rightPos];
    if (leftBtn) leftBtn.classList.add("wrong-flash");
    if (rightBtn) rightBtn.classList.add("wrong-flash");
    setTimeout(() => {
        if (leftBtn) leftBtn.classList.remove("wrong-flash");
        if (rightBtn) rightBtn.classList.remove("wrong-flash");
        renderQuiz();
    }, 800);
}

function renderCardQuestion(lesson, q, state, origIdx, qs) {
    const answered = state.userAnswer !== null && state.userAnswer !== undefined;
    const showBack = answered;

    let html = "";
    html += `<div class="card-view">`;

    if (!showBack) {
        html += `<div class="card-face">`;
        if (q.frontImage) html += `<img class="card-face-image" src="${q.frontImage}" alt="" onerror="this.style.display='none'">`;
        html += `<div class="card-face-text">${q.front || ""}</div>`;
        html += `</div>`;
        html += `<div class="card-buttons">`;
        html += `<button class="card-btn dontknow" onclick="cardAnswer('dontknow')" title="Не знаю">✕</button>`;
        html += `<button class="card-btn know" onclick="cardAnswer('know')" title="Знаю">✓</button>`;
        html += `</div>`;
    } else {
        html += `<div class="card-answer-label">Ответ</div>`;
        html += `<div class="card-face">`;
        if (q.backImage) html += `<img class="card-face-image" src="${q.backImage}" alt="" onerror="this.style.display='none'">`;
        html += `<div class="card-face-text">${q.back || ""}</div>`;
        html += `</div>`;
    }

    html += `</div>`;

    html += `<div class="quiz-nav-row">`;
    if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
    else html += `<div></div>`;
    const isLast = qs.currentQuestion === lesson.questions.length - 1;
    const label = isLast ? "К результату →" : "Дальше →";
    html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()" ${answered ? '' : 'disabled'}>${label}</button>`;
    html += `</div>`;

    return html;
}

function cardAnswer(answer) {
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const state = qs.questionState[origIdx];
    if (state.userAnswer !== null && state.userAnswer !== undefined) return;

    state.userAnswer = answer;
    state.done = true;
    if (answer === "know") {
        if (!state.wrong) qs.score++;
    } else {
        state.wrong = true;
    }
    saveAll();
    renderQuizNavGrid();
    renderQuiz();
    const lesson = allLessons[currentLessonId];
    const done = qs.questionState.filter(s => s && s.done).length;
    quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
}

function renderQuizNavGrid() {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    let html = "";
    qs._questionsOrder.forEach((origIdx, displayIdx) => {
        const st = qs.questionState[origIdx] || { done:false, wrong:false };
        let cls = "quiz-nav-num";
        if (st.done) cls += " correct";
        else if (st.wrong) cls += " wrong";
        if (displayIdx === qs.currentQuestion) cls += " current";
        html += `<button class="${cls}" onclick="quizGoTo(${displayIdx})">${displayIdx + 1}</button>`;
    });
    quizNavGrid.innerHTML = html;
}

function quizAnswer(choiceIndex) {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const q = lesson.questions[origIdx];
    const state = qs.questionState[origIdx];
    if (state.done) return;

    const correctArr = normalizeCorrect(q.correct);
    const choice = q.options[choiceIndex];
    const buttons = quizContent.querySelectorAll(".quiz-opt");

    if (correctArr.includes(choice)) {
        state.done = true;
        state.selected = [choiceIndex];
        if (!state.wrong) qs.score++;
        buttons.forEach(b => b.disabled = true);
        buttons[choiceIndex].classList.add("correct");
        const expEl = document.querySelector(".quiz-explain");
        if (expEl) expEl.classList.add("show");
        const nextBtn = document.getElementById("quiz-next-btn");
        if (nextBtn) nextBtn.disabled = false;
    } else {
        state.wrong = true;
        state.selected = [choiceIndex];
        buttons[choiceIndex].classList.add("wrong");
        buttons[choiceIndex].disabled = true;
    }
    saveAll();
    renderQuizNavGrid();
    const done = qs.questionState.filter(s => s && s.done).length;
    quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
}

function quizToggleOption(i) {
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const state = qs.questionState[origIdx];
    if (state.done) return;
    if (!state.selected) state.selected = [];
    const idx = state.selected.indexOf(i);
    if (idx === -1) state.selected.push(i);
    else state.selected.splice(idx, 1);
    state.lastCheckWrong = false;
    saveAll();
    renderQuiz();
}

function quizCheckMulti() {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    const origIdx = qs._questionsOrder[qs.currentQuestion];
    const q = lesson.questions[origIdx];
    const state = qs.questionState[origIdx];
    if (state.done) return;

    const correctArr = normalizeCorrect(q.correct);
    const selected = state.selected || [];
    if (selected.length === 0) { alert("Выберите хотя бы один вариант."); return; }

    const selectedOpts = selected.map(i => q.options[i]);
    const isCorrect =
        selectedOpts.length === correctArr.length &&
        selectedOpts.every(o => correctArr.includes(o));

    if (isCorrect) {
        state.done = true;
        state.lastCheckWrong = false;
        if (!state.wrong) qs.score++;
    } else {
        state.wrong = true;
        state.lastCheckWrong = true;
    }
    saveAll();
    renderQuizNavGrid();
    renderQuiz();
    const done = qs.questionState.filter(s => s && s.done).length;
    quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
}

function quizGoNext() {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    if (qs.currentQuestion < lesson.questions.length) {
        qs.currentQuestion++; saveAll(); renderQuiz();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}
function quizGoPrev() {
    const qs = getQuizState(currentLessonId);
    if (qs.currentQuestion > 0) {
        qs.currentQuestion--; saveAll(); renderQuiz();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}
function quizGoTo(i) {
    const qs = getQuizState(currentLessonId);
    qs.currentQuestion = i; saveAll(); renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildGroupStats(lesson, qs) {
    const groupMap = {};
    const hasGroups = (lesson.groups && lesson.groups.length > 0);
    if (hasGroups) {
        lesson.groups.forEach(g => { groupMap[g] = { name: g, total: 0, correct: 0, questions: [] }; });
    }
    lesson.questions.forEach((q, idx) => {
        const groupName = (q.group && q.group.trim()) ? q.group : (hasGroups ? "__none__" : null);
        if (groupName === null) return;
        if (!groupMap[groupName]) groupMap[groupName] = { name: groupName, total: 0, correct: 0, questions: [] };
        const st = qs.questionState[idx] || {};
        groupMap[groupName].total++;
        if (st.done && !st.wrong) groupMap[groupName].correct++;
        groupMap[groupName].questions.push({ question: q, idx, state: st });
    });
    const arr = Object.values(groupMap).filter(g => g.total > 0);
    arr.sort((a, b) => {
        if (a.name === "__none__") return 1;
        if (b.name === "__none__") return -1;
        return 0;
    });
    return arr;
}

function renderQuizResult(lesson, qs) {
    stopQuizTimer(); qs.completed = true; saveAll();
    const percent = Math.round((qs.score / lesson.questions.length) * 100);
    const groupStats = buildGroupStats(lesson, qs);
    const hasGroups = groupStats.length > 0;

    let html = `<div class="quiz-result-box">`;
    html += `<h2>✓ Тест завершён!</h2>`;
    html += `<div class="score">${qs.score} / ${lesson.questions.length}</div>`;
    html += `<p class="note">правильно (${percent}%)</p>`;
    html += `<p class="time">Время: ${formatTime(qs.timerSeconds || 0)}</p>`;
    html += `<div class="quiz-result-actions">`;
    html += `<button class="btn btn-outline" onclick="quizRestart()">Пройти заново</button>`;
    html += `<button class="btn btn-outline" onclick="exitToMenu()">Завершить блок</button>`;
    const nextId = getNextLessonId(currentLessonId);
    if (nextId) {
        const nextTitle = escapeHtml(allLessons[nextId].title || "далее");
        html += `<button class="btn btn-primary" onclick="goToNextLesson()">${nextTitle} →</button>`;
    } else {
        html += `<button class="btn btn-primary" onclick="exitToMenu()">← В меню</button>`;
    }
    html += `</div></div>`;

    if (hasGroups) {
        html += `<div class="group-stats">`;
        html += `<div class="group-stats-title">📊 Статистика по группам</div>`;
        groupStats.forEach((g, gi) => {
            const pct = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0;
            const displayName = g.name === "__none__" ? "Без группы" : g.name;
            let color = "var(--success)";
            if (pct < 50) color = "var(--error)";
            else if (pct < 80) color = "var(--primary)";

            html += `<div class="group-row" id="group-row-${gi}">`;
            html += `<div class="group-row-head" onclick="toggleGroupRow(${gi})">`;
            html += `<div class="group-row-name"><span class="group-row-arrow">▶</span> ${displayName}</div>`;
            html += `<div class="group-row-right">`;
            html += `<div class="group-row-count">${g.correct} / ${g.total}</div>`;
            html += `<div class="group-row-bar"><div class="group-row-bar-fill" style="width:${pct}%;background:${color};"></div></div>`;
            html += `<div class="group-row-percent" style="color:${color};">${pct}%</div>`;
            html += `</div></div>`;
            html += `<div class="group-row-details">`;
            g.questions.forEach((item) => {
                html += renderStatsQuestion(item);
            });
            html += `</div>`;
            html += `</div>`;
        });
        html += `</div>`;
    }

    quizContent.innerHTML = html;
}

function renderStatsQuestion(item) {
    const q = item.question;
    const st = item.state;
    const isCorrect = st.done && !st.wrong;

    let html = `<div class="group-q-item">`;

    if (q.type === "single" || q.type === "multi") {
        html += `<div class="group-q-text">${q.text} <span class="group-q-status ${isCorrect ? 'ok' : 'fail'}">${isCorrect ? '✓ верно' : '✗ неверно'}</span></div>`;
    } else if (q.type === "match") {
        html += `<div class="group-q-text">${q.text || "Соответствие"} <span class="group-q-status ${isCorrect ? 'ok' : 'fail'}">${isCorrect ? '✓ верно' : '✗ неверно'}</span></div>`;
    } else if (q.type === "card") {
        html += `<div class="group-q-text">Карточка <span class="group-q-status ${isCorrect ? 'ok' : 'fail'}">${isCorrect ? '✓ знал' : '✗ не знал'}</span></div>`;
    }

    if (q.type === "single" || q.type === "multi") {
        const correctArr = normalizeCorrect(q.correct);
        html += `<div class="group-q-answers">`;
        q.options.forEach((opt, oi) => {
            const isCorrectOpt = correctArr.includes(opt);
            const wasSelected = (st.selected || []).includes(oi);
            let cls = "group-q-answer";
            if (wasSelected && isCorrectOpt) cls += " user-correct";
            else if (wasSelected && !isCorrectOpt) cls += " user-wrong";
            else if (isCorrectOpt) cls += " correct-answer";

            let prefix = "○";
            if (wasSelected && isCorrectOpt) prefix = "✓";
            else if (wasSelected) prefix = "✗";
            else if (isCorrectOpt) prefix = "•";

            html += `<div class="${cls}">${prefix} ${opt}</div>`;
        });
        html += `</div>`;
        if (q.explain) html += `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);font-style:italic;line-height:1.5;">💡 ${q.explain}</div>`;
    } else if (q.type === "match") {
        html += `<div class="group-match-pairs">`;
        (q.pairs || []).forEach(p => {
            html += `<div class="group-match-pair correct-answer">${p.left} → ${p.right}</div>`;
        });
        html += `</div>`;
        if (q.explain) html += `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);font-style:italic;line-height:1.5;">💡 ${q.explain}</div>`;
    } else if (q.type === "card") {
        html += `<div class="group-card-view">`;
        html += `<div class="group-card-side">`;
        html += `<div class="group-card-side-label">Передняя сторона</div>`;
        html += `<div>${q.front || ""}</div>`;
        if (q.frontImage) html += `<img src="${q.frontImage}" alt="" onerror="this.style.display='none'">`;
        html += `</div>`;
        html += `<div class="group-card-side">`;
        html += `<div class="group-card-side-label">Задняя сторона</div>`;
        html += `<div>${q.back || ""}</div>`;
        if (q.backImage) html += `<img src="${q.backImage}" alt="" onerror="this.style.display='none'">`;
        html += `</div>`;
        html += `</div>`;
    }

    html += `</div>`;
    return html;
}

function toggleGroupRow(gi) {
    const row = document.getElementById("group-row-" + gi);
    if (row) row.classList.toggle("expanded");
}

function quizRestart() {
    const lesson = allLessons[currentLessonId];
    const qs = getQuizState(currentLessonId);
    qs.currentQuestion = 0; qs.score = 0; qs.timerSeconds = 0; qs.completed = false;
    qs.questionState = lesson.questions.map(q => makeFreshQuestionState(q));
    qs._questionsOrder = null;
    qs._optionsOrder = null;
    qs._matchOrder = null;
    saveAll(); stopQuizTimer(); startQuizTimer();

    if (lesson.randomizeQuestions) {
        qs._questionsOrder = shuffle(lesson.questions.map((_, i) => i));
    } else {
        qs._questionsOrder = lesson.questions.map((_, i) => i);
    }
    qs._optionsOrder = lesson.questions.map(q => {
        if (q.type !== "single" && q.type !== "multi") return null;
        let idxs = (q.options || []).map((_, i) => i);
        if (lesson.randomizeOptions) idxs = shuffle(idxs);
        return idxs;
    });
    qs._matchOrder = lesson.questions.map(q => {
        if (q.type !== "match") return null;
        const n = (q.pairs || []).length;
        return { leftOrder: shuffle([...Array(n).keys()]), rightOrder: shuffle([...Array(n).keys()]) };
    });
    saveAll();
    renderQuiz();
}

/* ===== ПЕЧАТЬ ===== */
function printCurrent() {
    const lesson = allLessons[currentLessonId];
    if (!lesson) { window.print(); return; }

    if (lesson.type === "quiz") {
        const backup = quizContent.innerHTML;
        quizContent.innerHTML = renderQuizForPrint(lesson);
        window.print();
        setTimeout(() => {
            quizContent.innerHTML = backup;
        }, 100);
    } else {
        window.print();
    }
}

function renderQuizForPrint(lesson) {
    let html = "";
    html += `<h1 class="slide-title">${lesson.title}</h1>`;
    lesson.questions.forEach((q, idx) => {
        html += `<div class="print-question-item">`;
        html += `<div class="print-question-number">Вопрос ${idx + 1}</div>`;
        if (q.type === "single" || q.type === "multi") {
            html += `<div class="print-question-text">${q.text || ""}</div>`;
            html += `<div class="print-options">`;
            (q.options || []).forEach((opt) => {
                html += `<div class="print-option">☐ ${escapeHtml(opt)}</div>`;
            });
            html += `</div>`;
        } else if (q.type === "match") {
            html += `<div class="print-question-text">${q.text || "Соедини пары"}</div>`;
            html += `<div class="print-match-pairs">`;
            (q.pairs || []).forEach(p => {
                html += `<div class="print-match-pair">☐ ${escapeHtml(p.left)}</div>`;
            });
            html += `</div>`;
            html += `<div class="print-match-pairs">`;
            (q.pairs || []).forEach(p => {
                html += `<div class="print-match-pair">☐ ${escapeHtml(p.right)}</div>`;
            });
            html += `</div>`;
        } else if (q.type === "card") {
            html += `<div class="print-card-front">${escapeHtml(q.front || "")}</div>`;
        }
        html += `</div>`;
    });
    html += `<div class="print-answers-block">`;
    html += `<h2 class="print-answers-title">Ответы</h2>`;
    lesson.questions.forEach((q, idx) => {
        const n = idx + 1;
        if (q.type === "single" || q.type === "multi") {
            const correctArr = normalizeCorrect(q.correct);
            html += `<div class="print-answer-item"><strong>${n}.</strong> ${escapeHtml(correctArr.join(", "))}</div>`;
        } else if (q.type === "match") {
            const pairsStr = (q.pairs || []).map(p => `${p.left} → ${p.right}`).join("; ");
            html += `<div class="print-answer-item"><strong>${n}.</strong> ${escapeHtml(pairsStr)}</div>`;
        } else if (q.type === "card") {
            html += `<div class="print-answer-item"><strong>${n}.</strong> ${escapeHtml(q.front || "")} → ${escapeHtml(q.back || "")}</div>`;
        }
    });
    html += `</div>`;
    return html;
}

renderMenu();