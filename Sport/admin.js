/* ============================================================
   ADMIN.JS — логика редактора курса
   Требует: data.js загружен ДО этого файла (allLessons, courseSettings)
   ============================================================ */

let state = { currentLessonId: null, currentSlideIndex: 0 };
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
            <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #000;">⚠ Редактор не загрузился</h1>
            <p style="margin: 0 0 16px; font-size: 15px; color: #4A4540;">${reason}</p>
            <div style="padding: 14px 18px; background: #F0D8DC; border-left: 4px solid #8B1A2B; border-radius: 8px; font-size: 14px; line-height: 1.7;">
                <strong>Что делать:</strong><br>
                1. Открой файл <code style="background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace;">data.js</code> в редакторе кода (VS Code).<br>
                2. Проверь, что он не повреждён: все скобки <code>{ }</code> и <code>[ ]</code> закрыты, запятые на месте.<br>
                3. Если правил <code>data.js</code> вручную — верни последнюю рабочую версию через Git или из резервной копии.<br>
                4. Если файл целый — обнови страницу (<code style="background: rgba(0,0,0,.06); padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, Menlo, Consolas, monospace;">Ctrl+F5</code>).
            </div>
        </div>
    `;
}

const COURSE_KEY = (courseSettings && courseSettings.courseKey)
    ? String(courseSettings.courseKey).trim()
    : "default";

const DRAFT_KEY = "kp_course_draft_v1_" + COURSE_KEY;
const PROGRESS_KEY = "kp_course_v1_" + COURSE_KEY;

const MAX_MEMO_CELLS = 8;
const MAX_TABLE_ROWS = 10;
const MAX_TABLE_COLS = 10;
const MAX_LIST_LEVEL = 2;

// Таймаут для fetch (мс). Защита от зависшего запроса, который заблокирует автосохранение.
const FETCH_TIMEOUT_MS = 15000;

let pvState = null;

// ============================================================
// УТИЛИТА: безопасный JSON.stringify для вставки в data.js
// Экранирует \u2028 и \u2029 — иначе JS-парсер в браузере сломается,
// если в тексте есть эти символы (часто — при копипасте из Word).
// ============================================================
function safeJsonStringify(obj) {
    return JSON.stringify(obj, null, 4)
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

// fetch с таймаутом. Бросает Error по истечении FETCH_TIMEOUT_MS.
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

// ============================================================
// ВЫПАДАЮЩИЕ МЕНЮ
// ============================================================
function toggleDropdown(event, menuId) {
    event.stopPropagation();
    const menu = document.getElementById(menuId);
    if (!menu) return;
    const isOpen = menu.classList.contains("show");
    closeAllDropdowns();
    if (!isOpen) menu.classList.add("show");
}

function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-menu.show").forEach(m => m.classList.remove("show"));
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown-wrap")) {
        closeAllDropdowns();
    }
});

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
    content.forEach(b => {
        migrateListBlock(b);
        if (b && b.type === "image" && !Array.isArray(b.markers)) {
            b.markers = [];
        }
    });
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
    }
});

Object.values(allLessons).forEach(lesson => {
    if (lesson.type === "theory" && lesson.slides) {
        lesson.slides.forEach(slide => {
            if (!slide.content) slide.content = [];
            migrateListBlocksInContent(slide.content);
            if (slide.video && slide.video.trim()) {
                const hasVideo = slide.content.some(b => b.type === "video");
                if (!hasVideo) slide.content.unshift({ type: "video", src: slide.video });
                slide.video = "";
            }
            if (slide.image && slide.image.trim()) {
                const hasImage = slide.content.some(b => b.type === "image");
                if (!hasImage) slide.content.unshift({ type: "image", src: slide.image, alt: "", markers: [] });
                slide.image = "";
            }
        });
    }
});

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    if (pvState) renderPreview();
}
function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}
(function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") applyTheme(saved);
    else {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        applyTheme(prefersDark ? "dark" : "light");
    }
})();

function init() {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
        try {
            const parsed = JSON.parse(draft);
            if (parsed && parsed.allLessons) {
                for (const k in parsed.allLessons) allLessons[k] = parsed.allLessons[k];
                for (const k in allLessons) if (!parsed.allLessons[k]) delete allLessons[k];
                if (parsed.courseSettings) for (const k in parsed.courseSettings) courseSettings[k] = parsed.courseSettings[k];
                Object.values(allLessons).forEach(lesson => {
                    if (lesson.type === "quiz" && lesson.questions) {
                        lesson.questions.forEach(q => {
                            q.type = detectType(q);
                            if (q.type === "single" || q.type === "multi") {
                                q.correct = normalizeCorrect(q.correct);
                            }
                            if (q.group === undefined) q.group = null;
                        });
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
                setStatus("Продолжаем с несохранённого черновика", "warn");
            }
        } catch (e) {}
    }

    // ЗАЩИТА: если в курсе нет ни одного блока — показываем сообщение
    const ids = Object.keys(allLessons);
    if (ids.length === 0) {
        // Создаём хотя бы один блок по умолчанию, иначе редактор работать не сможет
        const key = "new_lesson";
        allLessons[key] = {
            type: "theory",
            title: "Новый блок",
            slides: [{
                shortName: "Новый слайд",
                title: "Новый слайд",
                content: [{ type: "p", text: "Текст нового слайда." }]
            }]
        };
        setStatus("Курс был пустой — создан первый блок «Новый блок».", "warn");
    }

    state.currentLessonId = Object.keys(allLessons)[0];
    state.currentSlideIndex = 0;
    refreshAll();
}

function currentLesson() { return allLessons[state.currentLessonId]; }

function refreshAll() {
    document.getElementById("course-title-input").value = courseSettings.courseTitle || "";
    document.getElementById("page-title-input").value = courseSettings.pageTitle || "";
    renderLessonList();
    const lesson = currentLesson();
    if (!lesson) return;
    document.getElementById("lesson-title-input").value = lesson.title;
    document.getElementById("lesson-description-input").value = lesson.description || "";
    document.getElementById("lesson-cover-input").value = lesson.coverImage || "";
    renderLessonCoverPreview();
    const typeLabels = { quiz: "Тест", theory: "Теория", memo: "Памятка", glossary: "Глоссарий" };
    document.getElementById("lesson-type-display").value = typeLabels[lesson.type] || lesson.type;

    document.getElementById("theory-editor").style.display = "none";
    document.getElementById("quiz-editor").style.display = "none";
    document.getElementById("memo-editor").style.display = "none";
    document.getElementById("glossary-editor").style.display = "none";
    document.getElementById("term-search-wrap").style.display = "none";

    const csvBtns = document.getElementById("glossary-csv-btns");
    if (csvBtns) csvBtns.style.display = (lesson.type === "glossary") ? "flex" : "none";

    if (lesson.type === "quiz") {
        document.getElementById("quiz-editor").style.display = "block";
        document.getElementById("slides-card").style.display = "none";
        renderGroupsEditor(lesson);
        renderQuizEditor(lesson);
    } else if (lesson.type === "memo") {
        document.getElementById("memo-editor").style.display = "block";
        document.getElementById("slides-card").style.display = "block";
        document.getElementById("cells-section-title").textContent = "Ячейки памятки";
        document.getElementById("add-slide-btn").textContent = "＋ Ячейка";
        renderCellsList(); renderCell();
    } else if (lesson.type === "glossary") {
        document.getElementById("glossary-editor").style.display = "block";
        document.getElementById("slides-card").style.display = "block";
        document.getElementById("term-search-wrap").style.display = "block";
        document.getElementById("cells-section-title").textContent = "Термины глоссария";
        document.getElementById("add-slide-btn").textContent = "＋ Термин";
        renderTermsList(); renderTerm();
    } else {
        document.getElementById("theory-editor").style.display = "block";
        document.getElementById("slides-card").style.display = "block";
        document.getElementById("cells-section-title").textContent = "Слайды блока";
        document.getElementById("add-slide-btn").textContent = "＋ Слайд";
        renderSlideList(); renderSlide();
    }
}

/* ============================================================
   БЛОКИ КУРСА — с ручкой, ⋮ и drag&drop
   ============================================================ */
function renderLessonList() {
    const list = document.getElementById("lesson-list");
    list.innerHTML = "";
    const ids = Object.keys(allLessons);

    ids.forEach((id, index) => {
        const l = allLessons[id];
        const row = document.createElement("div");
        row.className = "lesson-row";
        row.dataset.lessonId = id;

        const handle = document.createElement("div");
        handle.className = "drag-handle";
        handle.textContent = "⠿";
        handle.title = "Перетащи, чтобы переместить";
        handle.draggable = true;
        row.appendChild(handle);

        const btn = document.createElement("button");
        btn.className = "lesson-item" + (id === state.currentLessonId ? " current" : "");
        let typeLabel, count;
        if (l.type === "quiz") {
            typeLabel = "Тест";
            count = `${l.questions.length} вопросов`;
        } else if (l.type === "memo") {
            typeLabel = "Памятка";
            const n = (l.cells || []).length;
            count = `${n} ${pluralizeCells(n)}`;
        } else if (l.type === "glossary") {
            typeLabel = "Глоссарий";
            const n = (l.terms || []).length;
            count = `${n} ${pluralizeTerms(n)}`;
        } else {
            typeLabel = "Теория";
            count = `${l.slides.length} слайдов`;
        }
        const safeId = escapeHtml(id);
        const safeTitle = escapeHtml(l.title);
        btn.innerHTML = `${safeTitle}<span class="ltype">${typeLabel} · ${count}</span><span class="lkey" title="Кликни, чтобы скопировать ключ">${safeId}</span>`;
        btn.onclick = () => { readFromDom(); state.currentLessonId = id; state.currentSlideIndex = 0; refreshAll(); };
        row.appendChild(btn);

        const keyEl = btn.querySelector(".lkey");
        if (keyEl) {
            keyEl.addEventListener("click", (e) => {
                e.stopPropagation();
                copyToClipboard(id);
            });
        }

        const menuBtn = document.createElement("button");
        menuBtn.className = "lesson-menu-btn";
        menuBtn.textContent = "⋮";
        menuBtn.title = "Действия с блоком";
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            openLessonContextMenu(e, id, index, ids.length);
        };
        row.appendChild(menuBtn);

        setupLessonDrag(row, handle, id, index);

        list.appendChild(row);
    });
}

function openLessonContextMenu(event, id, index, totalCount) {
    event.stopPropagation();
    const old = document.getElementById("lesson-ctx-menu");
    if (old) old.remove();

    const menu = document.createElement("div");
    menu.className = "dropdown-menu show";
    menu.id = "lesson-ctx-menu";
    menu.style.position = "fixed";
    menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + "px";
    menu.style.top = (event.clientY + 4) + "px";
    menu.style.zIndex = "1000";

    if (index > 0) {
        const upBtn = document.createElement("button");
        upBtn.textContent = "↑ Переместить вверх";
        upBtn.onclick = () => { menu.remove(); moveLesson(id, -1); };
        menu.appendChild(upBtn);
    }
    if (index < totalCount - 1) {
        const dnBtn = document.createElement("button");
        dnBtn.textContent = "↓ Переместить вниз";
        dnBtn.onclick = () => { menu.remove(); moveLesson(id, 1); };
        menu.appendChild(dnBtn);
    }

    const dupBtn = document.createElement("button");
    dupBtn.textContent = "📋 Дублировать";
    dupBtn.onclick = () => { menu.remove(); duplicateLesson(id); };
    menu.appendChild(dupBtn);

    const expBtn = document.createElement("button");
    expBtn.textContent = "📤 Экспортировать блок";
    expBtn.onclick = () => { menu.remove(); exportLesson(id); };
    menu.appendChild(expBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕ Удалить блок";
    delBtn.style.color = "var(--error)";
    delBtn.onclick = () => {
        menu.remove();
        if (state.currentLessonId !== id) {
            readFromDom();
            state.currentLessonId = id;
            state.currentSlideIndex = 0;
            refreshAll();
        }
        deleteLesson();
    };
    menu.appendChild(delBtn);

    document.body.appendChild(menu);

    setTimeout(() => {
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener("click", closeHandler);
            }
        };
        document.addEventListener("click", closeHandler);
    }, 0);
}

function setupLessonDrag(row, handle, lessonId, index) {
    handle.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", lessonId);
        row.classList.add("dragging");
        document.body.dataset.dragType = "lesson";
    });

    handle.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        document.querySelectorAll(".lesson-row").forEach(r => {
            r.classList.remove("drag-over-top", "drag-over-bottom");
        });
    });

    row.addEventListener("dragover", (e) => {
        if (document.body.dataset.dragType !== "lesson") return;
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
            row.classList.add("drag-over-top");
            row.classList.remove("drag-over-bottom");
        } else {
            row.classList.add("drag-over-bottom");
            row.classList.remove("drag-over-top");
        }
    });

    row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over-top", "drag-over-bottom");
    });

    row.addEventListener("drop", (e) => {
        if (document.body.dataset.dragType !== "lesson") return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === lessonId) return;

        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const insertAfter = e.clientY >= midpoint;

        readFromDom();
        reorderLesson(draggedId, lessonId, insertAfter);
    });
}

function reorderLesson(draggedId, targetId, insertAfter) {
    const ids = Object.keys(allLessons);
    const draggedIdx = ids.indexOf(draggedId);
    const targetIdx = ids.indexOf(targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const entries = Object.entries(allLessons);
    const [dragged] = entries.splice(draggedIdx, 1);

    let newTargetIdx = entries.findIndex(([k]) => k === targetId);
    if (newTargetIdx === -1) { entries.push(dragged); }
    else {
        const insertIdx = insertAfter ? newTargetIdx + 1 : newTargetIdx;
        entries.splice(insertIdx, 0, dragged);
    }

    for (const k in allLessons) delete allLessons[k];
    entries.forEach(([k, v]) => { allLessons[k] = v; });

    renderLessonList();
    saveDraft();
    autoSaveToServer();
}

function copyToClipboard(text) {
    const onSuccess = () => setStatus("📋 Ключ скопирован: " + text, "ok");
    const onFail = () => setStatus("⚠ Не удалось скопировать. Ключ: " + text, "err");
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand("copy"); onSuccess(); } catch(e) { onFail(); }
                document.body.removeChild(ta);
            });
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); onSuccess(); } catch(e) { onFail(); }
            document.body.removeChild(ta);
        }
    } catch (e) {
        onFail();
    }
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

function moveLesson(id, direction) {
    readFromDom();
    const ids = Object.keys(allLessons);
    const index = ids.indexOf(id);
    const ni = index + direction;
    if (ni < 0 || ni >= ids.length) return;
    const entries = Object.entries(allLessons);
    const [moved] = entries.splice(index, 1);
    entries.splice(ni, 0, moved);
    for (const k in allLessons) delete allLessons[k];
    entries.forEach(([k, v]) => { allLessons[k] = v; });
    renderLessonList(); saveDraft();
    autoSaveToServer();
}

function duplicateLesson(id) {
    readFromDom();
    const original = allLessons[id];
    if (!original) return;

    const copy = JSON.parse(JSON.stringify(original));
    copy.title = (copy.title || "Без названия") + " (копия)";

    let baseKey = id + "_copy";
    let finalKey = baseKey;
    let n = 1;
    while (allLessons[finalKey]) {
        finalKey = baseKey + "_" + n;
        n++;
        if (n > 1000) { alert("Слишком много копий"); return; }
    }

    const entries = Object.entries(allLessons);
    const index = entries.findIndex(([k]) => k === id);
    entries.splice(index + 1, 0, [finalKey, copy]);

    for (const k in allLessons) delete allLessons[k];
    entries.forEach(([k, v]) => { allLessons[k] = v; });

    state.currentLessonId = finalKey;
    state.currentSlideIndex = 0;

    refreshAll();
    saveDraft();
    autoSaveToServer();
    setStatus("📋 Создана копия блока: " + copy.title, "ok");
}

/* ============================================================
   СЛАЙДЫ — с ручкой, ⋮ и drag&drop
   ============================================================ */
function renderSlideList() {
    const slides = currentLesson().slides || [];
    const list = document.getElementById("slide-list");
    list.innerHTML = "";
    slides.forEach((s, i) => {
        const row = createSlideRow({
            index: i,
            title: s.shortName || s.title || "Без названия",
            icon: (s.content || []).some(b => b.type === "image" || b.type === "video") ? "🖼 " : "📄 ",
            current: i === state.currentSlideIndex,
            type: "slide"
        });
        list.appendChild(row);
    });
}

function renderCellsList() {
    const lesson = currentLesson();
    const cells = lesson.cells || [];
    const list = document.getElementById("slide-list");
    list.innerHTML = "";
    cells.forEach((c, i) => {
        const title = c.title ? c.title : "(без заголовка)";
        const icon = (c.content || []).some(b => b.type === "image" || b.type === "video") ? "🖼 " : "📌 ";
        const row = createSlideRow({
            index: i,
            title: title,
            icon: icon,
            current: i === state.currentSlideIndex,
            type: "cell"
        });
        list.appendChild(row);
    });
    const addBtn = document.getElementById("add-slide-btn");
    if (cells.length >= MAX_MEMO_CELLS) {
        addBtn.disabled = true;
        addBtn.title = "Максимум " + MAX_MEMO_CELLS + " ячеек";
        addBtn.style.opacity = ".5";
        addBtn.style.cursor = "not-allowed";
    } else {
        addBtn.disabled = false;
        addBtn.title = "";
        addBtn.style.opacity = "";
        addBtn.style.cursor = "";
    }
}

function renderTermsList() {
    const lesson = currentLesson();
    const list = document.getElementById("slide-list");
    list.innerHTML = "";

    const sorted = getSortedTermsWithIndexes(lesson);

    const searchEl = document.getElementById("term-search");
    const query = searchEl ? String(searchEl.value || "").trim().toLowerCase() : "";

    let shown = 0;
    sorted.forEach(item => {
        const name = String(item.term.name || "").trim();
        if (query && !name.toLowerCase().includes(query)) return;
        shown++;

        const row = createSlideRow({
            index: item.origIndex,
            title: name || "(без названия)",
            icon: "",
            current: item.origIndex === state.currentSlideIndex,
            type: "term"
        });
        list.appendChild(row);
    });

    if (shown === 0 && query) {
        const empty = document.createElement("div");
        empty.style.cssText = "font-size:13px;color:var(--text-muted);font-style:italic;padding:8px 4px;";
        empty.textContent = "Ничего не найдено";
        list.appendChild(empty);
    }

    const addBtn = document.getElementById("add-slide-btn");
    addBtn.disabled = false;
    addBtn.title = "";
    addBtn.style.opacity = "";
    addBtn.style.cursor = "";
}

function createSlideRow(opts) {
    const { index, title, icon, current, type } = opts;
    const row = document.createElement("div");
    row.className = "slide-row";
    row.dataset.index = index;
    row.dataset.type = type;

    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = "Перетащи, чтобы переместить";
    handle.draggable = true;
    row.appendChild(handle);

    const btn = document.createElement("button");
    btn.className = "slide-item" + (current ? " current" : "");
    btn.textContent = icon + (index + 1) + ". " + title;
    btn.onclick = () => {
        readFromDom();
        state.currentSlideIndex = index;
        const lesson = currentLesson();
        if (lesson.type === "memo") { renderCellsList(); renderCell(); }
        else if (lesson.type === "glossary") { renderTermsList(); renderTerm(); }
        else { renderSlideList(); renderSlide(); }
    };
    row.appendChild(btn);

    const menuBtn = document.createElement("button");
    menuBtn.className = "slide-menu-btn";
    menuBtn.textContent = "⋮";
    menuBtn.title = "Действия";
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        openSlideContextMenu(e, index, type);
    };
    row.appendChild(menuBtn);

    setupSlideDrag(row, handle, index, type);

    return row;
}

function openSlideContextMenu(event, index, type) {
    event.stopPropagation();
    const old = document.getElementById("slide-ctx-menu");
    if (old) old.remove();

    const lesson = currentLesson();
    const items = type === "cell" ? (lesson.cells || [])
        : type === "term" ? (lesson.terms || [])
        : (lesson.slides || []);

    const menu = document.createElement("div");
    menu.className = "dropdown-menu show";
    menu.id = "slide-ctx-menu";
    menu.style.position = "fixed";
    menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + "px";
    menu.style.top = (event.clientY + 4) + "px";
    menu.style.zIndex = "1000";

    if (index > 0) {
        const upBtn = document.createElement("button");
        upBtn.textContent = "↑ Переместить вверх";
        upBtn.onclick = () => { menu.remove(); moveSlide(index, -1, type); };
        menu.appendChild(upBtn);
    }
    if (index < items.length - 1) {
        const dnBtn = document.createElement("button");
        dnBtn.textContent = "↓ Переместить вниз";
        dnBtn.onclick = () => { menu.remove(); moveSlide(index, 1, type); };
        menu.appendChild(dnBtn);
    }

    const dupBtn = document.createElement("button");
    dupBtn.textContent = "📋 Дублировать";
    dupBtn.onclick = () => {
        menu.remove();
        readFromDom();
        state.currentSlideIndex = index;
        duplicateSlide();
    };
    menu.appendChild(dupBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕ Удалить";
    delBtn.style.color = "var(--error)";
    delBtn.onclick = () => {
        menu.remove();
        readFromDom();
        state.currentSlideIndex = index;
        deleteSlide();
    };
    menu.appendChild(delBtn);

    document.body.appendChild(menu);

    setTimeout(() => {
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener("click", closeHandler);
            }
        };
        document.addEventListener("click", closeHandler);
    }, 0);
}

function setupSlideDrag(row, handle, index, type) {
    handle.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        row.classList.add("dragging");
        document.body.dataset.dragType = "slide-" + type;
    });

    handle.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        document.querySelectorAll(".slide-row").forEach(r => {
            r.classList.remove("drag-over-top", "drag-over-bottom");
        });
    });

    row.addEventListener("dragover", (e) => {
        if (document.body.dataset.dragType !== "slide-" + type) return;
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (e.clientY < midpoint) {
            row.classList.add("drag-over-top");
            row.classList.remove("drag-over-bottom");
        } else {
            row.classList.add("drag-over-bottom");
            row.classList.remove("drag-over-top");
        }
    });

    row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over-top", "drag-over-bottom");
    });

    row.addEventListener("drop", (e) => {
        if (document.body.dataset.dragType !== "slide-" + type) return;
        e.preventDefault();
        const draggedIdx = parseInt(e.dataTransfer.getData("text/plain"));
        if (isNaN(draggedIdx) || draggedIdx === index) return;

        const rect = row.getBoundingClientRect();
        const insertAfter = e.clientY >= rect.top + rect.height / 2;

        readFromDom();
        reorderSlide(draggedIdx, index, insertAfter, type);
    });
}

function reorderSlide(draggedIdx, targetIdx, insertAfter, type) {
    const lesson = currentLesson();
    let arr;
    if (type === "cell") arr = lesson.cells;
    else if (type === "term") arr = lesson.terms;
    else arr = lesson.slides;

    if (!arr) return;

    const [dragged] = arr.splice(draggedIdx, 1);
    let newTargetIdx = targetIdx;
    if (draggedIdx < targetIdx) newTargetIdx--;
    const insertIdx = insertAfter ? newTargetIdx + 1 : newTargetIdx;
    arr.splice(insertIdx, 0, dragged);

    if (state.currentSlideIndex === draggedIdx) {
        state.currentSlideIndex = insertIdx;
    } else if (state.currentSlideIndex > draggedIdx && state.currentSlideIndex <= insertIdx) {
        state.currentSlideIndex--;
    } else if (state.currentSlideIndex < draggedIdx && state.currentSlideIndex >= insertIdx) {
        state.currentSlideIndex++;
    }

    if (type === "cell") { renderCellsList(); }
    else if (type === "term") { renderTermsList(); }
    else { renderSlideList(); }

    saveDraft();
    autoSaveToServer();
}

function moveSlide(index, direction, type) {
    readFromDom();
    const lesson = currentLesson();
    let arr;
    if (type === "cell") arr = lesson.cells;
    else if (type === "term") arr = lesson.terms;
    else arr = lesson.slides;

    if (!arr) return;
    const ni = index + direction;
    if (ni < 0 || ni >= arr.length) return;
    const [item] = arr.splice(index, 1);
    arr.splice(ni, 0, item);

    if (state.currentSlideIndex === index) state.currentSlideIndex = ni;
    else if (state.currentSlideIndex === ni) state.currentSlideIndex = index;

    if (type === "cell") { renderCellsList(); }
    else if (type === "term") { renderTermsList(); }
    else { renderSlideList(); }
    saveDraft();
    autoSaveToServer();
}

function renderSlide() {
    const slide = currentLesson().slides[state.currentSlideIndex];
    if (!slide) return;
    document.getElementById("slide-shortname-input").value = slide.shortName || "";
    document.getElementById("slide-title-input").value = slide.title || "";
    const box = document.getElementById("preview-content");
    box.innerHTML = "";
    (slide.content || []).forEach((b, i) => box.appendChild(createBlockElement(b, i, "slide")));
}

function renderCell() {
    const lesson = currentLesson();
    const cell = lesson.cells[state.currentSlideIndex];
    if (!cell) return;
    document.getElementById("cell-title-input").value = cell.title || "";
    const box = document.getElementById("memo-content");
    box.innerHTML = "";
    (cell.content || []).forEach((b, i) => box.appendChild(createBlockElement(b, i, "memo")));
}

function renderTerm() {
    const lesson = currentLesson();
    const term = (lesson.terms || [])[state.currentSlideIndex];
    if (!term) {
        document.getElementById("term-name-input").value = "";
        document.getElementById("term-content").innerHTML = "";
        return;
    }
    document.getElementById("term-name-input").value = term.name || "";
    const box = document.getElementById("term-content");
    box.innerHTML = "";
    (term.content || []).forEach((b, i) => box.appendChild(createBlockElement(b, i, "glossary")));
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

function addTermBlock(type) {
    readFromDom();
    const term = currentLesson().terms[state.currentSlideIndex];
    if (!term) return;
    const nb = makeNewBlock(type);
    term.content.push(nb); renderTerm(); saveDraft();
}

function removeTermBlock(btn) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    currentLesson().terms[state.currentSlideIndex].content.splice(idx, 1);
    renderTerm(); saveDraft();
}

function moveTermBlock(btn, dir) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    const ni = idx + dir;
    const term = currentLesson().terms[state.currentSlideIndex];
    if (ni < 0 || ni >= term.content.length) return;
    const [it] = term.content.splice(idx, 1);
    term.content.splice(ni, 0, it);
    renderTerm(); saveDraft();
}

/* ============================================================
   CSV ГЛОССАРИЯ — ИМПОРТ И ЭКСПОРТ
   ============================================================ */
function termContentToText(blocks) {
    const lines = [];
    (blocks || []).forEach(b => {
        if (b.type === "p" || b.type === "h3") {
            let txt = stripHtml(b.text || "").trim();
            txt = stripNoteMarkers(txt, b.notes);
            if (txt) lines.push(txt);
        } else if (b.type === "quote") {
            let txt = stripHtml(b.text || "").trim();
            txt = stripNoteMarkers(txt, b.notes);
            if (txt) lines.push(txt);
        } else if (b.type === "ul") {
            (b.items || []).forEach(item => {
                const txt = (typeof item === "string") ? item : (item.text || "");
                const clean = stripHtml(txt).trim();
                if (clean) lines.push("• " + clean);
            });
        } else if (b.type === "link") {
            const txt = stripHtml(b.text || "Ссылка").trim();
            const href = b.href || "";
            if (href) lines.push(txt + " → " + href);
            else lines.push(txt);
        }
    });
    return lines.join("\n");
}

// Убирает ((N)) из текста и по возможности подставляет само примечание.
function stripNoteMarkers(text, notes) {
    if (!text) return "";
    return String(text).replace(/\(\((\d+)\)\)/g, (m, nStr) => {
        const n = parseInt(nStr, 10);
        if (Array.isArray(notes) && n >= 1 && n <= notes.length) {
            return "[" + notes[n - 1] + "]";
        }
        return "";
    });
}

function textToTermContent(text) {
    if (!text) return [{ type: "p", text: "" }];
    const lines = String(text).split(/\r?\n/);
    const blocks = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (/^[•\-*]\s+/.test(trimmed)) {
            const itemText = trimmed.replace(/^[•\-*]\s+/, "");
            const last = blocks[blocks.length - 1];
            if (last && last.type === "ul") {
                last.items.push({ text: itemText, level: 0 });
            } else {
                blocks.push({
                    type: "ul",
                    style: "bullet",
                    items: [{ text: itemText, level: 0 }]
                });
            }
        } else if (/^###\s+/.test(trimmed)) {
            blocks.push({ type: "h3", text: trimmed.replace(/^#+\s+/, "") });
        } else {
            blocks.push({ type: "p", text: trimmed });
        }
    });

    if (blocks.length === 0) blocks.push({ type: "p", text: "" });
    return blocks;
}

function stripHtml(html) {
    if (!html) return "";
    let s = String(html);
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/(p|div|h[1-6]|li)>/gi, "\n");
    s = s.replace(/<[^>]+>/g, "");
    s = s.replace(/&nbsp;/g, " ");
    s = s.replace(/&amp;/g, "&");
    s = s.replace(/&lt;/g, "<");
    s = s.replace(/&gt;/g, ">");
    s = s.replace(/&quot;/g, '"');
    s = s.replace(/&#39;/g, "'");
    s = s.replace(/\n{2,}/g, "\n");
    return s;
}

function csvEscape(value) {
    const s = String(value == null ? "" : value);
    if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function exportGlossaryCsv() {
    readFromDom();
    const lesson = currentLesson();
    if (!lesson || lesson.type !== "glossary") {
        setStatus("Экспорт доступен только для глоссария.", "err");
        return;
    }
    const terms = lesson.terms || [];
    if (terms.length === 0) {
        setStatus("В глоссарии нет терминов.", "err");
        return;
    }

    const lines = [];
    terms.forEach(term => {
        const name = String(term.name || "").trim();
        const content = termContentToText(term.content);
        lines.push(csvEscape(name) + ";" + csvEscape(content));
    });

    const content = "\uFEFF" + lines.join("\r\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (COURSE_KEY || "glossary").replace(/[^a-zA-Z0-9._-]/g, "_");
    a.href = url;
    a.download = safeName + "_glossary.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("📤 Экспортировано терминов: " + terms.length, "ok");
}

function importGlossaryCsv() {
    const lesson = currentLesson();
    if (!lesson || lesson.type !== "glossary") {
        setStatus("Импорт доступен только для глоссария.", "err");
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,text/csv";
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let text = String(reader.result || "");
            if (/\uFFFD/.test(text.slice(0, 1000))) {
                const reader2 = new FileReader();
                reader2.onload = () => {
                    try {
                        processGlossaryCsv(String(reader2.result || ""), file.name);
                    } catch (e) {
                        processGlossaryCsv(text, file.name);
                    }
                };
                reader2.readAsText(file, "windows-1251");
            } else {
                processGlossaryCsv(text, file.name);
            }
        };
        reader.readAsText(file, "utf-8");
    };
    input.click();
}

function processGlossaryCsv(text, fileName) {
    const parsed = parseCsv(text);
    const rows = parsed.rows;
    if (rows.length === 0) {
        setStatus("Файл пустой.", "err");
        return;
    }

    let startRow = 0;
    const firstRow = rows[0] || [];
    const firstCell = String(firstRow[0] || "").trim().toLowerCase();
    if (firstCell === "термин" || firstCell === "term" || firstCell === "name"
        || firstCell === "передняя сторона" || firstCell === "front") {
        startRow = 1;
    }

    const terms = [];
    for (let r = startRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const name = String(row[0] || "").trim();
        if (!name) continue;
        const contentText = String(row[1] || "").trim();
        const content = textToTermContent(contentText);
        terms.push({ name, content });
    }

    if (terms.length === 0) {
        setStatus("В файле не найдено ни одного термина.", "err");
        return;
    }

    const choice = confirm(
        "Найдено терминов: " + terms.length + ".\n\n" +
        "ОК — ЗАМЕНИТЬ все текущие термины.\n" +
        "Отмена — ДОБАВИТЬ к существующим."
    );

    readFromDom();
    if (choice) {
        lesson.terms = terms;
        state.currentSlideIndex = 0;
        setStatus("📥 Импортировано (заменено): " + terms.length, "ok");
    } else {
        if (!lesson.terms) lesson.terms = [];
        lesson.terms = lesson.terms.concat(terms);
        setStatus("📥 Импортировано (добавлено): " + terms.length, "ok");
    }

    refreshAll();
    saveDraft();
    autoSaveToServer();
}

/* ============================================================
   WIKI-АВТОКОМПЛИТ
   ============================================================ */
function getLessonIcon(type) {
    if (type === "quiz") return "🧪";
    if (type === "memo") return "📌";
    if (type === "glossary") return "📖";
    return "📄";
}

function getLessonTypeLabel(type) {
    if (type === "quiz") return "Тест";
    if (type === "memo") return "Памятка";
    if (type === "glossary") return "Глоссарий";
    return "Теория";
}

function getWikiAutocompleteItems(query) {
    const q = String(query || "").toLowerCase().trim();
    const items = [];
    for (const id in allLessons) {
        const lesson = allLessons[id];
        const title = lesson.title || "Без названия";
        const matchById = id.toLowerCase().includes(q);
        const matchByTitle = title.toLowerCase().includes(q);
        if (!q || matchById || matchByTitle) {
            items.push({ id, title, type: lesson.type });
        }
    }
    const order = { theory: 0, quiz: 1, memo: 2, glossary: 3 };
    items.sort((a, b) => {
        if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
        return a.title.localeCompare(b.title, "ru");
    });
    return items;
}

function getTextBeforeCaret(editable) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return null;
    const preRange = range.cloneRange();
    preRange.selectNodeContents(editable);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString();
}

function getCaretRect(editable) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return null;
    let rect = range.getBoundingClientRect();
    if (!rect || (rect.top === 0 && rect.left === 0 && rect.width === 0)) {
        const edRect = editable.getBoundingClientRect();
        return { top: edRect.bottom, left: edRect.left, bottom: edRect.bottom };
    }
    return rect;
}

// Заменяет текст от triggerStart до текущей позиции курсора на replacement.
// ВАЖНО: сначала вызываем editable.normalize() — это склеивает все соседние
// текстовые ноды в одну. Без этого setStart/setEnd могут указывать на разные
// ноды, и Range.deleteContents() удалит не то, что нужно (отсюда были двойные ]].
function replaceWikiTrigger(editable, triggerStart, replacement) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const currentRange = sel.getRangeAt(0);
    if (!editable.contains(currentRange.startContainer)) return;

    // 1. Склеиваем соседние текстовые ноды
    try { editable.normalize(); } catch (e) {}

    // Заново берём каретку после normalize
    const sel2 = window.getSelection();
    if (!sel2 || sel2.rangeCount === 0) return;
    const caretRange = sel2.getRangeAt(0);
    if (!editable.contains(caretRange.startContainer)) return;

    // 2. Ищем text-ноду и позицию triggerStart
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    let charCount = 0;
    let startNode = null;
    let startOffset = 0;
    let node;
    while ((node = walker.nextNode())) {
        const len = node.textContent.length;
        if (charCount + len > triggerStart) {
            startNode = node;
            startOffset = triggerStart - charCount;
            break;
        }
        charCount += len;
    }

    // Если не нашли — откатываемся на execCommand (крайний случай)
    if (!startNode) {
        document.execCommand("insertText", false, replacement);
        return;
    }

    // 3. Строим Range от triggerStart до текущей каретки
    const r = document.createRange();
    try {
        r.setStart(startNode, startOffset);
        r.setEnd(caretRange.endContainer, caretRange.endOffset);
    } catch (e) {
        // Не получилось — fallback
        document.execCommand("insertText", false, replacement);
        return;
    }

    // 4. Удаляем и вставляем
    try {
        r.deleteContents();
        const textNode = document.createTextNode(replacement);
        r.insertNode(textNode);

        // Курсор — после вставленного текста
        const newRange = document.createRange();
        newRange.setStart(textNode, replacement.length);
        newRange.collapse(true);
        sel2.removeAllRanges();
        sel2.addRange(newRange);
    } catch (e) {
        console.warn("replaceWikiTrigger: не удалось заменить", e);
        document.execCommand("insertText", false, replacement);
    }
}

function initWikiAutocomplete(editable) {
    let popup = null;
    let triggerStart = -1;
    let currentItems = [];
    let selectedIdx = 0;
    let ignoreNextInput = false;
    let isPickingFromPopup = false;
    let ignoreResetTimer = null;

    function closePopup() {
        if (popup) { popup.remove(); popup = null; }
        triggerStart = -1;
        currentItems = [];
        selectedIdx = 0;
    }

    function renderPopup() {
        if (!popup) return;
        popup.innerHTML = "";

        if (currentItems.length === 0) {
            const empty = document.createElement("div");
            empty.className = "wiki-autocomplete-empty";
            empty.textContent = "Ничего не найдено";
            popup.appendChild(empty);
            return;
        }

        currentItems.forEach((item, i) => {
            const el = document.createElement("div");
            el.className = "wiki-autocomplete-item" + (i === selectedIdx ? " selected" : "");
            const icon = getLessonIcon(item.type);
            const typeLabel = getLessonTypeLabel(item.type);
            el.innerHTML = `<span class="wiki-ac-icon">${icon}</span><span class="wiki-ac-title">${escapeHtml(item.title)}</span><span class="wiki-ac-type">${typeLabel}</span>`;
            el.onmouseenter = () => {
                selectedIdx = i;
                renderPopup();
            };
            // Выбор мышью. preventDefault — чтобы editable не потерял фокус
            // до того, как мы вставим. Плюс флаг, чтобы blur не закрыл попап.
            const pick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isPickingFromPopup = true;
                setTimeout(() => { isPickingFromPopup = false; }, 0);
                insertItem(i);
            };
            el.onmousedown = pick;
            el.onpointerdown = pick;
            popup.appendChild(el);
        });

        const hint = document.createElement("div");
        hint.className = "wiki-autocomplete-hint";
        hint.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd> выбор · <kbd>Enter</kbd> вставить · <kbd>Esc</kbd> отмена`;
        popup.appendChild(hint);
    }

    function showPopup(rect) {
        if (!popup) {
            popup = document.createElement("div");
            popup.className = "wiki-autocomplete";
            document.body.appendChild(popup);
        }
        const popupHeight = 300;
        let top = rect.bottom + 4;
        let left = rect.left;
        if (top + popupHeight > window.innerHeight) {
            top = Math.max(10, rect.top - popupHeight - 4);
        }
        if (left + 420 > window.innerWidth) {
            left = window.innerWidth - 430;
        }
        popup.style.top = top + "px";
        popup.style.left = left + "px";
        renderPopup();
    }

    // Вставка выбранного пункта.
    // ВАЖНО: сначала вставляем (пока triggerStart и currentItems живы),
    // и только потом закрываем попап. Раньше было наоборот — closePopup()
    // затирал triggerStart = -1, и insertItem выходил до вставки.
    function insertItem(idx) {
        const item = currentItems[idx];
        if (!item) return;
        const ts = triggerStart;
        if (ts < 0) return;

        // Сначала вставляем
        replaceWikiTrigger(editable, ts, "[[" + item.id + "]]");

        // Потом закрываем и блокируем следующий input
        closePopup();
        ignoreNextInput = true;
        if (ignoreResetTimer) clearTimeout(ignoreResetTimer);
        ignoreResetTimer = setTimeout(() => { ignoreNextInput = false; }, 300);

        editable.focus();
        onFieldChange();
    }

    editable.addEventListener("input", () => {
        // Игнорируем input после программной вставки
        if (ignoreNextInput) {
            ignoreNextInput = false;
            if (ignoreResetTimer) { clearTimeout(ignoreResetTimer); ignoreResetTimer = null; }
            return;
        }

        const beforeText = getTextBeforeCaret(editable);
        if (beforeText === null) { closePopup(); return; }

        const lastOpen = beforeText.lastIndexOf("[[");
        if (lastOpen === -1) { closePopup(); return; }

        const afterOpen = beforeText.slice(lastOpen + 2);
        if (afterOpen.includes("]]") || afterOpen.includes("|") || afterOpen.includes("\n")) {
            closePopup();
            return;
        }

        triggerStart = lastOpen;
        const query = afterOpen;

        currentItems = getWikiAutocompleteItems(query);
        selectedIdx = 0;

        const rect = getCaretRect(editable);
        if (rect) {
            showPopup(rect);
        }
    });

    editable.addEventListener("keydown", (e) => {
        if (!popup) return;
        if (e.key === "Escape") {
            e.preventDefault();
            closePopup();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIdx = Math.min(currentItems.length - 1, selectedIdx + 1);
            renderPopup();
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIdx = Math.max(0, selectedIdx - 1);
            renderPopup();
            return;
        }
        if (e.key === "Enter") {
            if (currentItems.length > 0) {
                e.preventDefault();
                insertItem(selectedIdx);
            }
            return;
        }
        if (e.key === "Tab") {
            if (currentItems.length > 0) {
                e.preventDefault();
                insertItem(selectedIdx);
            }
            return;
        }
    });

    editable.addEventListener("blur", () => {
        setTimeout(() => {
            // Если сейчас идёт выбор из попапа — не закрываем
            if (isPickingFromPopup) return;
            if (popup && document.activeElement !== editable) closePopup();
        }, 150);
    });
}

/* ============================================================
   ПРИМЕЧАНИЯ В ТЕКСТЕ — рендер в превью + модалка
   ============================================================ */

// Превращает ((N)) в <span class="note" data-note-idx="N-1">N</span>.
// notes — массив строк. Если номера нет в notes — рисуем битый маркер.
function renderNotesInText(html, notes) {
    if (!html) return html;
    return String(html).replace(/\(\((\d+)\)\)/g, (match, nStr) => {
        const n = parseInt(nStr, 10);
        if (isNaN(n) || n < 1) {
            return `<span class="note-broken" title="Некорректный номер">((${escapeHtml(nStr)}))</span>`;
        }
        const has = Array.isArray(notes) && n <= notes.length;
        if (!has) {
            return `<span class="note-broken" data-note-idx="${n - 1}" title="Нет примечания №${n}">((${n}))</span>`;
        }
        return `<span class="note" contenteditable="false" data-note-idx="${n - 1}" title="Кликни, чтобы открыть">${n}</span>`;
    });
}

// Из contentEditable забираем innerHTML, но <span class="note">N</span>
// превращаем обратно в ((N)). Если номер не нашёлся — оставляем текст.
function extractNoteMarkers(el, notes) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    clone.querySelectorAll("span.note").forEach(sp => {
        const txt = sp.textContent.trim();
        const n = parseInt(txt, 10);
        if (!isNaN(n) && n > 0) {
            sp.replaceWith(document.createTextNode("((" + n + "))"));
        } else {
            sp.replaceWith(document.createTextNode(txt));
        }
    });
    clone.querySelectorAll("span.note-broken").forEach(sp => {
        sp.replaceWith(document.createTextNode(sp.textContent));
    });
    return clone.innerHTML;
}

let noteModalEl = null;

// Открывает модалку для примечания к выделенному фрагменту в editable.
function openNoteEditor(editable) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
        setStatus("Сначала выдели текст, к которому нужно примечание.", "err");
        return;
    }
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.startContainer)) {
        setStatus("Выделение вне редактируемого блока.", "err");
        return;
    }
    if (range.collapsed) {
        setStatus("Сначала выдели фрагмент текста.", "err");
        return;
    }

    const wrapper = editable.closest(".block-wrapper");
    if (!wrapper) return;
    const blockIndex = parseInt(wrapper.dataset.index, 10);
    const context = getCurrentContext();

    const block = getBlockByContext(context, blockIndex);
    if (!block) return;

    if (!Array.isArray(block.notes)) block.notes = [];

    const savedRange = range.cloneRange();

    showNoteModal({
        initialText: "",
        onSave: (noteText) => {
            let noteNum = block.notes.indexOf(noteText);
            if (noteNum === -1) {
                block.notes.push(noteText);
                noteNum = block.notes.length - 1;
            }
            const marker = "((" + (noteNum + 1) + "))";

            // Возвращаем фокус и диапазон в editable
            restoreRange(editable, savedRange);

            // Вставляем маркер через execCommand
            let inserted = false;
            try {
                inserted = document.execCommand("insertText", false, marker);
            } catch (e) {
                inserted = false;
            }

            // Fallback
            if (!inserted) {
                try {
                    const s3 = window.getSelection();
                    if (s3 && s3.rangeCount > 0) {
                        const r3 = s3.getRangeAt(0);
                        r3.collapse(false);
                        const textNode = document.createTextNode(marker);
                        r3.insertNode(textNode);
                        r3.setStartAfter(textNode);
                        r3.collapse(true);
                        s3.removeAllRanges();
                        s3.addRange(r3);
                    }
                } catch (e) {
                    console.warn("openNoteEditor: не удалось вставить маркер", e);
                }
            }

            // Сначала читаем DOM в данные, чтобы ((N)) не потерялось
            readFromDom();
            // Потом перерисовываем блок — маркер станет подсвеченным
            rerenderCurrentBlock(context);
            saveDraft();
            autoSaveToServer();
            setStatus("💬 Примечание добавлено", "ok");
        }
    });
}

function restoreRange(editable, range) {
    editable.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function getCurrentContext() {
    const lesson = currentLesson();
    if (!lesson) return "slide";
    if (lesson.type === "memo") return "memo";
    if (lesson.type === "glossary") return "glossary";
    if (lesson.type === "quiz") return "quiz";
    return "slide";
}

function getBlockByContext(context, blockIndex) {
    const lesson = currentLesson();
    if (!lesson) return null;
    if (context === "memo") {
        const cell = lesson.cells[state.currentSlideIndex];
        return cell ? cell.content[blockIndex] : null;
    }
    if (context === "glossary") {
        const term = lesson.terms[state.currentSlideIndex];
        return term ? term.content[blockIndex] : null;
    }
    const slide = lesson.slides ? lesson.slides[state.currentSlideIndex] : null;
    return slide ? slide.content[blockIndex] : null;
}

function rerenderCurrentBlock(context) {
    const lesson = currentLesson();
    if (!lesson) return;
    if (context === "memo") renderCell();
    else if (context === "glossary") renderTerm();
    else renderSlide();
}

function showNoteModal({ initialText, onSave }) {
    if (noteModalEl) noteModalEl.remove();

    const overlay = document.createElement("div");
    overlay.className = "note-modal-overlay";
    overlay.innerHTML = `
        <div class="note-modal">
            <h3 class="note-modal-title">💬 Примечание</h3>
            <p class="note-modal-hint">Пояснение появится при наведении на выделенный фрагмент.</p>
            <textarea class="note-modal-textarea" placeholder="Введи текст примечания..."></textarea>
            <div class="note-modal-actions">
                <button type="button" class="btn btn-text" data-action="cancel">Отмена</button>
                <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    noteModalEl = overlay;

    const ta = overlay.querySelector(".note-modal-textarea");
    ta.value = initialText || "";
    ta.focus();

    overlay.querySelector('[data-action="cancel"]').onclick = closeNoteModal;
    overlay.querySelector('[data-action="save"]').onclick = () => {
        const text = ta.value.trim();
        if (!text) {
            setStatus("Примечание пустое.", "err");
            return;
        }
        closeNoteModal();
        onSave(text);
    };
    overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) closeNoteModal();
    });
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeNoteModal(); }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            overlay.querySelector('[data-action="save"]').click();
        }
    });
}

function closeNoteModal() {
    if (noteModalEl) { noteModalEl.remove(); noteModalEl = null; }
}

/* ============================================================
   МАРКЕРЫ НА КАРТИНКЕ — модалка редактирования
   ============================================================ */
let markerNoteModalEl = null;

function showMarkerNoteModal({ initialText, onSave, onDelete }) {
    if (markerNoteModalEl) markerNoteModalEl.remove();

    const overlay = document.createElement("div");
    overlay.className = "note-modal-overlay";
    overlay.innerHTML = `
        <div class="note-modal">
            <h3 class="note-modal-title">🎯 Примечание к маркеру</h3>
            <p class="note-modal-hint">Появится при клике по маркеру в плеере.</p>
            <textarea class="note-modal-textarea" placeholder="Введи текст примечания..."></textarea>
            <div class="note-modal-actions">
                ${onDelete ? '<button type="button" class="btn btn-text" data-action="delete" style="color:var(--error);">🗑 Удалить</button>' : ''}
                <button type="button" class="btn btn-text" data-action="cancel">Отмена</button>
                <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    markerNoteModalEl = overlay;

    const ta = overlay.querySelector(".note-modal-textarea");
    ta.value = initialText || "";
    ta.focus();

    overlay.querySelector('[data-action="cancel"]').onclick = closeMarkerNoteModal;
    overlay.querySelector('[data-action="save"]').onclick = () => {
        const text = ta.value.trim();
        if (!text) {
            setStatus("Примечание пустое.", "err");
            return;
        }
        closeMarkerNoteModal();
        onSave(text);
    };
    const delBtn = overlay.querySelector('[data-action="delete"]');
    if (delBtn && onDelete) {
        delBtn.onclick = () => {
            closeMarkerNoteModal();
            onDelete();
        };
    }
    overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) closeMarkerNoteModal();
    });
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeMarkerNoteModal(); }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            overlay.querySelector('[data-action="save"]').click();
        }
    });
}

function closeMarkerNoteModal() {
    if (markerNoteModalEl) { markerNoteModalEl.remove(); markerNoteModalEl = null; }
}

/* ============================================================
   РЕДАКТОР СПИСКА
   ============================================================ */
function createListEditor(block) {
    const wrap = document.createElement("div");
    wrap.className = "list-editor";

    if (!block.style) block.style = "bullet";
    if (!Array.isArray(block.items)) block.items = [];
    block.items = block.items.map(item => {
        if (typeof item === "string") return { text: item, level: 0 };
        if (item && typeof item === "object") {
            if (item.level === undefined) item.level = 0;
            if (item.text === undefined) item.text = "";
            return item;
        }
        return { text: String(item || ""), level: 0 };
    });

    const header = document.createElement("div");
    header.className = "list-editor-header";

    const styleLabel = document.createElement("label");
    styleLabel.className = "list-editor-style-label";
    styleLabel.textContent = "Стиль:";
    header.appendChild(styleLabel);

    const styleSel = document.createElement("select");
    styleSel.className = "list-editor-style-select";
    [
        { v: "bullet",   t: "• Точки" },
        { v: "number",   t: "1. Цифры" },
        { v: "checkbox", t: "☐ Чекбоксы" }
    ].forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.v; o.textContent = opt.t;
        if (block.style === opt.v) o.selected = true;
        styleSel.appendChild(o);
    });
    styleSel.addEventListener("change", () => {
        block.style = styleSel.value;
        renderItems();
        onFieldChange();
    });
    header.appendChild(styleSel);

    wrap.appendChild(header);

    const itemsBox = document.createElement("div");
    itemsBox.className = "list-editor-items";
    wrap.appendChild(itemsBox);

    const addWrap = document.createElement("div");
    addWrap.style.marginTop = "8px";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-outline";
    addBtn.textContent = "＋ Добавить пункт";
    addBtn.style.padding = "6px 14px";
    addBtn.style.fontSize = "13px";
    addBtn.onclick = () => {
        block.items.push({ text: "Новый пункт", level: 0 });
        renderItems();
        onFieldChange();
    };
    addWrap.appendChild(addBtn);
    wrap.appendChild(addWrap);

    function renderItems() {
        itemsBox.innerHTML = "";
        if (block.items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "list-editor-empty";
            empty.textContent = "Список пустой. Нажми «＋ Добавить пункт».";
            itemsBox.appendChild(empty);
            return;
        }
        block.items.forEach((item, idx) => {
            itemsBox.appendChild(createItemRow(item, idx));
        });
    }

    function createItemRow(item, idx) {
        const row = document.createElement("div");
        row.className = "list-editor-row";
        row.dataset.level = item.level;
        row.dataset.idx = idx;

        const marker = document.createElement("span");
        marker.className = "list-editor-marker";
        if (block.style === "bullet") {
            if (item.level === 0) marker.textContent = "•";
            else if (item.level === 1) marker.textContent = "◦";
            else marker.textContent = "▪";
        } else if (block.style === "number") {
            marker.textContent = (idx + 1) + ".";
        } else if (block.style === "checkbox") {
            marker.textContent = "☐";
        }
        row.appendChild(marker);

        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "list-editor-input";
        inp.value = item.text || "";
        inp.placeholder = "Текст пункта";
        inp.addEventListener("input", () => {
            item.text = inp.value;
            onFieldChange();
        });
        inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                block.items.splice(idx + 1, 0, { text: "", level: item.level });
                renderItems();
                setTimeout(() => {
                    const newRow = itemsBox.querySelectorAll(".list-editor-row")[idx + 1];
                    if (newRow) {
                        const newInp = newRow.querySelector(".list-editor-input");
                        if (newInp) newInp.focus();
                    }
                }, 0);
                onFieldChange();
            } else if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                if (item.level < MAX_LIST_LEVEL) {
                    item.level++;
                    renderItems();
                    setTimeout(() => {
                        const sameRow = itemsBox.querySelectorAll(".list-editor-row")[idx];
                        if (sameRow) {
                            const sameInp = sameRow.querySelector(".list-editor-input");
                            if (sameInp) sameInp.focus();
                        }
                    }, 0);
                    onFieldChange();
                }
            } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault();
                if (item.level > 0) {
                    item.level--;
                    renderItems();
                    setTimeout(() => {
                        const sameRow = itemsBox.querySelectorAll(".list-editor-row")[idx];
                        if (sameRow) {
                            const sameInp = sameRow.querySelector(".list-editor-input");
                            if (sameInp) sameInp.focus();
                        }
                    }, 0);
                    onFieldChange();
                }
            }
        });
        inp.addEventListener("paste", (e) => {
            const text = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
            if (!text) return;
            const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (lines.length <= 1) return;
            e.preventDefault();
            const first = lines[0];
            const rest = lines.slice(1);
            item.text = first;
            rest.forEach((line, i) => {
                block.items.splice(idx + 1 + i, 0, { text: line, level: item.level });
            });
            renderItems();
            setTimeout(() => {
                const sameRow = itemsBox.querySelectorAll(".list-editor-row")[idx];
                if (sameRow) {
                    const sameInp = sameRow.querySelector(".list-editor-input");
                    if (sameInp) sameInp.focus();
                }
            }, 0);
            onFieldChange();
        });
        row.appendChild(inp);

        const tools = document.createElement("div");
        tools.className = "list-editor-tools";

        const upLvlBtn = document.createElement("button");
        upLvlBtn.type = "button";
        upLvlBtn.className = "mini-icon-btn";
        upLvlBtn.textContent = "⇤";
        upLvlBtn.title = "Поднять уровень (Shift+Tab)";
        upLvlBtn.disabled = item.level <= 0;
        upLvlBtn.onclick = () => {
            if (item.level > 0) {
                item.level--;
                renderItems();
                onFieldChange();
            }
        };
        tools.appendChild(upLvlBtn);

        const downLvlBtn = document.createElement("button");
        downLvlBtn.type = "button";
        downLvlBtn.className = "mini-icon-btn";
        downLvlBtn.textContent = "⇥";
        downLvlBtn.title = "Углубить (Tab)";
        downLvlBtn.disabled = item.level >= MAX_LIST_LEVEL;
        downLvlBtn.onclick = () => {
            if (item.level < MAX_LIST_LEVEL) {
                item.level++;
                renderItems();
                onFieldChange();
            }
        };
        tools.appendChild(downLvlBtn);

        const addBtn2 = document.createElement("button");
        addBtn2.type = "button";
        addBtn2.className = "mini-icon-btn";
        addBtn2.textContent = "＋";
        addBtn2.title = "Добавить пункт ниже";
        addBtn2.onclick = () => {
            block.items.splice(idx + 1, 0, { text: "", level: item.level });
            renderItems();
            setTimeout(() => {
                const newRow = itemsBox.querySelectorAll(".list-editor-row")[idx + 1];
                if (newRow) {
                    const newInp = newRow.querySelector(".list-editor-input");
                    if (newInp) newInp.focus();
                }
            }, 0);
            onFieldChange();
        };
        tools.appendChild(addBtn2);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "mini-icon-btn del";
        delBtn.textContent = "✕";
        delBtn.title = "Удалить пункт";
        delBtn.onclick = () => {
            block.items.splice(idx, 1);
            renderItems();
            onFieldChange();
        };
        tools.appendChild(delBtn);

        row.appendChild(tools);
        return row;
    }

    renderItems();
    return wrap;
}

/* ============================================================
   УТИЛИТЫ ДЛЯ ТАБЛИЦ
   ============================================================ */
function parseHtmlTable(html) {
    if (!html) return null;
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const table = doc.querySelector("table");
        if (!table) return null;

        const rows = [];
        let hasHeader = false;

        const trs = table.querySelectorAll("tr");
        trs.forEach((tr, ri) => {
            const cells = tr.querySelectorAll("th, td");
            if (cells.length === 0) return;
            const row = [];
            cells.forEach(cell => {
                let text = cell.textContent || "";
                text = text.replace(/\s+/g, " ").trim();
                row.push(text);
            });
            if (ri === 0 && tr.querySelector("th")) hasHeader = true;
            rows.push(row);
        });

        if (rows.length === 0) return null;
        return { rows, hasHeader };
    } catch (e) {
        return null;
    }
}

function parseTsvText(text) {
    if (!text) return null;
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    if (lines.length === 0) return null;

    const rows = lines.map(line => line.split("\t").map(c => c.trim()));
    const hasAnyTab = lines.some(l => l.includes("\t"));
    if (!hasAnyTab && rows.length === 1 && rows[0].length === 1) return null;
    return { rows, hasHeader: false };
}

function parseClipboardTable(clipboardData) {
    if (!clipboardData) return null;
    const html = clipboardData.getData("text/html") || "";
    const text = clipboardData.getData("text/plain") || "";

    const fromHtml = parseHtmlTable(html);
    if (fromHtml && fromHtml.rows.length > 1) return fromHtml;

    const fromText = parseTsvText(text);
    if (fromText) return fromText;

    if (fromHtml) return fromHtml;
    return null;
}

function serializeToHtmlTable(rows, hasHeader) {
    let html = "<table>";
    rows.forEach((row, ri) => {
        html += "<tr>";
        row.forEach(cell => {
            const tag = (hasHeader && ri === 0) ? "th" : "td";
            const safe = String(cell == null ? "" : cell)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            html += `<${tag}>${safe}</${tag}>`;
        });
        html += "</tr>";
    });
    html += "</table>";
    return html;
}

function serializeToTsv(rows) {
    return rows.map(row => row.map(c => String(c == null ? "" : c)).join("\t")).join("\n");
}

/* ============================================================
   РЕДАКТОР ТАБЛИЦЫ
   ============================================================ */
function createTableBody(block) {
    const wrap = document.createElement("div");
    wrap.className = "table-editor";

    if (!block.rows) block.rows = [["", ""], ["", ""]];
    if (block.header === undefined) block.header = true;

    let selection = null;
    let isDragging = false;

    const top = document.createElement("div");
    top.className = "table-editor-top";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "table-editor-toggle";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = !!block.header;
    toggleInput.addEventListener("change", () => {
        block.header = toggleInput.checked;
        renderTableGrid();
        onFieldChange();
    });
    toggleLabel.appendChild(toggleInput);
    const toggleText = document.createElement("span");
    toggleText.textContent = "Первая строка — заголовок";
    toggleLabel.appendChild(toggleText);
    top.appendChild(toggleLabel);

    const countEl = document.createElement("div");
    countEl.className = "table-editor-count";
    top.appendChild(countEl);

    wrap.appendChild(top);

    const actions = document.createElement("div");
    actions.className = "table-editor-actions";

    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "btn btn-outline";
    addRowBtn.textContent = "＋ Строка";
    addRowBtn.onclick = () => {
        const cols = getMaxCols(block.rows);
        if (block.rows.length >= MAX_TABLE_ROWS) return;
        block.rows.push(new Array(cols).fill(""));
        renderTableGrid();
        onFieldChange();
    };
    actions.appendChild(addRowBtn);

    const removeRowBtn = document.createElement("button");
    removeRowBtn.type = "button";
    removeRowBtn.className = "btn btn-outline";
    removeRowBtn.textContent = "− Строка";
    removeRowBtn.onclick = () => {
        if (block.rows.length <= 1) { alert("Минимум 1 строка."); return; }
        block.rows.pop();
        renderTableGrid();
        onFieldChange();
    };
    actions.appendChild(removeRowBtn);

    const addColBtn = document.createElement("button");
    addColBtn.type = "button";
    addColBtn.className = "btn btn-outline";
    addColBtn.textContent = "＋ Столбец";
    addColBtn.onclick = () => {
        const cols = getMaxCols(block.rows);
        if (cols >= MAX_TABLE_COLS) return;
        block.rows.forEach(r => r.push(""));
        renderTableGrid();
        onFieldChange();
    };
    actions.appendChild(addColBtn);

    const removeColBtn = document.createElement("button");
    removeColBtn.type = "button";
    removeColBtn.className = "btn btn-outline";
    removeColBtn.textContent = "− Столбец";
    removeColBtn.onclick = () => {
        const cols = getMaxCols(block.rows);
        if (cols <= 1) { alert("Минимум 1 столбец."); return; }
        block.rows.forEach(r => r.pop());
        renderTableGrid();
        onFieldChange();
    };
    actions.appendChild(removeColBtn);

    const pasteBtn = document.createElement("button");
    pasteBtn.type = "button";
    pasteBtn.className = "btn btn-outline";
    pasteBtn.textContent = "📥 Вставить из буфера";
    pasteBtn.title = "Вставить таблицу из буфера (или нажми Ctrl+V в ячейке)";
    pasteBtn.onclick = async () => {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) {
                alert("Браузер не поддерживает чтение буфера. Используй Ctrl+V в ячейке.");
                return;
            }
            const items = await navigator.clipboard.read();
            let html = "", text = "";
            for (const item of items) {
                if (item.types.includes("text/html")) {
                    const blob = await item.getType("text/html");
                    html = await blob.text();
                }
                if (item.types.includes("text/plain")) {
                    const blob = await item.getType("text/plain");
                    text = await blob.text();
                }
            }
            const fake = {
                getData: (type) => type === "text/html" ? html : (type === "text/plain" ? text : "")
            };
            handlePasteIntoTable(fake);
        } catch (e) {
            alert("Не удалось прочитать буфер. Разреши доступ или используй Ctrl+V в ячейке.");
        }
    };
    actions.appendChild(pasteBtn);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-outline";
    copyBtn.textContent = "📤 Скопировать выделенное";
    copyBtn.title = "Скопировать выделенный диапазон как таблицу";
    copyBtn.onclick = () => { copySelectionToClipboard(); };
    actions.appendChild(copyBtn);

    wrap.appendChild(actions);

    const gridWrap = document.createElement("div");
    gridWrap.className = "table-editor-grid-wrap";
    const gridTable = document.createElement("table");
    gridTable.className = "table-editor-grid";
    gridWrap.appendChild(gridTable);
    wrap.appendChild(gridWrap);

    function renderTableGrid() {
        const rows = block.rows || [];
        const cols = getMaxCols(rows) || 1;
        const hasHeader = block.header === true;

        gridTable.innerHTML = "";
        rows.forEach((row, ri) => {
            const tr = document.createElement("tr");
            for (let ci = 0; ci < cols; ci++) {
                const td = document.createElement("td");
                td.className = "table-editor-cell";
                td.dataset.row = ri;
                td.dataset.col = ci;
                if (hasHeader && ri === 0) td.classList.add("is-header");

                const inp = document.createElement("input");
                inp.type = "text";
                inp.value = (row[ci] !== undefined) ? row[ci] : "";
                inp.placeholder = (hasHeader && ri === 0) ? ("Заголовок " + (ci + 1)) : "";
                inp.dataset.row = ri;
                inp.dataset.col = ci;

                inp.addEventListener("input", () => {
                    while (row.length <= ci) row.push("");
                    row[ci] = inp.value;
                    onFieldChange();
                });

                inp.addEventListener("focus", () => {
                    if (!selection || selection.anchor.r !== ri || selection.anchor.c !== ci
                        || selection.focus.r !== ri || selection.focus.c !== ci) {
                        selection = { anchor: { r: ri, c: ci }, focus: { r: ri, c: ci } };
                        updateSelectionHighlight();
                    }
                });

                td.addEventListener("mousedown", (e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    inp.focus();

                    if (e.shiftKey && selection) {
                        selection.focus = { r: ri, c: ci };
                    } else {
                        selection = { anchor: { r: ri, c: ci }, focus: { r: ri, c: ci } };
                    }
                    isDragging = true;
                    updateSelectionHighlight();
                });

                td.addEventListener("mouseover", () => {
                    if (!isDragging || !selection) return;
                    selection.focus = { r: ri, c: ci };
                    updateSelectionHighlight();
                });

                td.appendChild(inp);
                tr.appendChild(td);
            }
            gridTable.appendChild(tr);
        });

        countEl.textContent = `Строк: ${rows.length} / ${MAX_TABLE_ROWS} · Столбцов: ${cols} / ${MAX_TABLE_COLS}`;
        addRowBtn.disabled = rows.length >= MAX_TABLE_ROWS;
        addColBtn.disabled = cols >= MAX_TABLE_COLS;
        removeRowBtn.disabled = rows.length <= 1;
        removeColBtn.disabled = cols <= 1;

        updateSelectionHighlight();
    }

    function updateSelectionHighlight() {
        const cells = gridTable.querySelectorAll(".table-editor-cell");
        cells.forEach(td => td.classList.remove("is-selected"));
        if (!selection) return;
        const rect = getSelectionRect();
        if (!rect) return;
        cells.forEach(td => {
            const r = parseInt(td.dataset.row);
            const c = parseInt(td.dataset.col);
            if (r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2) {
                td.classList.add("is-selected");
            }
        });
    }

    function getSelectionRect() {
        if (!selection) return null;
        const r1 = Math.min(selection.anchor.r, selection.focus.r);
        const r2 = Math.max(selection.anchor.r, selection.focus.r);
        const c1 = Math.min(selection.anchor.c, selection.focus.c);
        const c2 = Math.max(selection.anchor.c, selection.focus.c);
        return { r1, r2, c1, c2 };
    }

    function copySelectionToClipboard() {
        const rect = getSelectionRect();
        const rows = block.rows || [];
        const cols = getMaxCols(rows) || 1;

        const copyRect = rect || { r1: 0, r2: rows.length - 1, c1: 0, c2: cols - 1 };

        const out = [];
        for (let r = copyRect.r1; r <= copyRect.r2; r++) {
            const row = [];
            for (let c = copyRect.c1; c <= copyRect.c2; c++) {
                row.push((rows[r] && rows[r][c] !== undefined) ? String(rows[r][c]) : "");
            }
            out.push(row);
        }

        const html = serializeToHtmlTable(out, block.header && copyRect.r1 === 0);
        const tsv = serializeToTsv(out);

        if (navigator.clipboard && navigator.clipboard.write) {
            const htmlBlob = new Blob([html], { type: "text/html" });
            const textBlob = new Blob([tsv], { type: "text/plain" });
            navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": htmlBlob,
                    "text/plain": textBlob
                })
            ]).then(() => {
                setStatus("📤 Скопировано: " + out.length + "×" + (out[0] ? out[0].length : 0), "ok");
            }).catch(() => {
                fallbackCopy(tsv);
            });
        } else {
            fallbackCopy(tsv);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); setStatus("📤 Скопировано", "ok"); }
        catch (e) { setStatus("⚠ Не удалось скопировать", "err"); }
        document.body.removeChild(ta);
    }

    function handlePasteIntoTable(clipboardData) {
        const parsed = parseClipboardTable(clipboardData);
        if (!parsed) {
            setStatus("⚠ В буфере нет таблицы", "err");
            return;
        }
        const { rows: pastedRows, hasHeader } = parsed;
        if (pastedRows.length === 0) return;

        const cols = getMaxCols(block.rows) || 1;

        let target;
        if (selection) {
            const rect = getSelectionRect();
            const isSingleCell = (rect.r1 === rect.r2 && rect.c1 === rect.c2);
            if (isSingleCell) {
                target = {
                    r1: rect.r1,
                    c1: rect.c1,
                    r2: rect.r1 + pastedRows.length - 1,
                    c2: rect.c1 + (pastedRows[0] ? pastedRows[0].length : 1) - 1
                };
            } else {
                target = rect;
            }
        } else {
            target = {
                r1: 0, c1: 0,
                r2: pastedRows.length - 1,
                c2: (pastedRows[0] ? pastedRows[0].length : 1) - 1
            };
        }

        const maxR = Math.min(target.r2, MAX_TABLE_ROWS - 1);
        const maxC = Math.min(target.c2, MAX_TABLE_COLS - 1);

        let clipped = false;
        if (maxR < target.r2 || maxC < target.c2) clipped = true;

        while (block.rows.length <= maxR) {
            block.rows.push(new Array(cols).fill(""));
        }
        for (let r = 0; r < block.rows.length; r++) {
            while (block.rows[r].length <= maxC) block.rows[r].push("");
        }

        for (let r = target.r1; r <= maxR; r++) {
            const srcRow = pastedRows[r - target.r1];
            if (!srcRow) continue;
            for (let c = target.c1; c <= maxC; c++) {
                const val = srcRow[c - target.c1];
                if (val === undefined) continue;
                if (val === "" && block.rows[r][c] !== "") continue;
                block.rows[r][c] = val;
            }
        }

        if (hasHeader) {
            block.header = true;
            toggleInput.checked = true;
        }

        selection = {
            anchor: { r: maxR, c: maxC },
            focus: { r: maxR, c: maxC }
        };

        renderTableGrid();
        onFieldChange();

        const msg = clipped
            ? "📥 Вставлено (обрезано до " + (maxR + 1) + "×" + (maxC + 1) + ")"
            : "📥 Вставлено: " + (maxR - target.r1 + 1) + "×" + (maxC - target.c1 + 1);
        setStatus(msg, "ok");
    }

    gridWrap.addEventListener("paste", (e) => {
        const target = e.target;
        if (target && target.tagName === "INPUT") {
            const cd = e.clipboardData;
            if (!cd) return;
            const parsed = parseClipboardTable(cd);
            if (parsed && (parsed.rows.length > 1 || (parsed.rows[0] && parsed.rows[0].length > 1))) {
                e.preventDefault();
                handlePasteIntoTable(cd);
            }
        }
    });

    gridWrap.addEventListener("keydown", (e) => {
        if (!selection) return;
        const rect = getSelectionRect();

        if (e.key === "Escape") {
            selection = null;
            updateSelectionHighlight();
            return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && selection) {
            const isSingleCell = (rect.r1 === rect.r2 && rect.c1 === rect.c2);
            if (!isSingleCell) {
                e.preventDefault();
                for (let r = rect.r1; r <= rect.r2; r++) {
                    if (!block.rows[r]) continue;
                    for (let c = rect.c1; c <= rect.c2; c++) {
                        if (block.rows[r][c] !== undefined) block.rows[r][c] = "";
                    }
                }
                renderTableGrid();
                onFieldChange();
                selection = { anchor: { r: rect.r1, c: rect.c1 }, focus: { r: rect.r2, c: rect.c2 } };
                updateSelectionHighlight();
                return;
            }
        }

        if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const rows = block.rows || [];
            const cols = getMaxCols(rows) || 1;
            selection = {
                anchor: { r: 0, c: 0 },
                focus: { r: rows.length - 1, c: cols - 1 }
            };
            updateSelectionHighlight();
            return;
        }

        if (e.key === "c" && (e.ctrlKey || e.metaKey) && selection) {
            e.preventDefault();
            copySelectionToClipboard();
            return;
        }

        if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
            e.preventDefault();
            const rows = block.rows || [];
            const cols = getMaxCols(rows) || 1;
            let { r, c } = selection.focus;
            if (e.key === "ArrowUp") r = Math.max(0, r - 1);
            else if (e.key === "ArrowDown") r = Math.min(rows.length - 1, r + 1);
            else if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
            else if (e.key === "ArrowRight") c = Math.min(cols - 1, c + 1);
            selection.focus = { r, c };
            updateSelectionHighlight();
        }
    });

    document.addEventListener("mousedown", (e) => {
        if (!gridWrap.contains(e.target)) {
            selection = null;
            updateSelectionHighlight();
        }
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
    });

    renderTableGrid();
    return wrap;
}

function getMaxCols(rows) {
    let m = 0;
    (rows || []).forEach(r => { if (Array.isArray(r) && r.length > m) m = r.length; });
    return m;
}

/* ============================================================
   RICH-ПАНЕЛЬ (🔗 wiki + 💬 примечание)
   ============================================================ */
function createRichToolbar(editable) {
    const bar = document.createElement("div");
    bar.className = "rich-toolbar";
    bar.contentEditable = "false";

    const btn = (label, title, cmd, value) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rich-btn";
        b.textContent = label;
        b.title = title;
        b.onmousedown = (e) => {
            e.preventDefault();
            editable.focus();
            document.execCommand(cmd, false, value || null);
            onFieldChange();
        };
        return b;
    };

    const sep = () => {
        const s = document.createElement("span");
        s.className = "rich-sep";
        return s;
    };

    bar.appendChild(btn("B", "Жирный (Ctrl+B)", "bold"));
    bar.appendChild(btn("I", "Курсив (Ctrl+I)", "italic"));
    bar.appendChild(btn("U", "Подчёркнутый (Ctrl+U)", "underline"));
    bar.appendChild(btn("S", "Зачёркнутый", "strikeThrough"));
    bar.appendChild(sep());
    bar.appendChild(btn("⯇", "По левому краю", "justifyLeft"));
    bar.appendChild(btn("≡", "По центру", "justifyCenter"));
    bar.appendChild(btn("⯈", "По правому краю", "justifyRight"));
    bar.appendChild(btn("☰", "По ширине", "justifyFull"));
    bar.appendChild(sep());

    // Кнопка 🔗 — вставить wiki-ссылку
    const wikiBtn = document.createElement("button");
    wikiBtn.type = "button";
    wikiBtn.className = "rich-btn wiki-btn";
    wikiBtn.textContent = "🔗";
    wikiBtn.title = "Вставить внутреннюю ссылку на блок (Ctrl+K)";
    wikiBtn.onmousedown = (e) => {
        e.preventDefault();
        editable.focus();
        insertWikiLinkAtCaret(editable);
        onFieldChange();
    };
    bar.appendChild(wikiBtn);

    // Кнопка 💬 — вставить примечание
    const noteBtn = document.createElement("button");
    noteBtn.type = "button";
    noteBtn.className = "rich-btn note-btn";
    noteBtn.textContent = "💬";
    noteBtn.title = "Добавить примечание к выделенному тексту";
    noteBtn.onmousedown = (e) => {
        e.preventDefault();
        openNoteEditor(editable);
    };
    bar.appendChild(noteBtn);

    return bar;
}

// Вставляет [[ в позицию каретки, если мы ещё не внутри незакрытой [[.
function insertWikiLinkAtCaret(editable) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (!editable.contains(range.startContainer)) return;

    const before = getTextBeforeCaret(editable) || "";
    const lastOpen = before.lastIndexOf("[[");
    const lastClose = before.lastIndexOf("]]");
    if (lastOpen > lastClose) {
        return;
    }

    document.execCommand("insertText", false, "[[");

    const inputEvent = new Event("input", { bubbles: true });
    editable.dispatchEvent(inputEvent);
}

/* ============================================================
   БЛОКИ КОНТЕНТА
   ============================================================ */
function createBlockElement(block, index, context) {
    const wrapper = document.createElement("div");
    wrapper.className = "block-wrapper";
    wrapper.dataset.type = block.type;
    wrapper.dataset.index = index;

    let editable = null;

    if (block.type === "p") {
        editable = document.createElement("p");
        editable.contentEditable = "true";
        editable.innerHTML = renderNotesInText(block.text || "", block.notes || []);
    } else if (block.type === "h3") {
        editable = document.createElement("h3");
        editable.contentEditable = "true";
        editable.innerHTML = renderNotesInText(block.text || "", block.notes || []);
    } else if (block.type === "quote") {
        editable = document.createElement("div");
        editable.className = "quote-text";
        editable.contentEditable = "true";
        editable.innerHTML = renderNotesInText(block.text || "", block.notes || []);
    } else if (block.type === "ul") {
        editable = createListEditor(block);
    } else if (block.type === "link") {
        editable = document.createElement("div");
        editable.className = "link-editor";
        editable.innerHTML = `
            <div class="link-text-row"><span>🔗</span><span class="link-text" contenteditable="true">${block.text || "Ссылка"}</span></div>
            <div class="url-row"><span>URL:</span><input type="text" class="link-url" value="${(block.href || "").replace(/"/g, '&quot;')}" placeholder="https://... или #ключ_блока:3"></div>
            <div class="url-hint">Внешние: https://... | внутри курса: #ключ_блока или #ключ_блока:3<br>Ключ блока — серая плашка в списке блоков слева (кликни — скопируется)</div>`;
        editable.querySelector(".link-url").addEventListener("input", onFieldChange);
        editable.querySelector(".link-text").addEventListener("input", onFieldChange);
        editable.querySelector(".link-text").addEventListener("paste", handlePaste);
        editable.querySelector(".link-text").addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
            }
        });
    } else if (block.type === "image") {
        editable = createMediaBlock(block, "image");
    } else if (block.type === "video") {
        editable = createMediaBlock(block, "video");
    } else if (block.type === "table") {
        editable = createTableBody(block);
    }

    if ((block.type === "p" || block.type === "h3" || block.type === "quote") && editable) {
        editable.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                document.execCommand("insertLineBreak");
                onFieldChange();
            }
        });
        editable.addEventListener("paste", handlePaste);
        wrapper.appendChild(createRichToolbar(editable));

        // Автокомплит wiki-ссылок
        initWikiAutocomplete(editable);

        // Клик по подсвеченному примечанию → модалка редактирования
        editable.addEventListener("click", (e) => {
            const noteEl = e.target.closest(".note");
            if (!noteEl) return;
            e.preventDefault();
            const idx = parseInt(noteEl.dataset.noteIdx, 10);
            if (isNaN(idx)) return;
            openNoteEditModal(editable, index, context, idx);
        });
    }

    if (editable) {
        wrapper.appendChild(editable);
    }

    // Список примечаний под блоком (только для текстовых типов)
    if ((block.type === "p" || block.type === "h3" || block.type === "quote")) {
        const notesBox = createNotesListForBlock(block, index, context);
        if (notesBox) wrapper.appendChild(notesBox);
    }

    wrapper.addEventListener("input", onFieldChange);

    const tools = document.createElement("div");
    tools.className = "block-tools";
    let moveHandlerPrefix, removeHandlerPrefix;
    if (context === "memo") {
        moveHandlerPrefix = "moveMemoBlock";
        removeHandlerPrefix = "removeMemoBlock";
    } else if (context === "glossary") {
        moveHandlerPrefix = "moveTermBlock";
        removeHandlerPrefix = "removeTermBlock";
    } else {
        moveHandlerPrefix = "moveBlock";
        removeHandlerPrefix = "removeBlock";
    }
    tools.innerHTML = `<button class="mini-icon-btn" onclick="${moveHandlerPrefix}(this, -1)" title="Вверх">↑</button><button class="mini-icon-btn" onclick="${moveHandlerPrefix}(this, 1)" title="Вниз">↓</button><button class="mini-icon-btn del" onclick="${removeHandlerPrefix}(this)" title="Удалить">✕</button>`;
    wrapper.appendChild(tools);

    return wrapper;
}

function createMediaBlock(block, type) {
    const wrap = document.createElement("div");
    wrap.className = "media-editor";
    if (type === "image") wrap.classList.add("img-with-markers");

    const isImage = type === "image";
    const uploadType = isImage ? "images" : "videos";
    const accept = isImage
        ? "image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        : "video/mp4,video/webm,video/ogg";

    const srcRow = document.createElement("div");
    srcRow.className = "media-src-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input media-src-input";
    input.placeholder = isImage
        ? "images/pic.png  или  https://example.com/pic.png"
        : "videos/lesson.mp4  или  https://example.com/video.mp4";
    input.value = block.src || "";
    srcRow.appendChild(input);

    const fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.className = "btn btn-outline media-file-btn";
    fileBtn.textContent = "📁 Выбрать файл";
    fileBtn.title = "Выбрать файл с компьютера и загрузить в папку курса";
    srcRow.appendChild(fileBtn);
    wrap.appendChild(srcRow);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = accept;
    fileInput.style.display = "none";
    wrap.appendChild(fileInput);

    const progressWrap = document.createElement("div");
    progressWrap.className = "media-progress";
    progressWrap.style.display = "none";
    const progressBar = document.createElement("div");
    progressBar.className = "media-progress-bar";
    const progressFill = document.createElement("div");
    progressFill.className = "media-progress-fill";
    progressBar.appendChild(progressFill);
    const progressText = document.createElement("div");
    progressText.className = "media-progress-text";
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressText);
    wrap.appendChild(progressWrap);

    const hint = document.createElement("div");
    hint.className = "field-hint";
    if (isImage) {
        hint.innerHTML = `Можно: <b>Ctrl+V</b> (вставить из буфера), <b>перетащить файл</b>, или выбрать через кнопку.<br>
            Файлы кладутся в <code>images/</code> рядом с <code>index.html</code>.<br>
            <b>Клик по картинке ниже</b> — поставить маркер с примечанием.`;
    } else {
        hint.innerHTML = `Можно: <b>перетащить файл</b> или выбрать через кнопку.<br>
            Файлы кладутся в <code>videos/</code> рядом с <code>index.html</code>. Формат: MP4 (H.264) или WebM.`;
    }
    wrap.appendChild(hint);

    const preview = document.createElement("div");
    preview.className = "media-preview";
    wrap.appendChild(preview);

    let markersBox = null;
    if (isImage) {
        markersBox = document.createElement("div");
        markersBox.className = "img-marker-editor";
        markersBox.innerHTML = `
            <div class="img-marker-editor-title">🎯 Маркеры на картинке</div>
            <div class="img-marker-editor-hint">Клик по картинке — добавить маркер. Клик по существующему маркеру — редактировать. Кнопка ✕ на маркере — удалить.</div>
        `;
        const stageWrap = document.createElement("div");
        stageWrap.className = "img-marker-stage-wrap";
        markersBox.appendChild(stageWrap);

        const listBox = document.createElement("div");
        listBox.className = "img-marker-list";
        markersBox.appendChild(listBox);
        wrap.appendChild(markersBox);

        markersBox._stageWrap = stageWrap;
        markersBox._listBox = listBox;
    }

    if (!Array.isArray(block.markers)) block.markers = [];

    const renderPreview = () => {
        preview.innerHTML = "";
        const src = input.value.trim();
        if (!src) {
            preview.innerHTML = '<div class="media-preview-empty">Превью появится здесь</div>';
            if (markersBox) {
                markersBox._stageWrap.innerHTML = "";
                markersBox._listBox.innerHTML = '<div class="img-marker-empty">Сначала добавь картинку.</div>';
            }
            return;
        }

        if (!isImage) {
            const v = document.createElement("video");
            v.controls = true;
            v.preload = "metadata";
            v.onerror = () => {
                preview.innerHTML = '<div class="media-preview-error">⚠ Видео не загрузилось. Проверь путь и формат.</div>';
            };
            v.src = src;
            preview.appendChild(v);
            return;
        }

        const img = document.createElement("img");
        img.alt = "";
        img.onerror = () => {
            preview.innerHTML = '<div class="media-preview-error">⚠ Файл не найден: ' + escapeHtml(src) + '</div>';
            if (markersBox) {
                markersBox._stageWrap.innerHTML = "";
                markersBox._listBox.innerHTML = '<div class="img-marker-empty">Картинка не загрузилась.</div>';
            }
        };
        img.src = src;
        preview.appendChild(img);

        if (markersBox) {
            const stageWrap = markersBox._stageWrap;
            stageWrap.innerHTML = "";
            const stage = document.createElement("div");
            stage.className = "img-marker-stage";
            stageWrap.appendChild(stage);

            const stageImg = document.createElement("img");
            stageImg.src = src;
            stageImg.alt = "";
            stage.appendChild(stageImg);

            stage.addEventListener("click", (e) => {
                if (e.target.closest(".img-marker")) return;
                const rect = stage.getBoundingClientRect();
                const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
                showMarkerNoteModal({
                    initialText: "",
                    onSave: (text) => {
                        block.markers.push({
                            x: Math.round(xPct * 10) / 10,
                            y: Math.round(yPct * 10) / 10,
                            text: text
                        });
                        renderMarkers();
                        onFieldChange();
                    }
                });
            });

            renderMarkers(stage);
        }
    };

    const renderMarkers = (stage) => {
        if (!markersBox) return;
        if (!stage) stage = markersBox._stageWrap.querySelector(".img-marker-stage");
        if (!stage) return;

        stage.querySelectorAll(".img-marker").forEach(m => m.remove());

        block.markers.forEach((m, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "img-marker";
            btn.style.left = m.x + "%";
            btn.style.top = m.y + "%";
            btn.title = m.text;
            btn.onclick = (e) => {
                e.stopPropagation();
                showMarkerNoteModal({
                    initialText: m.text,
                    onSave: (text) => {
                        m.text = text;
                        renderMarkers();
                        onFieldChange();
                    },
                    onDelete: () => {
                        if (!confirm("Удалить маркер?")) return;
                        block.markers.splice(i, 1);
                        renderMarkers();
                        onFieldChange();
                    }
                });
            };
            stage.appendChild(btn);
        });

        const listBox = markersBox._listBox;
        listBox.innerHTML = "";
        if (block.markers.length === 0) {
            listBox.innerHTML = '<div class="img-marker-empty">Маркеров пока нет. Кликни по картинке выше.</div>';
            return;
        }
        block.markers.forEach((m, i) => {
            const row = document.createElement("div");
            row.className = "img-marker-item";
            row.innerHTML = `
                <div class="img-marker-item-num">${i + 1}</div>
                <div class="img-marker-item-text">${escapeHtml(m.text)}</div>
                <div class="img-marker-item-actions">
                    <button type="button" class="mini-icon-btn" title="Редактировать">✎</button>
                    <button type="button" class="mini-icon-btn del" title="Удалить">✕</button>
                </div>
            `;
            row.querySelectorAll("button")[0].onclick = () => {
                showMarkerNoteModal({
                    initialText: m.text,
                    onSave: (text) => {
                        m.text = text;
                        renderMarkers();
                        onFieldChange();
                    }
                });
            };
            row.querySelectorAll("button")[1].onclick = () => {
                if (!confirm("Удалить маркер?")) return;
                block.markers.splice(i, 1);
                renderMarkers();
                onFieldChange();
            };
            listBox.appendChild(row);
        });
    };

    const setSrc = (newSrc) => {
        input.value = newSrc;
        block.src = newSrc;
        renderPreview();
        onFieldChange();
    };

    input.addEventListener("input", () => {
        block.src = input.value.trim();
        renderPreview();
        onFieldChange();
    });
    input.addEventListener("blur", () => {
        block.src = input.value.trim();
        onFieldChange();
    });

    const uploadFile = (file) => {
        if (!file) return;

        const isFileImage = file.type.startsWith("image/");
        const isFileVideo = file.type.startsWith("video/");
        if (isImage && !isFileImage) {
            setStatus("⚠ Это не картинка", "err");
            return;
        }
        if (!isImage && !isFileVideo) {
            setStatus("⚠ Это не видео", "err");
            return;
        }

        const defaultName = file.name || (isImage ? "image.png" : "video.mp4");
        let name = prompt("Имя файла (с расширением):", defaultName);
        if (!name) return;
        name = name.trim();
        if (!name) return;

        const m = location.pathname.match(/^\/([^\/]+)\/admin\.html$/);
        const course = m ? m[1] : COURSE_KEY;

        progressWrap.style.display = "block";
        progressFill.style.width = "0%";
        progressText.textContent = "Загрузка... 0%";

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/upload?course=${encodeURIComponent(course)}&type=${uploadType}&filename=${encodeURIComponent(name)}`);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = pct + "%";
                progressText.textContent = "Загрузка... " + pct + "%";
            }
        };

        xhr.onload = () => {
            progressWrap.style.display = "none";
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    setSrc(data.path);
                    setStatus("✓ Загружено: " + data.path, "ok");
                } catch (e) {
                    setStatus("⚠ Ответ сервера непонятен", "err");
                }
            } else {
                setStatus("⚠ Ошибка загрузки: " + xhr.status + " " + xhr.responseText, "err");
            }
        };

        xhr.onerror = () => {
            progressWrap.style.display = "none";
            setStatus("⚠ Сервер не запущен или недоступен. Запусти server.js.", "err");
        };

        xhr.send(file);
    };

    fileBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) uploadFile(f);
        fileInput.value = "";
    };

    const dropZone = document.createElement("div");
    dropZone.className = "media-drop-zone";
    dropZone.textContent = "Перетащи файл сюда";
    wrap.appendChild(dropZone);

    ["dragenter", "dragover"].forEach(ev => {
        dropZone.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add("is-over");
        });
    });
    ["dragleave", "drop"].forEach(ev => {
        dropZone.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove("is-over");
        });
    });
    dropZone.addEventListener("drop", (e) => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) uploadFile(f);
    });

    if (isImage) {
        wrap.addEventListener("paste", (e) => {
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        const ext = file.type.split("/")[1] || "png";
                        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                        const generatedName = `paste_${ts}.${ext}`;
                        Object.defineProperty(file, "name", { value: generatedName, writable: false });
                        uploadFile(file);
                        return;
                    }
                }
            }
        });
        wrap.tabIndex = 0;
    }

    renderPreview();
    return wrap;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}
function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// ============================================================
// БЕЗОПАСНАЯ САНИТАЦИЯ HTML
// Разрешаем только теги из белого списка и только безопасные атрибуты.
// Все обработчики событий (onclick, onmouseover и т.п.) удаляются.
// style оставляем только с text-align.
// ============================================================
function sanitizeHtml(html) {
    if (html == null) return "";
    let s = String(html);

    // 0. Удаляем HTML-комментарии <!-- ... --> (артефакты Word/Google Docs)
    s = s.replace(/<!--[\s\S]*?-->/g, "");

    // 1. Вырезаем опасные теги вместе с содержимым
    s = s.replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, "");
    s = s.replace(/<(script|style|iframe|object|embed|svg|math)[^>]*\/?>/gi, "");

    // 2. Нормализуем <br> и &nbsp;
    s = s.replace(/<br\s*\/?>/gi, "<br>");
    s = s.replace(/&nbsp;/gi, " ");

    const allowed = /^(strong|b|em|i|u|s|strike|del|br|span|div|p)$/i;

    // 3. Пробегаем по всем тегам
    s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, function(match, tagName, attrs) {
        const tag = tagName.toLowerCase();
        if (!allowed.test(tag)) return "";

        const isClosing = match.charAt(1) === "/";
        if (isClosing) return "</" + tag + ">";

        // Разрешаем только style с text-align, никаких других атрибутов
        let safeAttrs = "";
        const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
        if (styleMatch) {
            const alignMatch = styleMatch[1].match(/text-align\s*:\s*(left|center|right|justify)/i);
            if (alignMatch) {
                safeAttrs = ' style="text-align:' + alignMatch[1].toLowerCase() + '"';
            }
        }
        return "<" + tag + safeAttrs + ">";
    });

    // 4. Схлопываем пробелы
    s = s.replace(/[ \t]+/g, " ");
    s = s.trim();
    return s;
}

function handlePaste(e) {
    e.preventDefault();
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;

    let html = cd.getData("text/html") || "";
    let text = cd.getData("text/plain") || "";

    let clean;
    if (html) {
        clean = sanitizeHtml(html);
    } else {
        clean = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\r?\n+/g, "<br>")
            .replace(/\s+/g, " ")
            .trim();
    }

    if (!clean) return;

    document.execCommand("insertHTML", false, clean);
}

function addBlock(type) {
    readFromDom();
    const slide = currentLesson().slides[state.currentSlideIndex];
    if (!slide) return;
    const nb = makeNewBlock(type);
    slide.content.push(nb); renderSlide(); saveDraft();
}
function addMemoBlock(type) {
    readFromDom();
    const cell = currentLesson().cells[state.currentSlideIndex];
    if (!cell) return;
    const nb = makeNewBlock(type);
    cell.content.push(nb); renderCell(); saveDraft();
}
function makeNewBlock(type) {
    if (type === "p") return { type: "p", text: "Новый абзац" };
    if (type === "h3") return { type: "h3", text: "Новый подзаголовок" };
    if (type === "ul") return {
        type: "ul",
        style: "bullet",
        items: [
            { text: "Первый пункт", level: 0 },
            { text: "Второй пункт", level: 0 },
            { text: "Третий пункт", level: 0 }
        ]
    };
    if (type === "quote") return { type: "quote", text: "Выделенная мысль" };
    if (type === "link") return { type: "link", text: "Текст ссылки", href: "https://" };
    if (type === "image") return { type: "image", src: "", alt: "", markers: [] };
    if (type === "video") return { type: "video", src: "" };
    if (type === "table") return {
        type: "table",
        header: true,
        rows: [
            ["Заголовок 1", "Заголовок 2"],
            ["", ""],
            ["", ""]
        ]
    };
    return { type: "p", text: "" };
}

function removeBlock(btn) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    currentLesson().slides[state.currentSlideIndex].content.splice(idx, 1);
    renderSlide(); saveDraft();
}
function moveBlock(btn, dir) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    const ni = idx + dir;
    const slide = currentLesson().slides[state.currentSlideIndex];
    if (ni < 0 || ni >= slide.content.length) return;
    const [it] = slide.content.splice(idx, 1);
    slide.content.splice(ni, 0, it);
    renderSlide(); saveDraft();
}
function removeMemoBlock(btn) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    currentLesson().cells[state.currentSlideIndex].content.splice(idx, 1);
    renderCell(); saveDraft();
}
function moveMemoBlock(btn, dir) {
    readFromDom();
    const idx = parseInt(btn.closest(".block-wrapper").dataset.index);
    const ni = idx + dir;
    const cell = currentLesson().cells[state.currentSlideIndex];
    if (ni < 0 || ni >= cell.content.length) return;
    const [it] = cell.content.splice(idx, 1);
    cell.content.splice(ni, 0, it);
    renderCell(); saveDraft();
}

function addSlide() {
    readFromDom();
    const lesson = currentLesson();
    if (lesson.type === "memo") {
        if (!lesson.cells) lesson.cells = [];
        if (lesson.cells.length >= MAX_MEMO_CELLS) {
            alert("Максимум " + MAX_MEMO_CELLS + " ячеек в памятке.");
            return;
        }
        lesson.cells.push({
            title: "НОВАЯ ЯЧЕЙКА",
            content: [{ type: "ul", style: "bullet", items: [{ text: "Первый пункт", level: 0 }, { text: "Второй пункт", level: 0 }] }]
        });
        state.currentSlideIndex = lesson.cells.length - 1;
        refreshAll(); saveDraft();
    } else if (lesson.type === "glossary") {
        if (!lesson.terms) lesson.terms = [];
        lesson.terms.push({
            name: "Новый термин",
            content: [{ type: "p", text: "Определение термина." }]
        });
        state.currentSlideIndex = lesson.terms.length - 1;
        refreshAll(); saveDraft();
    } else {
        lesson.slides.push({ shortName: "Новый слайд", title: "Новый слайд", content: [{ type: "p", text: "Текст нового слайда." }] });
        state.currentSlideIndex = lesson.slides.length - 1;
        refreshAll(); saveDraft();
    }
}

function duplicateSlide() {
    readFromDom();
    const lesson = currentLesson();
    const idx = state.currentSlideIndex;

    if (lesson.type === "memo") {
        if (!lesson.cells || !lesson.cells[idx]) return;
        if (lesson.cells.length >= MAX_MEMO_CELLS) {
            alert("Максимум " + MAX_MEMO_CELLS + " ячеек. Удалить что-то, чтобы дублировать.");
            return;
        }
        const copy = JSON.parse(JSON.stringify(lesson.cells[idx]));
        copy.title = (copy.title || "Без названия") + " (копия)";
        lesson.cells.splice(idx + 1, 0, copy);
        state.currentSlideIndex = idx + 1;
        refreshAll(); saveDraft();
        setStatus("📋 Ячейка скопирована", "ok");
    } else if (lesson.type === "glossary") {
        if (!lesson.terms || !lesson.terms[idx]) return;
        const copy = JSON.parse(JSON.stringify(lesson.terms[idx]));
        copy.name = (copy.name || "Без названия") + " (копия)";
        lesson.terms.splice(idx + 1, 0, copy);
        state.currentSlideIndex = idx + 1;
        refreshAll(); saveDraft();
        setStatus("📋 Термин скопирован", "ok");
    } else {
        if (!lesson.slides || !lesson.slides[idx]) return;
        const copy = JSON.parse(JSON.stringify(lesson.slides[idx]));
        copy.title = (copy.title || "Без названия") + " (копия)";
        copy.shortName = (copy.shortName || "Без названия") + " (копия)";
        lesson.slides.splice(idx + 1, 0, copy);
        state.currentSlideIndex = idx + 1;
        refreshAll(); saveDraft();
        setStatus("📋 Слайд скопирован", "ok");
    }
}

function deleteSlide() {
    const lesson = currentLesson();
    if (lesson.type === "memo") {
        const cells = lesson.cells;
        if (cells.length <= 1) { alert("Нельзя удалить единственную ячейку."); return; }
        if (!confirm("Удалить ячейку?")) return;
        cells.splice(state.currentSlideIndex, 1);
        if (state.currentSlideIndex >= cells.length) state.currentSlideIndex = cells.length - 1;
        refreshAll(); saveDraft();
    } else if (lesson.type === "glossary") {
        const terms = lesson.terms || [];
        if (terms.length <= 1) { alert("Нельзя удалить единственный термин."); return; }
        const termName = String(terms[state.currentSlideIndex].name || "").trim() || "(без названия)";
        if (!confirm("Удалить термин «" + termName + "»?")) return;
        terms.splice(state.currentSlideIndex, 1);
        if (state.currentSlideIndex >= terms.length) state.currentSlideIndex = terms.length - 1;
        refreshAll(); saveDraft();
    } else {
        const slides = lesson.slides;
        if (slides.length <= 1) { alert("Нельзя удалить единственный слайд."); return; }
        if (!confirm("Удалить слайд?")) return;
        slides.splice(state.currentSlideIndex, 1);
        if (state.currentSlideIndex >= slides.length) state.currentSlideIndex = slides.length - 1;
        refreshAll(); saveDraft();
    }
}

function renderGroupsEditor(lesson) {
    if (!lesson.groups) lesson.groups = [];
    const list = document.getElementById("groups-list");
    const empty = document.getElementById("groups-empty");
    list.innerHTML = "";
    if (lesson.groups.length === 0) {
        empty.style.display = "block";
    } else {
        empty.style.display = "none";
        lesson.groups.forEach((g, i) => {
            const row = document.createElement("div");
            row.className = "group-row-edit";
            const inp = document.createElement("input");
            inp.type = "text"; inp.value = g;
            inp.addEventListener("input", onFieldChange);
            row.appendChild(inp);
            const del = document.createElement("button");
            del.className = "mini-icon-btn del"; del.textContent = "✕";
            del.onclick = () => deleteGroup(i);
            row.appendChild(del);
            list.appendChild(row);
        });
    }
}

function readGroupsFromDom() {
    const lesson = currentLesson();
    if (lesson.type !== "quiz") return;
    const inputs = document.querySelectorAll("#groups-list input");
    lesson.groups = Array.from(inputs).map(inp => inp.value);
}

function addGroup() {
    readFromDom();
    const lesson = currentLesson();
    if (!lesson.groups) lesson.groups = [];
    lesson.groups.push("Новая группа");
    renderGroupsEditor(lesson);
    renderQuizEditor(lesson);
    saveDraft();
}

function deleteGroup(index) {
    readFromDom();
    const lesson = currentLesson();
    const removedName = lesson.groups[index];
    if (!confirm(`Удалить группу «${removedName}»? Вопросы этой группы перейдут в «Без группы».`)) return;
    lesson.groups.splice(index, 1);
    lesson.questions.forEach(q => { if (q.group === removedName) q.group = null; });
    renderGroupsEditor(lesson);
    renderQuizEditor(lesson);
    saveDraft();
}

function renderRandomizeToggles(lesson) {
    const rq = document.getElementById("randomize-questions");
    const ro = document.getElementById("randomize-options");
    if (!rq || !ro) return;
    rq.checked = !!lesson.randomizeQuestions;
    ro.checked = !!lesson.randomizeOptions;
}

function renderQuizEditor(lesson) {
    if (!lesson.questions) lesson.questions = [];
    const box = document.getElementById("quiz-questions");
    box.innerHTML = "";
    lesson.questions.forEach((q, i) => box.appendChild(createQuestionElement(q, i)));
    document.getElementById("quiz-summary").textContent = `Тест: ${lesson.questions.length} вопросов`;
    renderRandomizeToggles(lesson);
}

function createQuestionElement(q, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "q-item";
    wrapper.dataset.index = index;
    wrapper.dataset.type = q.type;
    const lesson = currentLesson();

    const header = document.createElement("div");
    header.className = "q-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "q-header-left";

    const numLabel = document.createElement("span");
    numLabel.textContent = `Вопрос ${index + 1}`;
    headerLeft.appendChild(numLabel);

    const typeSel = document.createElement("select");
    typeSel.className = "q-type-select";
    [
        { v: "single", t: "Один ответ" },
        { v: "multi",  t: "Несколько ответов" },
        { v: "match",  t: "Соответствие" },
        { v: "card",   t: "Карточка" }
    ].forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.v; o.textContent = opt.t;
        if (q.type === opt.v) o.selected = true;
        typeSel.appendChild(o);
    });
    typeSel.addEventListener("change", () => changeQuestionType(wrapper, typeSel.value));
    headerLeft.appendChild(typeSel);

    header.appendChild(headerLeft);

    const tools = document.createElement("div");
    tools.className = "q-tools";
    tools.innerHTML = `
        <button class="mini-icon-btn" title="Вверх" onclick="moveQuestion(this, -1)">↑</button>
        <button class="mini-icon-btn" title="Вниз" onclick="moveQuestion(this, 1)">↓</button>
        <button class="mini-icon-btn dup" title="Дублировать" onclick="duplicateQuestion(this)">📋</button>
        <button class="mini-icon-btn del" title="Удалить" onclick="removeQuestion(this)">✕</button>`;
    header.appendChild(tools);
    wrapper.appendChild(header);

    if (lesson.groups && lesson.groups.length > 0) {
        const grRow = document.createElement("div");
        grRow.className = "q-group-row";
        const lbl = document.createElement("label");
        lbl.textContent = "📂 Группа:";
        grRow.appendChild(lbl);
        const sel = document.createElement("select");
        const optNone = document.createElement("option");
        optNone.value = ""; optNone.textContent = "— Без группы —";
        sel.appendChild(optNone);
        lesson.groups.forEach(g => {
            const opt = document.createElement("option");
            opt.value = g; opt.textContent = g;
            if (q.group === g) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener("change", onFieldChange);
        grRow.appendChild(sel);
        wrapper.appendChild(grRow);
    }

    const body = document.createElement("div");
    body.className = "q-body";
    body.appendChild(createQuestionBody(q));
    wrapper.appendChild(body);

    return wrapper;
}

function createQuestionBody(q) {
    if (q.type === "single" || q.type === "multi") return createChoiceBody(q);
    if (q.type === "match") return createMatchBody(q);
    if (q.type === "card") return createCardBody(q);
    return document.createElement("div");
}

function createChoiceBody(q) {
    const box = document.createElement("div");
    box.className = "q-body-choice";

    const qText = document.createElement("textarea");
    qText.className = "input q-text"; qText.value = q.text || "";
    qText.placeholder = "Текст вопроса";
    qText.addEventListener("input", onFieldChange);
    box.appendChild(qText);

    const optsBox = document.createElement("div");
    optsBox.className = "q-options";
    optsBox.style.marginTop = "12px";
    const options = q.options || ["", "", "", ""];
    const correctArr = normalizeCorrect(q.correct);

    options.forEach((optText, j) => {
        const optRow = document.createElement("div");
        const isCorrect = correctArr.includes(optText);
        optRow.className = "q-option" + (isCorrect ? " correct-row" : "");

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isCorrect;
        cb.addEventListener("change", () => {
            optRow.classList.toggle("correct-row", cb.checked);
            onFieldChange();
        });
        optRow.appendChild(cb);

        const inp = document.createElement("input");
        inp.type = "text"; inp.className = "q-opt-text";
        inp.value = optText || "";
        inp.placeholder = "Вариант " + (j + 1);
        inp.addEventListener("input", onFieldChange);
        optRow.appendChild(inp);

        const optTools = document.createElement("div");
        optTools.className = "opt-tools";
        optTools.innerHTML = `
            <button type="button" class="mini-icon-btn" title="Добавить вариант ниже" onclick="addOption(this)">＋</button>
            <button type="button" class="mini-icon-btn del" title="Удалить вариант" onclick="removeOption(this)">✕</button>
        `;
        optRow.appendChild(optTools);
        optsBox.appendChild(optRow);
    });
    box.appendChild(optsBox);

    const expLabel = document.createElement("div");
    expLabel.className = "q-explain-label";
    expLabel.textContent = "💡 Объяснение (показывается после ответа)";
    expLabel.style.marginTop = "12px";
    box.appendChild(expLabel);
    const exp = document.createElement("textarea");
    exp.className = "q-explain"; exp.value = q.explain || "";
    exp.placeholder = "Почему этот ответ правильный";
    exp.addEventListener("input", onFieldChange);
    box.appendChild(exp);

    return box;
}

function createMatchBody(q) {
    const box = document.createElement("div");
    box.className = "q-body-match";

    const qText = document.createElement("textarea");
    qText.className = "input q-text"; qText.value = q.text || "";
    qText.placeholder = "Инструкция (например: Соедини слово и перевод)";
    qText.addEventListener("input", onFieldChange);
    box.appendChild(qText);

    const pairsLabel = document.createElement("div");
    pairsLabel.className = "q-explain-label";
    pairsLabel.textContent = "Пары (левое ↔ правое)";
    pairsLabel.style.marginTop = "12px";
    box.appendChild(pairsLabel);

    const pairsBox = document.createElement("div");
    pairsBox.className = "match-pairs-editor";
    const pairs = q.pairs || [];
    pairs.forEach((p, i) => {
        const row = document.createElement("div");
        row.className = "match-pair-row";

        const left = document.createElement("input");
        left.type = "text"; left.className = "match-left";
        left.value = p.left || ""; left.placeholder = "Левая часть";
        left.addEventListener("input", onFieldChange);
        row.appendChild(left);

        const arrow = document.createElement("span");
        arrow.className = "match-pair-arrow";
        arrow.textContent = "↔";
        row.appendChild(arrow);

        const right = document.createElement("input");
        right.type = "text"; right.className = "match-right";
        right.value = p.right || ""; right.placeholder = "Правая часть";
        right.addEventListener("input", onFieldChange);
        row.appendChild(right);

        const del = document.createElement("button");
        del.type = "button"; del.className = "mini-icon-btn del"; del.textContent = "✕";
        del.title = "Удалить пару";
        del.onclick = () => removeMatchPair(row);
        row.appendChild(del);

        pairsBox.appendChild(row);
    });
    box.appendChild(pairsBox);

    const btnRow = document.createElement("div");
    btnRow.style.marginTop = "8px";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-outline";
    addBtn.textContent = "＋ Добавить пару";
    addBtn.style.padding = "6px 14px";
    addBtn.style.fontSize = "13px";
    addBtn.onclick = () => addMatchPair(pairsBox);
    btnRow.appendChild(addBtn);
    box.appendChild(btnRow);

    const expLabel = document.createElement("div");
    expLabel.className = "q-explain-label";
    expLabel.textContent = "💡 Объяснение (опционально)";
    expLabel.style.marginTop = "12px";
    box.appendChild(expLabel);
    const exp = document.createElement("textarea");
    exp.className = "q-explain"; exp.value = q.explain || "";
    exp.placeholder = "Необязательно. Пояснение после ответа.";
    exp.addEventListener("input", onFieldChange);
    box.appendChild(exp);

    return box;
}

function addMatchPair(pairsBox) {
    readFromDom();
    const lesson = currentLesson();
    const qItem = pairsBox.closest(".q-item");
    const qIdx = parseInt(qItem.dataset.index);
    const q = lesson.questions[qIdx];
    if (!q.pairs) q.pairs = [];
    q.pairs.push({ left: "", right: "" });
    renderQuizEditor(lesson); saveDraft();
}

function removeMatchPair(row) {
    readFromDom();
    const lesson = currentLesson();
    const qItem = row.closest(".q-item");
    const qIdx = parseInt(qItem.dataset.index);
    const q = lesson.questions[qIdx];
    const rows = Array.from(row.parentNode.children);
    const pairIdx = rows.indexOf(row);
    if ((q.pairs || []).length <= 1) { alert("Минимум 1 пара."); return; }
    q.pairs.splice(pairIdx, 1);
    renderQuizEditor(lesson); saveDraft();
}

function createCardBody(q) {
    const box = document.createElement("div");
    box.className = "q-body-card";

    const front = document.createElement("div");
    front.className = "card-editor-section";
    front.innerHTML = `<div class="card-editor-section-title">Передняя сторона (вопрос)</div>`;
    const fText = document.createElement("div");
    fText.className = "card-editor-field";
    fText.innerHTML = `<label>Текст</label>`;
    const fTextInput = document.createElement("textarea");
    fTextInput.className = "input card-front"; fTextInput.value = q.front || "";
    fTextInput.placeholder = "Например: nature";
    fTextInput.addEventListener("input", onFieldChange);
    fText.appendChild(fTextInput);
    front.appendChild(fText);

    const fImg = document.createElement("div");
    fImg.className = "card-editor-field";
    fImg.innerHTML = `<label>Картинка (путь или URL, опционально)</label>`;
    const fImgInput = document.createElement("input");
    fImgInput.type = "text"; fImgInput.className = "input card-front-image media-src-input";
    fImgInput.value = q.frontImage || "";
    fImgInput.placeholder = "images/front.png";
    fImgInput.addEventListener("input", onFieldChange);
    fImg.appendChild(fImgInput);
    front.appendChild(fImg);
    box.appendChild(front);

    const back = document.createElement("div");
    back.className = "card-editor-section";
    back.innerHTML = `<div class="card-editor-section-title">Задняя сторона (ответ)</div>`;
    const bText = document.createElement("div");
    bText.className = "card-editor-field";
    bText.innerHTML = `<label>Текст</label>`;
    const bTextInput = document.createElement("textarea");
    bTextInput.className = "input card-back"; bTextInput.value = q.back || "";
    bTextInput.placeholder = "Например: природа";
    bTextInput.addEventListener("input", onFieldChange);
    bText.appendChild(bTextInput);
    back.appendChild(bText);

    const bImg = document.createElement("div");
    bImg.className = "card-editor-field";
    bImg.innerHTML = `<label>Картинка (путь или URL, опционально)</label>`;
    const bImgInput = document.createElement("input");
    bImgInput.type = "text"; bImgInput.className = "input card-back-image media-src-input";
    bImgInput.value = q.backImage || "";
    bImgInput.placeholder = "images/back.png";
    bImgInput.addEventListener("input", onFieldChange);
    bImg.appendChild(bImgInput);
    back.appendChild(bImg);
    box.appendChild(back);

    return box;
}

function changeQuestionType(wrapper, newType) {
    readFromDom();
    const idx = parseInt(wrapper.dataset.index);
    const lesson = currentLesson();
    const q = lesson.questions[idx];
    if (q.type === newType) return;
    if (!confirm("Сменить тип вопроса? Текущее содержимое будет заменено на шаблон нового типа.")) {
        renderQuizEditor(lesson);
        return;
    }
    const common = { type: newType, group: q.group || null };
    if (newType === "single" || newType === "multi") {
        common.text = "Новый вопрос?";
        common.options = ["Вариант A", "Вариант B", "Вариант C", "Вариант D"];
        common.correct = ["Вариант A"];
        common.explain = "";
    } else if (newType === "match") {
        common.text = "Соедини пары";
        common.pairs = [
            { left: "Слово 1", right: "Перевод 1" },
            { left: "Слово 2", right: "Перевод 2" },
            { left: "Слово 3", right: "Перевод 3" }
        ];
    } else if (newType === "card") {
        common.front = "nature";
        common.frontImage = "";
        common.back = "природа";
        common.backImage = "";
    }
    lesson.questions[idx] = common;
    renderQuizEditor(lesson);
    saveDraft();
}

function readQuizFromDom() {
    const lesson = currentLesson();
    const items = document.querySelectorAll("#quiz-questions .q-item");
    const questions = [];
    items.forEach(item => {
        const type = item.dataset.type;
        const grSel = item.querySelector(".q-group-row select");
        const group = grSel ? (grSel.value || null) : null;

        if (type === "single" || type === "multi") {
            const text = item.querySelector(".q-text").value;
            const options = Array.from(item.querySelectorAll(".q-opt-text")).map(inp => inp.value);
            const checkboxes = item.querySelectorAll('input[type="checkbox"]');
            const correct = [];
            checkboxes.forEach((cb, j) => { if (cb.checked) correct.push(options[j]); });
            if (correct.length === 0) correct.push(options[0] || "");
            let finalCorrect;
            if (type === "single") {
                finalCorrect = [correct[0]];
            } else {
                finalCorrect = correct;
            }
            const explain = item.querySelector(".q-explain").value;
            questions.push({ type, text, options, correct: finalCorrect, explain, group });
        } else if (type === "match") {
            const text = item.querySelector(".q-text").value;
            const rows = item.querySelectorAll(".match-pair-row");
            const pairs = [];
            rows.forEach(row => {
                const left = row.querySelector(".match-left").value;
                const right = row.querySelector(".match-right").value;
                if (left || right) pairs.push({ left, right });
            });
            const explainEl = item.querySelector(".q-explain");
            const explain = explainEl ? explainEl.value : "";
            questions.push({ type, text, pairs, explain, group });
        } else if (type === "card") {
            const front = item.querySelector(".card-front").value;
            const frontImage = item.querySelector(".card-front-image").value.trim();
            const back = item.querySelector(".card-back").value;
            const backImage = item.querySelector(".card-back-image").value.trim();
            questions.push({ type, front, frontImage, back, backImage, group });
        }
    });
    lesson.questions = questions;
}

function addQuestion() {
    readFromDom();
    const lesson = currentLesson();
    if (!lesson.questions) lesson.questions = [];
    lesson.questions.push({
        type: "single",
        text: "Новый вопрос?",
        options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
        correct: ["Вариант A"],
        explain: "Объяснение правильного ответа.",
        group: (lesson.groups && lesson.groups[0]) || null
    });
    renderQuizEditor(lesson); saveDraft();
}

function duplicateQuestion(btn) {
    readFromDom();
    const lesson = currentLesson();
    const idx = parseInt(btn.closest(".q-item").dataset.index);
    const copy = JSON.parse(JSON.stringify(lesson.questions[idx]));
    if (copy.text) copy.text = copy.text + " (копия)";
    lesson.questions.splice(idx + 1, 0, copy);
    renderQuizEditor(lesson); saveDraft();
}

function removeQuestion(btn) {
    readFromDom();
    const lesson = currentLesson();
    const idx = parseInt(btn.closest(".q-item").dataset.index);
    if (lesson.questions.length <= 1) { alert("Нельзя удалить единственный вопрос."); return; }
    if (!confirm("Удалить вопрос?")) return;
    lesson.questions.splice(idx, 1);
    renderQuizEditor(lesson); saveDraft();
}

function moveQuestion(btn, dir) {
    readFromDom();
    const lesson = currentLesson();
    const idx = parseInt(btn.closest(".q-item").dataset.index);
    const ni = idx + dir;
    if (ni < 0 || ni >= lesson.questions.length) return;
    const [it] = lesson.questions.splice(idx, 1);
    lesson.questions.splice(ni, 0, it);
    renderQuizEditor(lesson); saveDraft();
}

function addOption(btn) {
    readFromDom();
    const lesson = currentLesson();
    const qItem = btn.closest(".q-item");
    const qIdx = parseInt(qItem.dataset.index);
    const q = lesson.questions[qIdx];
    const optRow = btn.closest(".q-option");
    const allRows = Array.from(qItem.querySelectorAll(".q-option"));
    const optIdx = allRows.indexOf(optRow);
    q.options.splice(optIdx + 1, 0, "Новый вариант");
    renderQuizEditor(lesson); saveDraft();
}

function removeOption(btn) {
    readFromDom();
    const lesson = currentLesson();
    const qItem = btn.closest(".q-item");
    const qIdx = parseInt(qItem.dataset.index);
    const q = lesson.questions[qIdx];
    if (q.options.length <= 2) { alert("Минимум 2 варианта ответа."); return; }
    const optRow = btn.closest(".q-option");
    const allRows = Array.from(qItem.querySelectorAll(".q-option"));
    const optIdx = allRows.indexOf(optRow);
    const removedText = allRows[optIdx].querySelector(".q-opt-text").value;
    q.options.splice(optIdx, 1);
    q.correct = normalizeCorrect(q.correct).filter(c => c !== removedText);
    if (q.correct.length === 0) q.correct.push(q.options[0]);
    renderQuizEditor(lesson); saveDraft();
}

/* ===== ЧТЕНИЕ contentEditable ===== */
function readEditableBlocks(containerId, blocks) {
    const container = document.getElementById(containerId);
    if (!container || !Array.isArray(blocks)) return;
    const wrappers = container.querySelectorAll(".block-wrapper");
    wrappers.forEach((w) => {
        const idx = parseInt(w.dataset.index);
        const b = blocks[idx];
        if (!b) return;
        if (b.type === "p" || b.type === "h3") {
            const el = w.querySelector("p, h3");
            if (el) {
                b.text = sanitizeHtml(extractNoteMarkers(el, b.notes || []));
            }
        } else if (b.type === "quote") {
            const el = w.querySelector(".quote-text");
            if (el) {
                b.text = sanitizeHtml(extractNoteMarkers(el, b.notes || []));
            }
        } else if (b.type === "link") {
            const textEl = w.querySelector(".link-text");
            const urlEl = w.querySelector(".link-url");
            if (textEl) b.text = sanitizeHtml(textEl.innerHTML);
            if (urlEl) b.href = urlEl.value.trim();
        }
    });
}

function readFromDom() {
    const lesson = currentLesson();
    if (!lesson) return;
    lesson.title = document.getElementById("lesson-title-input").value;
    lesson.description = document.getElementById("lesson-description-input").value.trim();
    lesson.coverImage = document.getElementById("lesson-cover-input").value.trim();
    if (!lesson.description) delete lesson.description;
    if (!lesson.coverImage) delete lesson.coverImage;
    if (lesson.type === "quiz") {
        readGroupsFromDom();
        readQuizFromDom();
        const rq = document.getElementById("randomize-questions");
        const ro = document.getElementById("randomize-options");
        if (rq) lesson.randomizeQuestions = rq.checked;
        if (ro) lesson.randomizeOptions = ro.checked;
   } else if (lesson.type === "memo") {
    const cell = lesson.cells[state.currentSlideIndex];
    if (!cell) return;
    cell.title = document.getElementById("cell-title-input").value;
    cell._editedAt = new Date().toISOString();
    readEditableBlocks("memo-content", cell.content);
} else if (lesson.type === "glossary") {
    const term = lesson.terms[state.currentSlideIndex];
    if (!term) return;
    term.name = document.getElementById("term-name-input").value;
    term._editedAt = new Date().toISOString();
    readEditableBlocks("term-content", term.content);
} else {
    const slide = lesson.slides[state.currentSlideIndex];
    if (!slide) return;
    slide.shortName = document.getElementById("slide-shortname-input").value;
    slide.title = document.getElementById("slide-title-input").value;
    slide._editedAt = new Date().toISOString();
    readEditableBlocks("preview-content", slide.content);
}
    courseSettings.courseTitle = document.getElementById("course-title-input").value;
    courseSettings.pageTitle = document.getElementById("page-title-input").value;
    saveDraft();
}

let changeTimer;
function onFieldChange() {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
        const lesson = currentLesson();
        if (lesson.type === "quiz") {
            readGroupsFromDom();
            readQuizFromDom();
            const rq = document.getElementById("randomize-questions");
            const ro = document.getElementById("randomize-options");
            if (rq) lesson.randomizeQuestions = rq.checked;
            if (ro) lesson.randomizeOptions = ro.checked;
            renderLessonList();
        } else {
            readFromDom();
            renderLessonList();
            if (lesson.type === "memo") renderCellsList();
            else if (lesson.type === "glossary") renderTermsList();
            else renderSlideList();
        }

        // Живое превью обложки — реагирует на ручной ввод пути
        // в #lesson-cover-input, не дожидаясь переключения блока.
        updateLiveCoverPreview();

        saveDraft();
        autoSaveToServer();
    }, 2000);
}
function updateLiveCoverPreview() {
    const box = document.getElementById("lesson-cover-preview");
    const input = document.getElementById("lesson-cover-input");
    if (!box || !input) return;
    const src = input.value.trim();
    if (!src) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
    }
    box.style.display = "block";
    box.innerHTML = `<img src="${escapeAttr(src)}" alt="" onerror="this.parentNode.innerHTML='<div class=&quot;lesson-cover-preview-error&quot;>⚠ Файл не найден</div>'">`;
}
function onCourseSettingsChange() {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
        courseSettings.courseTitle = document.getElementById("course-title-input").value;
        courseSettings.pageTitle = document.getElementById("page-title-input").value;
        saveDraft();
    }, 400);
}
function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ allLessons, courseSettings })); } catch(e){} }

/* ============================================================
   АВТОСОХРАНЕНИЕ В data.js
   ============================================================ */
let autoSaveInFlight = false;
let autoSavePending = false;

async function autoSaveToServer() {
    if (autoSaveInFlight) {
        autoSavePending = true;
        return;
    }
    autoSaveInFlight = true;

    try {
        const content = buildDataJs();
        const res = await fetchWithTimeout("/save-data", {
            method: "POST",
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
            body: content
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || ("HTTP " + res.status));
        }
        localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
        console.warn("Автосохранение не удалось:", e);
    } finally {
        autoSaveInFlight = false;
        if (autoSavePending) {
            autoSavePending = false;
            autoSaveToServer();
        }
    }
}

function addLesson(type) {
    readFromDom();
    let baseKey;
    if (type === "quiz") baseKey = "new_quiz";
    else if (type === "memo") baseKey = "new_memo";
    else if (type === "glossary") baseKey = "new_glossary";
    else baseKey = "new_lesson";
    let key = baseKey;
    let n = 1;
    while (allLessons[key]) { key = baseKey + "_" + n; n++; }

    if (type === "quiz") {
        allLessons[key] = {
            type: "quiz", title: "Новый тест",
            randomizeQuestions: false,
            randomizeOptions: false,
            groups: [],
            questions: [{
                type: "single",
                text: "Первый вопрос?",
                options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
                correct: ["Вариант A"],
                explain: "Объяснение правильного ответа.",
                group: null
            }]
        };
    } else if (type === "memo") {
        allLessons[key] = {
            type: "memo",
            title: "Новая памятка",
            cells: [{
                title: "НОВАЯ ЯЧЕЙКА",
                content: [{ type: "ul", style: "bullet", items: [
                    { text: "Первый пункт", level: 0 },
                    { text: "Второй пункт", level: 0 }
                ] }]
            }]
        };
    } else if (type === "glossary") {
        allLessons[key] = {
            type: "glossary",
            title: "Новый глоссарий",
            terms: [{
                name: "Новый термин",
                content: [{ type: "p", text: "Определение термина." }]
            }]
        };
    } else {
        allLessons[key] = {
            type: "theory", title: "Новый блок",
            slides: [{ shortName: "Новый слайд", title: "Новый слайд", content: [{ type: "p", text: "Текст нового слайда." }] }]
        };
    }
    state.currentLessonId = key; state.currentSlideIndex = 0;
    refreshAll(); saveDraft();
    autoSaveToServer();
}

function deleteLesson() {
    const ids = Object.keys(allLessons);
    if (ids.length <= 1) { alert("Нельзя удалить единственный блок."); return; }
    if (!confirm("Удалить блок «" + currentLesson().title + "»?")) return;
    delete allLessons[state.currentLessonId];
    state.currentLessonId = Object.keys(allLessons)[0]; state.currentSlideIndex = 0;
    refreshAll(); saveDraft();
    autoSaveToServer();
}

function exportLesson(id) {
    readFromDom();
    const lesson = allLessons[id];
    if (!lesson) { setStatus("Ошибка: блок не найден", "err"); return; }
    const payload = {
        _type: "kp_block_export",
        _version: 1,
        lesson: lesson
    };
    const fileName = "block_" + id + ".json";
    downloadJson(fileName, payload);
    setStatus("📤 Экспортирован блок: " + fileName, "ok");
}

function exportCourse() {
    readFromDom();
    const payload = {
        _type: "kp_course_export",
        _version: 1,
        courseSettings: courseSettings,
        allLessons: allLessons
    };
    const fileName = "course_export.json";
    downloadJson(fileName, payload);
    setStatus("📤 Экспортирован весь курс: " + fileName, "ok");
}

function importLesson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data || data._type !== "kp_block_export" || !data.lesson) {
                    setStatus("Ошибка: это не файл блока курса", "err");
                    return;
                }
                const lesson = data.lesson;
                if (lesson.type !== "theory" && lesson.type !== "quiz" && lesson.type !== "memo" && lesson.type !== "glossary") {
                    setStatus("Ошибка: неизвестный тип блока", "err");
                    return;
                }
                readFromDom();
                let originalKey = null;
                const m = file.name.match(/^block_(.+)\.json$/i);
                if (m && m[1]) originalKey = m[1];
                const baseKey = originalKey || (lesson.type === "quiz" ? "new_quiz" : (lesson.type === "memo" ? "new_memo" : (lesson.type === "glossary" ? "new_glossary" : "new_lesson")));
                let finalKey = baseKey;
                let n = 1;
                while (allLessons[finalKey]) {
                    finalKey = baseKey + "_" + n;
                    n++;
                }
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
                        const existingGroups = new Set(lesson.groups);
                        lesson.questions.forEach(q => {
                            if (q.group && !existingGroups.has(q.group)) {
                                lesson.groups.push(q.group);
                                existingGroups.add(q.group);
                            }
                        });
                    }
                } else if (lesson.type === "theory") {
                    if (!lesson.slides) lesson.slides = [];
                    lesson.slides.forEach(slide => {
                        if (!slide.content) slide.content = [];
                        migrateListBlocksInContent(slide.content);
                    });
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
                }
                allLessons[finalKey] = lesson;
                state.currentLessonId = finalKey;
                state.currentSlideIndex = 0;
                refreshAll();
                saveDraft();
                autoSaveToServer();
                const renamed = finalKey !== baseKey ? " (переименован в " + finalKey + ")" : "";
                setStatus("📥 Импортирован блок: " + lesson.title + renamed, "ok");
            } catch (e) {
                setStatus("Ошибка чтения файла: " + e.message, "err");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function importCourse() {
    if (!confirm("Импорт всего курса ЗАМЕНИТ все текущие блоки и настройки.\n\nПрогресс пользователей будет очищен.\n\nПродолжить?")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data || data._type !== "kp_course_export") {
                    setStatus("Ошибка: это не файл курса", "err");
                    return;
                }
                if (!data.allLessons || typeof data.allLessons !== "object") {
                    setStatus("Ошибка: в файле нет allLessons", "err");
                    return;
                }
                for (const k in allLessons) delete allLessons[k];
                for (const k in data.allLessons) allLessons[k] = data.allLessons[k];
                if (data.courseSettings) {
                    for (const k in courseSettings) delete courseSettings[k];
                    for (const k in data.courseSettings) courseSettings[k] = data.courseSettings[k];
                }
                Object.values(allLessons).forEach(lesson => {
                    if (lesson.type === "quiz" && lesson.questions) {
                        if (!lesson.groups) lesson.groups = [];
                        lesson.questions.forEach(q => {
                            q.type = detectType(q);
                            if (q.type === "single" || q.type === "multi") {
                                q.correct = normalizeCorrect(q.correct);
                            }
                            if (q.group === undefined) q.group = null;
                        });
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
                localStorage.removeItem(PROGRESS_KEY);
                state.currentLessonId = Object.keys(allLessons)[0];
                state.currentSlideIndex = 0;
                refreshAll();
                saveDraft();
                autoSaveToServer();
                setStatus("📥 Курс импортирован. Прогресс очищен.", "ok");
            } catch (e) {
                setStatus("Ошибка чтения файла: " + e.message, "err");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function downloadJson(filename, obj) {
    const content = JSON.stringify(obj, null, 4);
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================================
   ПРЕДПРОСМОТР
   ============================================================ */
function openPreview() {
    readFromDom();
    const lesson = currentLesson();
    pvState = { questionIdx: 0, qStates: [] };
    if (lesson.type === "quiz") {
        pvState.qStates = lesson.questions.map(q => makePvQuestionState(q));
        pvState.lessonType = "quiz";
    } else if (lesson.type === "memo") {
        pvState.lessonType = "memo";
    } else if (lesson.type === "glossary") {
        pvState.lessonType = "glossary";
        pvState.selectedTermIdx = state.currentSlideIndex || 0;
        pvState.searchQuery = "";
    } else {
        pvState.lessonType = "theory";
    }
    document.getElementById("pv-overlay").classList.add("show");
    document.body.style.overflow = "hidden";
    const pvCard = document.getElementById("pv-card");
    if (lesson.type === "memo" || lesson.type === "glossary") pvCard.classList.add("wide");
    else pvCard.classList.remove("wide");
    renderPreview();
}

function makePvQuestionState(q) {
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

function closePreview() {
    document.getElementById("pv-overlay").classList.remove("show");
    document.body.style.overflow = "";
    pvState = null;
}
function closePreviewIfOutside(event) {
    if (event.target.id === "pv-overlay") closePreview();
}
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && pvState) closePreview();
});

function renderPreview() {
    if (!pvState) return;
    const lesson = currentLesson();
    const body = document.getElementById("pv-body");
    if (lesson.type === "quiz") body.innerHTML = renderPreviewQuiz(lesson);
    else if (lesson.type === "memo") body.innerHTML = renderPreviewMemo(lesson);
    else if (lesson.type === "glossary") body.innerHTML = renderPreviewGlossary(lesson);
    else {
        const slide = lesson.slides[state.currentSlideIndex];
        if (!slide) { body.innerHTML = "<p>Слайд не найден</p>"; return; }
        body.innerHTML = renderPreviewSlide(lesson, slide);
    }
}

function renderPreviewTable(b) {
    const rows = b.rows || [];
    if (!rows.length) return "";
    const hasHeader = b.header === true;
    let maxCols = 0;
    rows.forEach(r => { if (Array.isArray(r) && r.length > maxCols) maxCols = r.length; });
    if (maxCols === 0) return "";

    let html = `<div class="slide-table-wrap"><table class="slide-table">`;
    rows.forEach((row, ri) => {
        const isHeaderRow = hasHeader && ri === 0;
        html += `<tr>`;
        for (let ci = 0; ci < maxCols; ci++) {
            const cell = (row && row[ci] !== undefined) ? String(row[ci]) : "";
            if (isHeaderRow) html += `<th>${cell}</th>`;
            else html += `<td>${cell}</td>`;
        }
        html += `</tr>`;
    });
    html += `</table></div>`;
    return html;
}

function renderPreviewList(b) {
    const style = b.style || "bullet";
    const items = b.items || [];
    if (!items.length) return "";
    let html = `<ul class="slide-list slide-list-${style}">`;
    let numCounter = [0, 0, 0];
    items.forEach((item, i) => {
        const text = (typeof item === "string") ? item : (item.text || "");
        const level = (typeof item === "object" && item.level !== undefined) ? item.level : 0;
        if (style === "number") {
            numCounter[level] = (numCounter[level] || 0) + 1;
            for (let k = level + 1; k < numCounter.length; k++) numCounter[k] = 0;
        }
        let marker = "";
        let markerHtml = "";
        if (style === "bullet") {
            marker = level === 0 ? "•" : (level === 1 ? "◦" : "▪");
        } else if (style === "number") {
            marker = numCounter[level] + ".";
        } else if (style === "checkbox") {
            markerHtml = `<span class="slide-list-check">☐</span>`;
        }
        const markerSpan = markerHtml || `<span class="slide-list-marker">${marker}</span>`;
        html += `<li class="slide-list-item level-${level}">${markerSpan}<span class="slide-list-text">${text}</span></li>`;
    });
    html += `</ul>`;
    return html;
}

function renderPreviewMemoBlocks(blocks) {
    let html = "";
    (blocks || []).forEach(b => {
        if (b.type === "p") html += `<p>${renderNotesInText(b.text || "", b.notes || [])}</p>`;
        else if (b.type === "h3") html += `<h3>${renderNotesInText(b.text || "", b.notes || [])}</h3>`;
        else if (b.type === "ul") html += renderPreviewList(b);
        else if (b.type === "quote") html += `<div class="quote">${renderNotesInText(b.text || "", b.notes || [])}</div>`;
        else if (b.type === "link") html += `<div class="pv-link-block"><a class="pv-slide-link" href="javascript:void(0)">🔗 ${b.text || "Ссылка"}</a></div>`;
        else if (b.type === "image" && b.src) html += `<div class="slide-media"><img src="${b.src}" alt=""></div>`;
        else if (b.type === "video" && b.src) html += `<div class="slide-media"><video src="${b.src}" controls preload="metadata"></video></div>`;
        else if (b.type === "table") html += renderPreviewTable(b);
    });
    return html;
}

function renderPreviewMemo(lesson) {
    const cells = lesson.cells || [];
    const count = cells.length;
    const cols = getMemoCols(count);
    let html = "";
    html += `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div></div>`;
    html += `<div class="pv-memo-grid cols-${cols}">`;
    cells.forEach(cell => {
        html += `<div class="pv-memo-cell">`;
        if (cell.title) html += `<div class="pv-memo-cell-header">${cell.title}</div>`;
        html += `<div class="pv-memo-cell-body">`;
        html += renderPreviewMemoBlocks(cell.content);
        html += `</div>`;
        html += `</div>`;
    });
    html += `</div>`;
    html += `<div class="pv-mini-hint">Это предпросмотр памятки.</div>`;
    return html;
}

function renderPreviewGlossary(lesson) {
    const terms = lesson.terms || [];
    const sorted = getSortedTermsWithIndexes(lesson);
    const selIdx = pvState.selectedTermIdx || 0;
    const query = (pvState.searchQuery || "").toLowerCase();

    let html = `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div></div>`;
    html += `<div style="display:flex;gap:24px;align-items:flex-start;">`;
    html += `<div style="width:260px;flex-shrink:0;">`;

    html += `<div style="margin-bottom:12px;">`;
    html += `<input type="text" class="input" placeholder="🔍 Поиск..." value="${escapeHtml(pvState.searchQuery || "")}" oninput="pvGlossarySearch(this.value)" style="font-size:13px;padding:8px 12px;">`;
    html += `</div>`;

    html += `<div style="max-height:60vh;overflow-y:auto;">`;
    let shown = 0;
    sorted.forEach(item => {
        const name = String(item.term.name || "").trim();
        if (query && !name.toLowerCase().includes(query)) return;
        shown++;
        const isCurrent = item.origIndex === selIdx;
        html += `<button class="pv-glossary-term${isCurrent ? ' current' : ''}" onclick="pvGlossarySelect(${item.origIndex})">${escapeHtml(name || "(без названия)")}</button>`;
    });
    if (shown === 0 && query) {
        html += `<div style="font-size:13px;color:var(--text-muted);font-style:italic;padding:8px 4px;">Ничего не найдено</div>`;
    }
    html += `</div>`;
    html += `</div>`;

    html += `<div style="flex:1;min-width:0;">`;
    const currentTerm = terms[selIdx];
    if (currentTerm) {
        html += `<h2 class="pv-slide-title" style="margin-top:0;">${escapeHtml(currentTerm.name || "(без названия)")}</h2>`;
        html += `<div class="pv-slide-content">`;
        html += renderPreviewMemoBlocks(currentTerm.content);
        html += `</div>`;
    } else {
        html += `<p style="color:var(--text-muted);">Термин не выбран.</p>`;
    }
    html += `</div>`;

    html += `</div>`;
    html += `<div class="pv-mini-hint">Это предпросмотр глоссария.</div>`;
    return html;
}

function pvGlossarySearch(value) {
    pvState.searchQuery = value || "";
    renderPreview();
}

function pvGlossarySelect(origIndex) {
    pvState.selectedTermIdx = origIndex;
    renderPreview();
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

function renderPreviewSlide(lesson, slide) {
    let html = "";
    html += `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div></div>`;
    html += `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:100%;"></div></div>`;
    html += `<h2 class="pv-slide-title">${slide.title || "(без заголовка)"}</h2>`;
    html += `<div class="pv-slide-content">`;
    (slide.content || []).forEach(b => {
        if (b.type === "p") html += `<p>${renderNotesInText(b.text || "", b.notes || [])}</p>`;
        else if (b.type === "h3") html += `<h3>${renderNotesInText(b.text || "", b.notes || [])}</h3>`;
        else if (b.type === "ul") html += renderPreviewList(b);
        else if (b.type === "quote") html += `<div class="quote">${renderNotesInText(b.text || "", b.notes || [])}</div>`;
        else if (b.type === "link") {
            const isInternal = (b.href || "").startsWith("#");
            html += `<div class="pv-link-block"><a class="pv-slide-link${isInternal ? ' internal' : ''}" href="javascript:void(0)">🔗 ${b.text || "Ссылка"}</a></div>`;
        }
        else if (b.type === "image" && b.src) html += `<div class="pv-slide-media"><img src="${b.src}" alt=""></div>`;
        else if (b.type === "video" && b.src) html += `<div class="pv-slide-media"><video src="${b.src}" controls preload="metadata"></video></div>`;
        else if (b.type === "table") html += renderPreviewTable(b);
    });
    html += `</div>`;
    html += `<div class="pv-mini-hint">Это предпросмотр. Ссылки и кнопки не работают.</div>`;
    return html;
}

function renderPreviewQuiz(lesson) {
    const idx = pvState.questionIdx;
    if (idx >= lesson.questions.length) {
        const score = pvState.qStates.filter(s => s.done && !s.wrong).length;
        let html = `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div><div class="pv-timer">00:00</div></div>`;
        html += `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:100%;"></div></div>`;
        html += `<div style="text-align:center;padding:30px 0;">`;
        html += `<h2 style="color:var(--success);margin:0 0 10px;">✓ Тест завершён</h2>`;
        html += `<div style="font-size:42px;font-weight:700;color:var(--text-strong);margin:15px 0 5px;">${score} / ${lesson.questions.length}</div>`;
        html += `<p style="color:var(--text-muted);font-size:14px;margin:0 0 20px;">правильно</p>`;
        html += `<button class="pv-nav-btn" onclick="pvRestart()">Пройти заново</button>`;
        html += `</div>`;
        html += `<div class="pv-mini-hint">Это предпросмотр. Прогресс не сохраняется.</div>`;
        return html;
    }

    const q = lesson.questions[idx];
    const st = pvState.qStates[idx];
    let html = "";
    if (q.type === "single" || q.type === "multi") html = renderPreviewChoice(lesson, q, st, idx);
    else if (q.type === "match") html = renderPreviewMatch(lesson, q, st, idx);
    else if (q.type === "card") html = renderPreviewCard(lesson, q, st, idx);
    html += `<div class="pv-mini-hint">Это предпросмотр. Прогресс не сохраняется.</div>`;
    return html;
}

function renderPreviewChoice(lesson, q, st, idx) {
    const correctArr = normalizeCorrect(q.correct);
    const isMulti = q.type === "multi";
    if (!st.selected) st.selected = [];

    let html = "";
    html += `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div><div class="pv-timer">00:00</div></div>`;
    html += `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:${(pvState.qStates.filter(s => s.done).length / lesson.questions.length) * 100}%"></div></div>`;
    html += `<div class="pv-question-text">Вопрос ${idx + 1} из ${lesson.questions.length}. ${q.text}</div>`;
    if (isMulti) html += `<div class="pv-quiz-hint">Выберите один или несколько правильных ответов</div>`;
    html += `<div class="pv-options">`;
    q.options.forEach((opt, i) => {
        const isCorrectOpt = correctArr.includes(opt);
        const wasSelected = st.selected.includes(i);
        let cls = "pv-opt";
        if (st.done) {
            if (isCorrectOpt) cls += " correct";
            else if (wasSelected) cls += " wrong";
        } else if (st.lastCheckWrong) {
            if (wasSelected && !isCorrectOpt) cls += " wrong";
            else if (wasSelected) cls += " selected";
        } else {
            if (wasSelected) cls += " selected";
        }
        const disabled = st.done ? " disabled" : "";
        const onclick = isMulti ? `onclick="pvToggleOption(${i})"` : `onclick="pvAnswer(${i})"`;
        html += `<button class="${cls}"${disabled} ${onclick}>${opt}</button>`;
    });
    html += `</div>`;
    if (q.explain) html += `<div class="pv-explain${st.done ? ' show' : ''}"><strong>💡 Почему так:</strong> ${q.explain}</div>`;
    html += `<div class="pv-nav-row">`;
    if (idx > 0) html += `<button class="pv-nav-btn" onclick="pvPrev()">← Назад</button>`;
    else html += `<div></div>`;
    if (isMulti) {
        if (st.done) {
            const isLast = idx === lesson.questions.length - 1;
            html += `<button class="pv-nav-btn primary" onclick="pvNext()">${isLast ? 'К результату →' : 'Дальше →'}</button>`;
        } else {
            const canCheck = st.selected.length > 0;
            html += `<button class="pv-nav-btn check" onclick="pvCheckMulti()" ${canCheck ? '' : 'disabled'}>Проверить</button>`;
        }
    } else {
        const isLast = idx === lesson.questions.length - 1;
        html += `<button class="pv-nav-btn primary" onclick="pvNext()" ${st.done ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
    }
    html += `</div>`;
    return html;
}

function renderPreviewMatch(lesson, q, st, idx) {
    const total = (q.pairs || []).length;
    const matchedCount = st.matchedPairs.length;
    const allMatched = matchedCount === total;
    const pendingLeft = st._pendingLeft;
    const pendingRight = st._pendingRight;

    let html = "";
    html += `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div><div class="pv-timer">00:00</div></div>`;
    html += `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:${(pvState.qStates.filter(s => s.done).length / lesson.questions.length) * 100}%"></div></div>`;
    html += `<div class="pv-question-text">${q.text || "Соедини пары"}</div>`;
    html += `<div class="pv-match-counter">Соединено: ${matchedCount} / ${total}</div>`;
    html += `<div class="pv-match-grid">`;
    html += `<div class="pv-match-col">`;
    (q.pairs || []).forEach((p, i) => {
        const isMatched = st.matchedPairs.includes(i);
        const isSelected = pendingLeft === i;
        let cls = "pv-match-item";
        if (isMatched) cls += " matched";
        else if (isSelected) cls += " selected";
        const onclick = isMatched ? "" : `onclick="pvMatchClickLeft(${i})"`;
        html += `<button class="${cls}" ${onclick}>${p.left}</button>`;
    });
    html += `</div>`;
    html += `<div class="pv-match-col">`;
    (q.pairs || []).forEach((p, i) => {
        const isMatched = st.matchedPairs.includes(i);
        const isSelected = pendingRight === i;
        let cls = "pv-match-item";
        if (isMatched) cls += " matched";
        else if (isSelected) cls += " selected";
        const onclick = isMatched ? "" : `onclick="pvMatchClickRight(${i})"`;
        html += `<button class="${cls}" ${onclick}>${p.right}</button>`;
    });
    html += `</div>`;
    html += `</div>`;
    if (allMatched && q.explain) {
        html += `<div class="pv-explain show"><strong>💡 Почему так:</strong> ${q.explain}</div>`;
    }
    html += `<div class="pv-nav-row">`;
    if (idx > 0) html += `<button class="pv-nav-btn" onclick="pvPrev()">← Назад</button>`;
    else html += `<div></div>`;
    const isLast = idx === lesson.questions.length - 1;
    html += `<button class="pv-nav-btn primary" onclick="pvNext()" ${allMatched ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
    html += `</div>`;
    return html;
}

function renderPreviewCard(lesson, q, st, idx) {
    const answered = st.userAnswer !== null && st.userAnswer !== undefined;
    let html = "";
    html += `<div class="pv-header"><div class="pv-lesson-title">${lesson.title}</div><div class="pv-timer">00:00</div></div>`;
    html += `<div class="pv-progress-bar"><div class="pv-progress-fill" style="width:${(pvState.qStates.filter(s => s.done).length / lesson.questions.length) * 100}%"></div></div>`;
    html += `<div class="pv-card-view">`;
    if (!answered) {
        html += `<div class="pv-card-face">`;
        if (q.frontImage) html += `<img class="pv-card-face-image" src="${q.frontImage}" alt="" onerror="this.style.display='none'">`;
        html += `<div class="pv-card-face-text">${q.front || ""}</div>`;
        html += `</div>`;
        html += `<div class="pv-card-buttons">`;
        html += `<button class="pv-card-btn dontknow" onclick="pvCardAnswer('dontknow')" title="Не знаю">✕</button>`;
        html += `<button class="pv-card-btn know" onclick="pvCardAnswer('know')" title="Знаю">✓</button>`;
        html += `</div>`;
    } else {
        html += `<div class="pv-card-answer-label">Ответ</div>`;
        html += `<div class="pv-card-face">`;
        if (q.backImage) html += `<img class="pv-card-face-image" src="${q.backImage}" alt="" onerror="this.style.display='none'">`;
        html += `<div class="pv-card-face-text">${q.back || ""}</div>`;
        html += `</div>`;
    }
    html += `</div>`;
    html += `<div class="pv-nav-row">`;
    if (idx > 0) html += `<button class="pv-nav-btn" onclick="pvPrev()">← Назад</button>`;
    else html += `<div></div>`;
    const isLast = idx === lesson.questions.length - 1;
    html += `<button class="pv-nav-btn primary" onclick="pvNext()" ${answered ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
    html += `</div>`;
    return html;
}

function pvAnswer(choiceIndex) {
    const lesson = currentLesson();
    const q = lesson.questions[pvState.questionIdx];
    const st = pvState.qStates[pvState.questionIdx];
    if (st.done) return;
    const correctArr = normalizeCorrect(q.correct);
    const choice = q.options[choiceIndex];
    if (correctArr.includes(choice)) { st.done = true; st.selected = [choiceIndex]; }
    else { st.wrong = true; st.selected = [choiceIndex]; }
    renderPreview();
}
function pvToggleOption(i) {
    const st = pvState.qStates[pvState.questionIdx];
    if (st.done) return;
    if (!st.selected) st.selected = [];
    const idx = st.selected.indexOf(i);
    if (idx === -1) st.selected.push(i);
    else st.selected.splice(idx, 1);
    st.lastCheckWrong = false;
    renderPreview();
}
function pvCheckMulti() {
    const lesson = currentLesson();
    const q = lesson.questions[pvState.questionIdx];
    const st = pvState.qStates[pvState.questionIdx];
    if (st.done) return;
    const correctArr = normalizeCorrect(q.correct);
    const selected = st.selected || [];
    if (selected.length === 0) return;
    const selectedOpts = selected.map(i => q.options[i]);
    const isCorrect = selectedOpts.length === correctArr.length && selectedOpts.every(o => correctArr.includes(o));
    if (isCorrect) { st.done = true; st.lastCheckWrong = false; }
    else { st.wrong = true; st.lastCheckWrong = true; }
    renderPreview();
}

function pvMatchClickLeft(pairIdx) {
    const st = pvState.qStates[pvState.questionIdx];
    if (st.matchedPairs.includes(pairIdx)) return;
    if (st._pendingLeft === pairIdx) { st._pendingLeft = null; renderPreview(); return; }
    st._pendingLeft = pairIdx;
    if (st._pendingRight !== null && st._pendingRight !== undefined) {
        const r = st._pendingRight;
        st._pendingLeft = null; st._pendingRight = null;
        pvCheckMatch(pairIdx, r);
        return;
    }
    renderPreview();
}
function pvMatchClickRight(pairIdx) {
    const st = pvState.qStates[pvState.questionIdx];
    if (st.matchedPairs.includes(pairIdx)) return;
    if (st._pendingRight === pairIdx) { st._pendingRight = null; renderPreview(); return; }
    st._pendingRight = pairIdx;
    if (st._pendingLeft !== null && st._pendingLeft !== undefined) {
        const l = st._pendingLeft;
        st._pendingLeft = null; st._pendingRight = null;
        pvCheckMatch(l, pairIdx);
        return;
    }
    renderPreview();
}
function pvCheckMatch(leftIdx, rightIdx) {
    const lesson = currentLesson();
    const q = lesson.questions[pvState.questionIdx];
    const st = pvState.qStates[pvState.questionIdx];
    if (leftIdx === rightIdx) {
        st.matchedPairs.push(leftIdx);
        st._pendingLeft = null;
        st._pendingRight = null;
        if (st.matchedPairs.length === (q.pairs || []).length) {
            st.done = true;
        }
        renderPreview();
    } else {
        st.hadError = true;
        st.wrong = true;
        st._pendingLeft = null;
        st._pendingRight = null;
        const items = document.querySelectorAll(".pv-match-item");
        const total = (q.pairs || []).length;
        const leftBtn = items[leftIdx];
        const rightBtn = items[total + rightIdx];
        if (leftBtn) leftBtn.classList.add("wrong-flash");
        if (rightBtn) rightBtn.classList.add("wrong-flash");
        setTimeout(() => {
            if (leftBtn) leftBtn.classList.remove("wrong-flash");
            if (rightBtn) rightBtn.classList.remove("wrong-flash");
            renderPreview();
        }, 800);
    }
}

function pvCardAnswer(answer) {
    const st = pvState.qStates[pvState.questionIdx];
    if (st.userAnswer !== null && st.userAnswer !== undefined) return;
    st.userAnswer = answer;
    st.done = true;
    if (answer === "dontknow") st.wrong = true;
    renderPreview();
}

function pvNext() { pvState.questionIdx++; renderPreview(); }
function pvPrev() { if (pvState.questionIdx > 0) { pvState.questionIdx--; renderPreview(); } }
function pvRestart() {
    const lesson = currentLesson();
    pvState.questionIdx = 0;
    pvState.qStates = lesson.questions.map(q => makePvQuestionState(q));
    renderPreview();
}

/* ============================================================
   СБОРКА data.js
   ============================================================ */
function buildDataJs() {
    readFromDom();
    const sJ = safeJsonStringify(courseSettings);
    const lJ = safeJsonStringify(allLessons);
    return "// ============================================================\n// ДАННЫЕ КУРСА\n// Редактируется через admin.html.\n// courseKey — уникальный ключ курса, не менять!\n// Типы блоков: lesson.type = \"theory\" | \"quiz\" | \"memo\" | \"glossary\".\n// Тип вопроса: q.type = \"single\" | \"multi\" | \"match\" | \"card\".\n// single/multi: { text, options, correct: [массив], explain, group }\n// match:        { text, pairs: [{left, right}], explain?, group }\n// card:         { front, frontImage, back, backImage, group }\n// memo:         { title, cells: [{ title, content: [...] }] }\n// glossary:     { title, terms: [{ name, content: [...] }] }\n// table:        { type: \"table\", header: bool, rows: [[...], [...]] }\n// ul:           { type: \"ul\", style: \"bullet\"|\"number\"|\"checkbox\", items: [{text, level}] }\n// randomizeQuestions / randomizeOptions — перемешивание.\n// Контент слайдов/ячеек/терминов: блоки p, h3, ul, quote, link, image, video, table.\n// В p/h3/quote допустимы <b>, <i>, <u>, <s> и style=\"text-align:...\".\n// В тексте можно использовать [[ключ_блока]] для внутренних ссылок.\n// ============================================================\n\n" +
           "const courseSettings = " + sJ + ";\n\n" +
           "const allLessons = " + lJ + ";\n";
}

async function saveToFile() {
    const content = buildDataJs();
    try {
        const res = await fetchWithTimeout("/save-data", {
            method: "POST",
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
            body: content
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || ("HTTP " + res.status));
        }
        localStorage.removeItem(DRAFT_KEY);
        setStatus("✓ data.js сохранён на сервере. Обнови страницу курса (F5).", "ok");
        return;
    } catch (e) {
        console.warn("Сервер недоступен:", e);
        setStatus(
            "⚠ Сервер не запущен или недоступен. Запусти server.js, или используй кнопку «📤 Скачать».",
            "err"
        );
        return;
    }
}
function downloadData() { downloadBlob("data.js", buildDataJs()); setStatus("📤 data.js скачан", "ok"); }
function downloadBlob(f, c) {
    const b = new Blob([c], { type: "text/javascript;charset=utf-8" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = f;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function reloadFromFile() {
    if (!confirm("Откатить к data.js? Несохранённые изменения потеряются.")) return;
    localStorage.removeItem(DRAFT_KEY); location.reload();
}
function setStatus(t, type) {
    const el = document.getElementById("status");
    el.textContent = t;
    el.className = "status" + (type ? " " + type : "");
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 6000);
}

/* ============================================================
   CSV ШАБЛОНЫ И ИМПОРТ В ТЕСТ
   ============================================================ */
const CSV_TEMPLATES = {
    "single_multi": {
        filename: "template_single_multi.csv",
        content: [
            "type;text;option1;option2;option3;option4;correct;explain;group",
            "single;Какой артикль перед cat?;A;An;The;-;A;Перед согласными — A;Артикли",
            "multi;Выберите гласные;A;E;F;G;A|E;A и E — гласные;Буквы",
            "single;Пример без объяснения;Да;Нет;;;Да;;"
        ].join("\r\n")
    },
    "match": {
        filename: "template_match.csv",
        content: [
            "text;pair1_left;pair1_right;pair2_left;pair2_right;pair3_left;pair3_right;pair4_left;pair4_right;pair5_left;pair5_right;explain;group",
            "Соедини слово и перевод;nature;природа;wool;шерсть;fault;вина;version;версия;create;создать;;Слова",
            "Меньше пар — ок;cat;кот;dog;собака;;;;;;;;;;Животные"
        ].join("\r\n")
    },
    "card": {
        filename: "template_card.csv",
        content: [
            "front;frontImage;back;backImage;group",
            "nature;images/nature.png;природа;;Слова",
            "wool;;шерсть;;Слова",
            "fault;;вина;;Слова"
        ].join("\r\n")
    }
};

function openCsvTemplates() {
    const body = document.getElementById("csv-modal-body");
    let html = `<h2>📄 Шаблоны CSV</h2>`;
    html += `<p class="csv-modal-desc">Скачай нужный шаблон, открой в Excel, заполни и сохрани в формате CSV (разделитель — точка с запятой).</p>`;
    html += `<div class="csv-samples">`;
    html += `<div class="csv-samples-title">Что в шаблоне</div>`;
    html += `<div class="csv-samples-item"><strong>single_multi</strong> — вопросы с одним или несколькими правильными ответами.</div>`;
    html += `<div class="csv-samples-item"><strong>match</strong> — вопросы на соответствие. До 5 пар.</div>`;
    html += `<div class="csv-samples-item"><strong>card</strong> — карточки для запоминания.</div>`;
    html += `</div>`;
    html += `<div class="csv-modal-actions">`;
    html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('single_multi')">📥 single/multi</button>`;
    html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('match')">📥 match</button>`;
    html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('card')">📥 card</button>`;
    html += `<button class="btn btn-text" onclick="closeCsvModal()">Закрыть</button>`;
    html += `</div>`;
    body.innerHTML = html;
    document.getElementById("csv-overlay").classList.add("show");
}

function downloadCsvTemplate(key) {
    const tpl = CSV_TEMPLATES[key];
    if (!tpl) return;
    const content = "\uFEFF" + tpl.content;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = tpl.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("📥 Шаблон скачан: " + tpl.filename, "ok");
}

function parseCsvLine(line, delim) {
    const cells = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i+1] === '"') { cur += '"'; i++; }
                else { inQuotes = false; }
            } else { cur += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === delim) { cells.push(cur); cur = ""; }
            else { cur += ch; }
        }
    }
    cells.push(cur);
    return cells;
}

function parseCsv(text) {
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split("\n");
    let delim = ";";
    for (const line of lines) {
        if (!line.trim()) continue;
        const semis = (line.match(/;/g) || []).length;
        const commas = (line.match(/,/g) || []).length;
        const tabs = (line.match(/\t/g) || []).length;
        if (tabs > semis && tabs > commas) delim = "\t";
        else if (commas > semis) delim = ",";
        else delim = ";";
        break;
    }
    const rows = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        rows.push(parseCsvLine(line, delim));
    }
    return { rows, delim };
}

function detectCsvKind(headers) {
    const h = headers.map(x => String(x || "").trim().toLowerCase());
    if (h.includes("front") && h.includes("back")) return "card";
    if (h.some(x => x.startsWith("pair1_"))) return "match";
    if (h.includes("type") && h.includes("correct")) return "single_multi";
    return null;
}

function buildSingleMultiQuestions(rows, headers) {
    const idx = {};
    headers.forEach((h, i) => { idx[String(h || "").trim().toLowerCase()] = i; });
    const questions = [];
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const lineNum = r + 1;
        const typeRaw = (row[idx["type"]] || "").trim().toLowerCase();
        const type = typeRaw === "multi" ? "multi" : (typeRaw === "single" ? "single" : null);
        if (!type) { errors.push("Строка " + lineNum + ": неизвестный тип «" + typeRaw + "»"); continue; }
        const text = (row[idx["text"]] || "").trim();
        if (!text) { errors.push("Строка " + lineNum + ": пустой текст вопроса"); continue; }
        const options = [];
        for (let k = 1; k <= 10; k++) {
            const colName = "option" + k;
            const ci = idx[colName];
            if (ci === undefined) continue;
            const val = (row[ci] || "").trim();
            if (val) options.push(val);
        }
        if (options.length < 2) { errors.push("Строка " + lineNum + ": меньше 2 вариантов"); continue; }
        const correctRaw = (row[idx["correct"]] || "").trim();
        if (!correctRaw) { errors.push("Строка " + lineNum + ": пустое поле correct"); continue; }
        const correctParts = correctRaw.split("|").map(s => s.trim()).filter(Boolean);
        const badOnes = correctParts.filter(c => !options.includes(c));
        if (badOnes.length) { errors.push("Строка " + lineNum + ": ответы «" + badOnes.join(", ") + "» не найдены"); continue; }
        if (type === "single" && correctParts.length !== 1) { errors.push("Строка " + lineNum + ": у single должен быть 1 ответ"); continue; }
        if (type === "multi" && correctParts.length < 1) { errors.push("Строка " + lineNum + ": у multi нужен хотя бы 1 ответ"); continue; }
        const explain = (row[idx["explain"]] || "").trim();
        const group = (row[idx["group"]] || "").trim() || null;
        questions.push({ type, text, options, correct: correctParts, explain, group });
    }
    return { questions, errors };
}

function buildMatchQuestions(rows, headers) {
    const idx = {};
    headers.forEach((h, i) => { idx[String(h || "").trim().toLowerCase()] = i; });
    const questions = [];
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const lineNum = r + 1;
        const text = (row[idx["text"]] || "").trim() || "Соедини пары";
        const pairs = [];
        for (let k = 1; k <= 10; k++) {
            const lCi = idx["pair" + k + "_left"];
            const rCi = idx["pair" + k + "_right"];
            if (lCi === undefined || rCi === undefined) continue;
            const left = (row[lCi] || "").trim();
            const right = (row[rCi] || "").trim();
            if (!left && !right) continue;
            if (!left || !right) { errors.push("Строка " + lineNum + ": пара " + k + " неполная"); continue; }
            pairs.push({ left, right });
        }
        if (pairs.length === 0) { errors.push("Строка " + lineNum + ": ни одной пары"); continue; }
        const explain = (row[idx["explain"]] || "").trim();
        const group = (row[idx["group"]] || "").trim() || null;
        questions.push({ type: "match", text, pairs, explain, group });
    }
    return { questions, errors };
}

function buildCardQuestions(rows, headers) {
    const idx = {};
    headers.forEach((h, i) => { idx[String(h || "").trim().toLowerCase()] = i; });
    const questions = [];
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const lineNum = r + 1;
        const front = (row[idx["front"]] || "").trim();
        const back = (row[idx["back"]] || "").trim();
        if (!front && !back) continue;
        if (!front) { errors.push("Строка " + lineNum + ": пустая front"); continue; }
        if (!back) { errors.push("Строка " + lineNum + ": пустая back"); continue; }
        const frontImage = (row[idx["frontimage"]] || "").trim();
        const backImage = (row[idx["backimage"]] || "").trim();
        const group = (row[idx["group"]] || "").trim() || null;
        questions.push({ type: "card", front, frontImage, back, backImage, group });
    }
    return { questions, errors };
}

let csvImportState = null;

function openCsvImport() {
    csvImportState = null;
    renderCsvImportStep1();
    document.getElementById("csv-overlay").classList.add("show");
}

function renderCsvImportStep1() {
    const body = document.getElementById("csv-modal-body");
    let html = `<h2>📥 Импорт вопросов из CSV</h2>`;
    html += `<p class="csv-modal-desc">Выбери тип вопросов в файле. Или нажми «Определить автоматически».</p>`;
    html += `<div class="csv-type-grid">`;
    html += `<button class="csv-type-card" onclick="csvPickType('single_multi')">`;
    html += `<div class="csv-type-icon">✏</div>`;
    html += `<div class="csv-type-title">Один / Несколько</div>`;
    html += `<div class="csv-type-desc">Вопросы с выбором</div>`;
    html += `</button>`;
    html += `<button class="csv-type-card" onclick="csvPickType('match')">`;
    html += `<div class="csv-type-icon">🔗</div>`;
    html += `<div class="csv-type-title">Соответствие</div>`;
    html += `<div class="csv-type-desc">Соединить пары</div>`;
    html += `</button>`;
    html += `<button class="csv-type-card" onclick="csvPickType('card')">`;
    html += `<div class="csv-type-icon">🎴</div>`;
    html += `<div class="csv-type-title">Карточки</div>`;
    html += `<div class="csv-type-desc">Передняя и задняя</div>`;
    html += `</button>`;
    html += `</div>`;
    html += `<div class="csv-modal-actions">`;
    html += `<button class="btn btn-outline" onclick="csvPickType('auto')">🔍 Определить автоматически</button>`;
    html += `<button class="btn btn-text" onclick="closeCsvModal()">Отмена</button>`;
    html += `</div>`;
    body.innerHTML = html;
}

function csvPickType(kind) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt,text/csv";
    input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let text = String(reader.result || "");
            if (/\uFFFD/.test(text.slice(0, 1000))) {
                const reader2 = new FileReader();
                reader2.onload = () => {
                    try {
                        let fixed = String(reader2.result || "");
                        processCsvText(fixed, kind, file.name);
                    } catch (e) {
                        processCsvText(text, kind, file.name);
                    }
                };
                reader2.readAsText(file, "windows-1251");
            } else {
                processCsvText(text, kind, file.name);
            }
        };
        reader.readAsText(file, "utf-8");
    };
    input.click();
}

function processCsvText(text, kind, fileName) {
    const parsed = parseCsv(text);
    const rows = parsed.rows;
    if (rows.length < 2) { renderCsvError("Файл пустой или только заголовок."); return; }
    const headers = rows[0];
    if (kind === "auto") {
        const detected = detectCsvKind(headers);
        if (!detected) { renderCsvError("Не удалось определить тип."); return; }
        kind = detected;
    }
    let result;
    let kindLabel;
    if (kind === "single_multi") { result = buildSingleMultiQuestions(rows, headers); kindLabel = "Один / Несколько"; }
    else if (kind === "match") { result = buildMatchQuestions(rows, headers); kindLabel = "Соответствие"; }
    else if (kind === "card") { result = buildCardQuestions(rows, headers); kindLabel = "Карточки"; }
    else { renderCsvError("Неизвестный тип: " + kind); return; }

    csvImportState = { kind, kindLabel, fileName, questions: result.questions, errors: result.errors };
    renderCsvImportStep2();
}

function renderCsvImportStep2() {
    const st = csvImportState;
    if (!st) return;
    const body = document.getElementById("csv-modal-body");
    const total = st.questions.length + st.errors.length;

    let html = `<h2>📥 Импорт: проверка</h2>`;
    html += `<p class="csv-modal-desc">Файл: <strong>${escapeHtml(st.fileName)}</strong> · Тип: ${escapeHtml(st.kindLabel)}</p>`;
    html += `<div class="csv-preview">`;
    html += `<div class="csv-preview-row"><span>Всего строк</span><strong>${total}</strong></div>`;
    html += `<div class="csv-preview-row"><span class="csv-preview-ok">✓ Валидных</span><strong class="csv-preview-ok">${st.questions.length}</strong></div>`;
    html += `<div class="csv-preview-row"><span class="csv-preview-err">✗ Ошибок</span><strong class="csv-preview-err">${st.errors.length}</strong></div>`;
    html += `</div>`;

    if (st.errors.length > 0) {
        html += `<div class="csv-error-list">`;
        html += `<div class="csv-error-title">Ошибки:</div>`;
        st.errors.forEach(e => { html += `<div class="csv-error-item">• ${escapeHtml(e)}</div>`; });
        html += `</div>`;
    }

    if (st.questions.length === 0) {
        html += `<div class="csv-preview" style="background:var(--error-bg);color:var(--error);">Ни одного валидного вопроса.</div>`;
        html += `<div class="csv-modal-actions">`;
        html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
        html += `<button class="btn btn-text" onclick="closeCsvModal()">Закрыть</button>`;
        html += `</div>`;
        body.innerHTML = html;
        return;
    }

    html += `<div class="csv-samples">`;
    html += `<div class="csv-samples-title">Превью (первые 3)</div>`;
    st.questions.slice(0, 3).forEach((q, i) => {
        let line = "";
        if (q.type === "single" || q.type === "multi") line = `<strong>${i+1}.</strong> [${q.type}] ${escapeHtml(q.text)}`;
        else if (q.type === "match") line = `<strong>${i+1}.</strong> [match] ${escapeHtml(q.pairs.map(p => p.left).join(", "))}`;
        else if (q.type === "card") line = `<strong>${i+1}.</strong> [card] ${escapeHtml(q.front)} → ${escapeHtml(q.back)}`;
        html += `<div class="csv-samples-item">${line}</div>`;
    });
    html += `</div>`;

    const lesson = currentLesson();
    const existing = (lesson.questions || []).length;
    html += `<p class="csv-modal-desc" style="margin-top:16px;">В текущем тесте <strong>${existing}</strong> вопрос(ов). Что сделать?</p>`;

    html += `<div class="csv-modal-actions">`;
    html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
    html += `<button class="btn btn-outline" onclick="csvApplyImport('replace')">Заменить все</button>`;
    html += `<button class="btn btn-primary" onclick="csvApplyImport('append')">Добавить к текущим</button>`;
    html += `</div>`;

    body.innerHTML = html;
}

function csvBackToStep1() {
    csvImportState = null;
    renderCsvImportStep1();
}

function csvApplyImport(mode) {
    if (!csvImportState) return;
    readFromDom();
    const lesson = currentLesson();
    if (!lesson || lesson.type !== "quiz") { renderCsvError("Импорт возможен только в тест."); return; }
    if (!lesson.questions) lesson.questions = [];

    if (!lesson.groups) lesson.groups = [];
    const existingGroups = new Set(lesson.groups);
    csvImportState.questions.forEach(q => {
        if (q.group && !existingGroups.has(q.group)) {
            lesson.groups.push(q.group);
            existingGroups.add(q.group);
        }
        if (q.group === undefined) q.group = null;
    });

    if (mode === "replace") lesson.questions = csvImportState.questions;
    else lesson.questions = lesson.questions.concat(csvImportState.questions);

    refreshAll();

    const cnt = csvImportState.questions.length;
    const errCnt = csvImportState.errors.length;
    setStatus("📥 Импортировано: " + cnt + (errCnt ? " (ошибок: " + errCnt + ")" : ""), "ok");
    csvImportState = null;
    closeCsvModal();
    saveDraft();
    autoSaveToServer();
}

function renderCsvError(msg) {
    const body = document.getElementById("csv-modal-body");
    let html = `<h2>Ошибка</h2>`;
    html += `<p class="csv-modal-desc">${escapeHtml(msg)}</p>`;
    html += `<div class="csv-modal-actions">`;
    html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
    html += `<button class="btn btn-primary" onclick="closeCsvModal()">Закрыть</button>`;
    html += `</div>`;
    body.innerHTML = html;
}

function closeCsvModal() {
    document.getElementById("csv-overlay").classList.remove("show");
    csvImportState = null;
}

function closeCsvIfOutside(event) {
    if (event.target.id === "csv-overlay") closeCsvModal();
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        if (document.getElementById("csv-overlay").classList.contains("show")) {
            closeCsvModal();
        }
        const ctx1 = document.getElementById("lesson-ctx-menu");
        if (ctx1) ctx1.remove();
        const ctx2 = document.getElementById("slide-ctx-menu");
        if (ctx2) ctx2.remove();
    }
    if (e.key === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const t = e.target;
        const inInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (inInput) return;
        e.preventDefault();
        if (currentLesson()) duplicateSlide();
    }
    if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        const t = e.target;
        if (t && t.isContentEditable) {
            e.preventDefault();
            insertWikiLinkAtCaret(t);
            onFieldChange();
        }
    }
});

/* ============================================================
   ПРИМЕЧАНИЯ В ТЕКСТЕ — список под блоком + модалка редактирования
   ============================================================ */

function isNoteUsedInText(block, noteIdx) {
    if (!block || !block.text) return false;
    const marker = "((" + (noteIdx + 1) + "))";
    return String(block.text).indexOf(marker) !== -1;
}

function createNotesListForBlock(block, blockIndex, context) {
    const notes = Array.isArray(block.notes) ? block.notes : [];
    if (notes.length === 0) return null;

    const wrap = document.createElement("div");
    wrap.className = "block-notes";

    const title = document.createElement("div");
    title.className = "block-notes-title";
    title.textContent = "💬 Примечания к блоку";
    wrap.appendChild(title);

    const list = document.createElement("div");
    list.className = "block-notes-list";

    notes.forEach((noteText, idx) => {
        const row = document.createElement("div");
        row.className = "block-notes-item";
        if (!isNoteUsedInText(block, idx)) row.classList.add("is-unused");

        const num = document.createElement("div");
        num.className = "block-notes-num";
        num.textContent = String(idx + 1);
        row.appendChild(num);

        const text = document.createElement("div");
        text.className = "block-notes-text";
        text.textContent = noteText;
        row.appendChild(text);

        if (!isNoteUsedInText(block, idx)) {
            const badge = document.createElement("span");
            badge.className = "block-notes-unused-badge";
            badge.textContent = "удалено из текста";
            row.appendChild(badge);
        }

        const actions = document.createElement("div");
        actions.className = "block-notes-actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "mini-icon-btn";
        editBtn.title = "Редактировать";
        editBtn.textContent = "✎";
        editBtn.onclick = (e) => {
            e.stopPropagation();
            const wrapper = list.closest(".block-wrapper") || editBtn.closest(".block-wrapper");
            const editable = wrapper ? wrapper.querySelector("p, h3, .quote-text") : null;
            if (!editable) return;
            openNoteEditModal(editable, blockIndex, context, idx);
        };
        actions.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "mini-icon-btn del";
        delBtn.title = "Удалить";
        delBtn.textContent = "✕";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (!confirm("Удалить примечание №" + (idx + 1) + "? Все ссылки ((N)) в тексте станут битыми.")) return;
            deleteNoteFromBlock(block, blockIndex, context, idx);
        };
        actions.appendChild(delBtn);

        row.appendChild(actions);
        list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
}

function refreshBlockAndNotes(block, blockIndex, context) {
    readEditableBlocks(
        context === "memo" ? "memo-content" :
        context === "glossary" ? "term-content" : "preview-content",
        context === "memo" ? currentLesson().cells[state.currentSlideIndex].content :
        context === "glossary" ? currentLesson().terms[state.currentSlideIndex].content :
        currentLesson().slides[state.currentSlideIndex].content
    );
    if (context === "memo") renderCell();
    else if (context === "glossary") renderTerm();
    else renderSlide();
    saveDraft();
    autoSaveToServer();
}

function deleteNoteFromBlock(block, blockIndex, context, idx) {
    if (!Array.isArray(block.notes)) return;
    block.notes.splice(idx, 1);
    refreshBlockAndNotes(block, blockIndex, context);
    setStatus("🗑 Примечание удалено", "ok");
}

function openNoteEditModal(editable, blockIndex, context, noteIdx) {
    const block = getBlockByContext(context, blockIndex);
    if (!block) return;
    if (!Array.isArray(block.notes)) block.notes = [];
    if (noteIdx < 0 || noteIdx >= block.notes.length) return;

    if (noteEditModalEl) noteEditModalEl.remove();

    const overlay = document.createElement("div");
    overlay.className = "note-modal-overlay";

    let listHtml = "";
    block.notes.forEach((t, i) => {
        const isCurrent = i === noteIdx;
        const used = isNoteUsedInText(block, i);
        const cls = "note-modal-list-item" + (isCurrent ? " is-current" : "") + (!used ? " is-unused" : "");
        listHtml += `<div class="${cls}" data-idx="${i}">` +
            `<span class="note-modal-list-num">${i + 1}</span>` +
            `<span class="note-modal-list-text">${escapeHtml(t)}</span>` +
            (!used ? `<span class="note-modal-list-badge">удалено</span>` : "") +
            `</div>`;
    });

    overlay.innerHTML = `
        <div class="note-modal note-modal-wide">
            <h3 class="note-modal-title">💬 Примечание №${noteIdx + 1}</h3>
            <p class="note-modal-hint">Текст примечания. Появится при наведении на маркер в тексте.</p>
            <textarea class="note-modal-textarea" placeholder="Введи текст примечания..."></textarea>
            <div class="note-modal-actions">
                <button type="button" class="btn btn-text" data-action="delete" style="color:var(--error);">🗑 Удалить</button>
                <button type="button" class="btn btn-text" data-action="cancel">Отмена</button>
                <button type="button" class="btn btn-primary" data-action="save">Сохранить</button>
            </div>
            <div class="note-modal-list-title">Все примечания этого блока:</div>
            <div class="note-modal-list">${listHtml}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    noteEditModalEl = overlay;

    const ta = overlay.querySelector(".note-modal-textarea");
    ta.value = block.notes[noteIdx] || "";
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    overlay.querySelectorAll(".note-modal-list-item").forEach(item => {
        item.onclick = () => {
            const i = parseInt(item.dataset.idx, 10);
            if (isNaN(i) || i === noteIdx) return;
            closeNoteEditModal();
            openNoteEditModal(editable, blockIndex, context, i);
        };
    });

    overlay.querySelector('[data-action="cancel"]').onclick = closeNoteEditModal;
    overlay.querySelector('[data-action="delete"]').onclick = () => {
        if (!confirm("Удалить примечание №" + (noteIdx + 1) + "?")) return;
        closeNoteEditModal();
        deleteNoteFromBlock(block, blockIndex, context, noteIdx);
    };
    overlay.querySelector('[data-action="save"]').onclick = () => {
        const text = ta.value.trim();
        if (!text) {
            setStatus("Примечание пустое.", "err");
            return;
        }
        block.notes[noteIdx] = text;
        closeNoteEditModal();
        refreshBlockAndNotes(block, blockIndex, context);
        setStatus("💬 Примечание обновлено", "ok");
    };
    overlay.addEventListener("mousedown", (e) => {
        if (e.target === overlay) closeNoteEditModal();
    });
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); closeNoteEditModal(); }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            overlay.querySelector('[data-action="save"]').click();
        }
    });
}

let noteEditModalEl = null;
function closeNoteEditModal() {
    if (noteEditModalEl) { noteEditModalEl.remove(); noteEditModalEl = null; }
}
/* ============================================================
   ОБЛОЖКА БЛОКА — превью и загрузка
   ============================================================ */

function renderLessonCoverPreview() {
    const input = document.getElementById("lesson-cover-input");
    const box = document.getElementById("lesson-cover-preview");
    if (!box || !input) return;
    const lesson = currentLesson();
    input.value = (lesson && lesson.coverImage) ? lesson.coverImage : "";
    updateLiveCoverPreview();
}

function setLessonCover(path) {
    const lesson = currentLesson();
    if (!lesson) return;
    lesson.coverImage = path || "";
    if (!lesson.coverImage) delete lesson.coverImage;
    const input = document.getElementById("lesson-cover-input");
    if (input) input.value = lesson.coverImage || "";
    renderLessonCoverPreview();
    saveDraft();
    autoSaveToServer();
}

(function setupLessonCoverUpload() {
    const btn = document.getElementById("lesson-cover-file-btn");
    const fileInput = document.getElementById("lesson-cover-file-input");
    if (!btn || !fileInput) return;

    btn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
        const f = fileInput.files && fileInput.files[0];
        if (f) uploadLessonCover(f);
        fileInput.value = "";
    });

    // Ctrl+V — вставить картинку из буфера, когда курсор в поле пути
    const srcInput = document.getElementById("lesson-cover-input");
    if (srcInput) {
        srcInput.addEventListener("paste", (e) => {
            const items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        const ext = file.type.split("/")[1] || "png";
                        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                        Object.defineProperty(file, "name", {
                            value: `cover_${ts}.${ext}`,
                            writable: false
                        });
                        uploadLessonCover(file);
                        return;
                    }
                }
            }
        });
    }
})();

function uploadLessonCover(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        setStatus("⚠ Это не картинка", "err");
        return;
    }

    const defaultName = file.name || "cover.png";
    let name = prompt("Имя файла (с расширением):", defaultName);
    if (!name) return;
    name = name.trim();
    if (!name) return;

    const m = location.pathname.match(/^\/([^\/]+)\/admin\.html$/);
    const course = m ? m[1] : COURSE_KEY;

    const progressWrap = document.getElementById("lesson-cover-progress");
    const progressFill = document.getElementById("lesson-cover-progress-fill");
    const progressText = document.getElementById("lesson-cover-progress-text");
    progressWrap.style.display = "block";
    progressFill.style.width = "0%";
    progressText.textContent = "Загрузка... 0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/upload?course=${encodeURIComponent(course)}&type=images&filename=${encodeURIComponent(name)}`);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = pct + "%";
            progressText.textContent = "Загрузка... " + pct + "%";
        }
    };

    xhr.onload = () => {
        progressWrap.style.display = "none";
        if (xhr.status === 200) {
            try {
                const data = JSON.parse(xhr.responseText);
                setLessonCover(data.path);
                setStatus("✓ Обложка загружена: " + data.path, "ok");
            } catch (e) {
                setStatus("⚠ Ответ сервера непонятен", "err");
            }
        } else {
            setStatus("⚠ Ошибка загрузки: " + xhr.status + " " + xhr.responseText, "err");
        }
    };

    xhr.onerror = () => {
        progressWrap.style.display = "none";
        setStatus("⚠ Сервер не запущен или недоступен. Запусти server.js.", "err");
    };

    xhr.send(file);
}
init();