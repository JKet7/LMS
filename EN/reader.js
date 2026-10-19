/* ============================================================
   READER.JS — логика курса (читатель + слой автора)
   Требует: data.js + shared.js.
   Состоит из трёх частей:
     1) Читатель — экраны, меню, слайды, тест, память, глоссарий.
     2) Автор — инструменты редактирования поверх.
     3) Модалки, сбор данных, сохранение.
   ============================================================ */

(function () {
    "use strict";

    /* ============================================================
       СОСТОЯНИЕ
       ============================================================ */

    const COURSE_KEY = (typeof courseSettings !== "undefined" && courseSettings && courseSettings.courseKey)
        ? String(courseSettings.courseKey).trim()
        : "default";

    const STORAGE_KEY = "kp_course_v1_" + COURSE_KEY;
    const DRAFT_KEY = "kp_course_draft_v1_" + COURSE_KEY;
    const PROGRESS_KEY = STORAGE_KEY;
    const MODE_KEY = "kp_app_mode";
    const THEME_KEY = "kp_course_theme";

    let currentLessonId = null;
    let currentSlide = 0;
    let slides = [];
    let lessonState = {};
    let quizTimerInterval = null;

    let glossaryState = { selectedTermIndex: 0, searchQuery: "" };

    let menuState = {
        query: "",
        previewId: null,
        selectedByTap: null
    };

    let navHistory = null;
    let backlinksIndex = null;

    let pvState = null;              // предпросмотр теста (используется в авторе)
    let currentMode = "reader";      // "reader" | "author"

    /* ============================================================
       КЭШ DOM
       ============================================================ */

    const $ = (id) => document.getElementById(id);

    const appContainer    = $("app-container");
    const menuList        = $("menu-list");
    const menuPreviewEl   = $("menu-preview");
    const menuSearchEl    = $("menu-search");
    const courseTitleEl   = $("course-title");
    const lessonTitleEl   = $("lesson-title");
    const quizTitleEl     = $("quiz-title");
    const progressFill    = $("progress-fill");
    const quizProgressFill = $("quiz-progress-fill");
    const slideContent    = $("slide-content");
    const topicList       = $("topic-list");
    const topicListTitle  = $("topic-list-title");
    const quizContent     = $("quiz-content");
    const quizNavGrid     = $("quiz-nav-grid");
    const quizTimerEl     = $("quiz-timer");
    const memoTitleEl     = $("memo-title");
    const memoGridEl      = $("memo-grid");
    const glossaryTitleEl = $("glossary-title");
    const glossaryListEl  = $("glossary-list");
    const glossaryContentEl = $("glossary-content");
    const glossarySearchEl  = $("glossary-search");
    const statusEl        = $("status");

    const READER_AVAILABLE = !!(appContainer && menuList && courseTitleEl && slideContent);

    /* ============================================================
       РЕЖИМ — читаем при загрузке, следим за переключением
       ============================================================ */

    function getMode() {
        const attr = document.documentElement.getAttribute("data-app-mode");
        return (attr === "author") ? "author" : "reader";
    }

    function setModeInternal(mode) {
        currentMode = mode;
        document.documentElement.setAttribute("data-app-mode", mode);
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
        updateTopicListTitle();
        // Перерисовать текущий экран — там появятся/исчезнут инструменты
        rerenderCurrentScreen();
    }

    function updateTopicListTitle() {
        if (!topicListTitle) return;
        const lesson = currentLesson();
        if (!lesson) return;
        if (lesson.type === "memo") {
            topicListTitle.textContent = (currentMode === "author") ? "Ячейки" : "Содержание";
        } else if (lesson.type === "glossary") {
            topicListTitle.textContent = (currentMode === "author") ? "Термины" : "Содержание";
        } else {
            topicListTitle.textContent = (currentMode === "author") ? "Слайды" : "Содержание";
        }
    }

    function rerenderCurrentScreen() {
        // Определяем активный экран и перерисовываем
        const activeScreen = document.querySelector(".screen.active");
        if (!activeScreen) return;
        const id = activeScreen.id;

        if (id === "screen-menu") {
            renderMenu();
        } else if (id === "screen-lesson") {
            if (currentLessonId) {
                slides = allLessons[currentLessonId].slides || [];
                renderSlide();
            }
        } else if (id === "screen-quiz") {
            if (currentLessonId) renderQuiz();
        } else if (id === "screen-memo") {
            if (currentLessonId) renderMemo(allLessons[currentLessonId]);
        } else if (id === "screen-glossary") {
            if (currentLessonId) renderGlossary(allLessons[currentLessonId]);
        }
    }

    /* ============================================================
       НАСТРОЙКИ СТРАНИЦЫ
       ============================================================ */

    if (typeof courseSettings !== "undefined") {
        if (courseSettings.pageTitle) document.title = courseSettings.pageTitle;
        if (courseTitleEl && courseSettings.courseTitle) {
            courseTitleEl.textContent = courseSettings.courseTitle;
        }
        const topbarTitleEl = $("topbar-title");
        if (topbarTitleEl && courseSettings.courseTitle) {
            topbarTitleEl.textContent = courseSettings.courseTitle;
        }
    }

    /* ============================================================
       ЭКРАНЫ
       ============================================================ */

    function showScreen(name) {
        document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
        const screen = $("screen-" + name);
        if (screen) screen.classList.add("active");
        if (appContainer) {
            appContainer.classList.remove("wide", "narrow");
            if (name === "memo") appContainer.classList.add("wide");
            else if (name === "quiz") appContainer.classList.add("narrow");
        }
        updateBackButton();
    }
    window.showScreen = showScreen;

    function updateBackButton() {
        const show = navHistory !== null;
        ["back-btn-lesson", "back-btn-quiz", "back-btn-memo", "back-btn-glossary"].forEach(id => {
            const el = $(id);
            if (el) el.style.display = show ? "inline-flex" : "none";
        });
    }

    /* ============================================================
       ПРОГРЕСС УЧЕНИКА
       ============================================================ */

    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            lessonState = raw ? JSON.parse(raw) : {};
        } catch (e) { lessonState = {}; }
    }
    function saveAll() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lessonState)); } catch (e) {}
    }
    function getState(id) {
        if (!lessonState[id]) lessonState[id] = { currentSlide: 0, visited: [], completed: false };
        if (!lessonState[id].visited) lessonState[id].visited = [];
        return lessonState[id];
    }
    function getQuizState(id) {
        if (!lessonState[id]) lessonState[id] = { currentQuestion: 0, questionState: [], score: 0, timerSeconds: 0, completed: false };
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

    /* ============================================================
       МЕНЮ КУРСА
       ============================================================ */

    function getMenuCountLabel(lesson) {
        if (lesson.type === "quiz") {
            const n = (lesson.questions || []).length;
            return `${n} ${pluralizeQuestions(n)}`;
        }
        if (lesson.type === "memo") {
            const n = (lesson.cells || []).length;
            return `${n} ${pluralizeCells(n)}`;
        }
        if (lesson.type === "glossary") {
            const n = (lesson.terms || []).length;
            return `${n} ${pluralizeTerms(n)}`;
        }
        const n = (lesson.slides || []).length;
        return `${n} ${pluralizeSlides(n)}`;
    }

    function getMenuTypeLabel(lesson) {
        return getLessonTypeLabel(lesson.type);
    }

    function isLessonStarted(lesson) {
        const state = lessonState[lesson.__id] || {};
        if (lesson.type === "quiz") {
            return (state.questionState || []).some(q => q && q.done);
        }
        if (lesson.type === "memo" || lesson.type === "glossary") return false;
        return (state.visited || []).length > 0;
    }

    function renderMenu() {
        if (!READER_AVAILABLE) return;
        loadAll();

        // Заголовок курса
        if (courseTitleEl) {
            courseTitleEl.textContent = courseSettings.courseTitle || "Курс";
        }

        const q = String(menuState.query || "").trim().toLowerCase();
        const ids = Object.keys(allLessons);
        const filtered = ids.filter(id => {
            if (!q) return true;
            const lesson = allLessons[id];
            const title = String(lesson.title || "").toLowerCase();
            return title.includes(q) || id.toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            menuList.innerHTML = `<div class="menu-empty">Ничего не найдено</div>`;
            renderMenuPreview(null);
            return;
        }

        let html = "";
        filtered.forEach(id => {
            const lesson = allLessons[id];
            lesson.__id = id;

            const started = isLessonStarted(lesson);
            const typeLabel = getMenuTypeLabel(lesson);
            const badgeClass = lesson.type === "quiz" ? "quiz"
                : lesson.type === "memo" ? "memo"
                : lesson.type === "glossary" ? "glossary"
                : "theory";
            const countLabel = getMenuCountLabel(lesson);

            const isStaticOpen = (lesson.type === "memo" || lesson.type === "glossary");
            let actionHtml;
            if (isStaticOpen) {
                actionHtml = `<button class="btn btn-primary menu-row-btn" data-action="open" data-id="${escapeAttr(id)}">Открыть</button>`;
            } else if (started) {
                actionHtml  = `<button class="btn btn-primary menu-row-btn" data-action="continue" data-id="${escapeAttr(id)}">Продолжить</button>`;
                actionHtml += `<button class="btn btn-text menu-row-btn menu-row-btn-reset" data-action="reset" data-id="${escapeAttr(id)}" title="Начать сначала">Сначала</button>`;
            } else {
                actionHtml = `<button class="btn btn-primary menu-row-btn" data-action="start" data-id="${escapeAttr(id)}">Начать</button>`;
            }

            const isCurrent = menuState.previewId === id;

            // Меню ⋮ блока — только в авторе
            let moreHtml = "";
            if (currentMode === "author") {
                moreHtml = `<div class="dropdown-wrap author-only">
                    <button class="btn-icon" data-action="lesson-menu" data-id="${escapeAttr(id)}" title="Действия">⋮</button>
                </div>`;
            }

            html += `<div class="menu-row${isCurrent ? " is-current" : ""}" data-id="${escapeAttr(id)}" tabindex="0">`;
            html += `<div class="menu-row-main">`;
            html += `<div class="menu-row-title" data-editable="lesson-title" data-id="${escapeAttr(id)}">${escapeHtml(lesson.title)}</div>`;
            html += `<div class="menu-row-meta">`;
            html += `<span class="menu-type-badge ${badgeClass}">${typeLabel}</span>`;
            html += `<span class="menu-row-count">${countLabel}</span>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="menu-row-actions">${moreHtml}${actionHtml}</div>`;
            html += `</div>`;
        });

        menuList.innerHTML = html;

        // Обработчики
        menuList.querySelectorAll(".menu-row").forEach(row => {
            const id = row.dataset.id;

            row.addEventListener("mouseenter", () => {
                menuState.previewId = id;
                updateCurrentRowHighlight();
                renderMenuPreview(id);
            });

            row.addEventListener("focus", () => {
                menuState.previewId = id;
                updateCurrentRowHighlight();
                renderMenuPreview(id);
            });

            row.addEventListener("click", (e) => {
                if (e.target.closest(".menu-row-btn")) return;
                if (e.target.closest("[data-action='lesson-menu']")) return;
                if (e.target.closest("[data-editable]") && currentMode === "author") return;
                handleMenuRowActivate(id, row);
            });

            row.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    if (e.target.closest("[data-editable]") && currentMode === "author") return;
                    e.preventDefault();
                    handleMenuRowActivate(id, row);
                }
            });

            row.querySelectorAll(".menu-row-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    const lessonId = btn.dataset.id;
                    if (action === "reset") {
                        resetBlock(lessonId);
                    }
                    openLessonById(lessonId);
                });
            });

            // Кнопка ⋮ у блока — только в авторе
            const menuBtn = row.querySelector("[data-action='lesson-menu']");
            if (menuBtn) {
                menuBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openLessonContextMenu(e, id);
                });
            }

            // Inline-редактирование названия в авторе
            const titleEl = row.querySelector("[data-editable='lesson-title']");
            if (titleEl && currentMode === "author") {
                titleEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    startInlineEditLessonTitle(titleEl, id);
                });
            }
        });

        // Preview
        if (menuState.previewId && allLessons[menuState.previewId]) {
            renderMenuPreview(menuState.previewId);
        } else {
            renderMenuPreview(null);
        }
    }
    window.renderMenu = renderMenu;

    function updateCurrentRowHighlight() {
        if (!menuList) return;
        menuList.querySelectorAll(".menu-row").forEach(r => {
            r.classList.toggle("is-current", r.dataset.id === menuState.previewId);
        });
    }

    function handleMenuRowActivate(id, row) {
        const isTouch = isTouchDevice() || window.innerWidth < 900;

        if (isTouch) {
            if (menuState.selectedByTap === id) {
                openLessonById(id);
            } else {
                menuState.selectedByTap = id;
                menuState.previewId = id;
                updateCurrentRowHighlight();
                renderMenuPreview(id);
            }
        } else {
            openLessonById(id);
        }
    }

    function openLessonById(id) {
        const lesson = allLessons[id];
        if (!lesson) return;
        if (lesson.type === "quiz") startQuiz(id);
        else if (lesson.type === "memo") openMemo(id);
        else if (lesson.type === "glossary") openGlossary(id);
        else {
            const state = getState(id);
            if ((state.visited || []).length > 0) continueLesson(id);
            else startLesson(id);
        }
    }
    window.openLessonById = openLessonById;

    function onMenuSearch() {
        if (!menuSearchEl) return;
        menuState.query = menuSearchEl.value || "";
        menuState.previewId = null;
        menuState.selectedByTap = null;
        renderMenu();
        renderMenuPreview(null);
    }
    window.onMenuSearch = onMenuSearch;

    function renderMenuPreview(id) {
        if (!menuPreviewEl) return;

        if (!id || !allLessons[id]) {
            menuPreviewEl.className = "menu-preview is-empty";
            menuPreviewEl.style.backgroundImage = "";
            menuPreviewEl.innerHTML = `<div class="menu-preview-placeholder">Наведи на блок</div>`;
            return;
        }

        const lesson = allLessons[id];
        const typeLabel = getMenuTypeLabel(lesson);
        const countLabel = getMenuCountLabel(lesson);
        const badgeClass = lesson.type === "quiz" ? "quiz"
            : lesson.type === "memo" ? "memo"
            : lesson.type === "glossary" ? "glossary"
            : "theory";

        const description = String(lesson.description || "").trim();
        const cover = String(lesson.coverImage || "").trim();

        let inner = `<div class="menu-preview-inner">`;
        inner += `<div class="menu-preview-badge menu-type-badge ${badgeClass}">${typeLabel}</div>`;
        inner += `<h2 class="menu-preview-title">${escapeHtml(lesson.title || "")}</h2>`;
        if (description) {
            inner += `<div class="menu-preview-desc">${escapeHtml(description)}</div>`;
        }
        inner += `<div class="menu-preview-count">${countLabel}</div>`;
        inner += `</div>`;

        // Кнопка "✎" в авторе
        if (currentMode === "author") {
            inner += `<button class="menu-preview-edit author-only" onclick="openPreviewEditor('${escapeAttr(id)}')" title="Изменить описание и обложку">✎</button>`;
        }

        menuPreviewEl.className = "menu-preview";
        if (cover) {
            menuPreviewEl.style.backgroundImage = `url("${cover.replace(/"/g, '\\"')}")`;
            menuPreviewEl.classList.add("has-cover");
        } else {
            menuPreviewEl.style.backgroundImage = "";
            menuPreviewEl.classList.remove("has-cover");
        }
        menuPreviewEl.innerHTML = inner;
    }
    window.renderMenuPreview = renderMenuPreview;

    /* ============================================================
       ТЕОРИЯ — открытие, навигация, рендер (в читателе)
       ============================================================ */

    function resetBlock(id) {
        delete lessonState[id];
        saveAll();
        renderMenu();
    }
    window.resetBlock = resetBlock;

    function startLesson(id) {
        const lesson = allLessons[id];
        if (!lesson) return;
        currentLessonId = id;
        slides = lesson.slides || [];
        currentSlide = 0;
        lessonTitleEl.textContent = lesson.title;
        showScreen("lesson");
        markVisited(0);
        renderSlide();
    }
    window.startLesson = startLesson;

    function continueLesson(id) {
        const lesson = allLessons[id];
        if (!lesson) return;
        const state = getState(id);
        currentLessonId = id;
        slides = lesson.slides || [];
        currentSlide = state.currentSlide || 0;
        lessonTitleEl.textContent = lesson.title;
        showScreen("lesson");
        markVisited(currentSlide);
        renderSlide();
    }
    window.continueLesson = continueLesson;

    function exitToMenu() {
        stopQuizTimer();
        if (currentLessonId) {
            const lesson = allLessons[currentLessonId];
            if (lesson && lesson.type === "quiz") saveAll();
            else if (lesson && lesson.type === "theory") {
                const s = getState(currentLessonId);
                s.currentSlide = currentSlide;
                saveAll();
            }
        }
        navHistory = null;
        currentLessonId = null;
        showScreen("menu");
        renderMenu();
    }
    window.exitToMenu = exitToMenu;

    function markVisited(i) {
        const s = getState(currentLessonId);
        if (!s.visited.includes(i)) s.visited.push(i);
        s.currentSlide = i;
        saveAll();
    }

    function updateProgressBar() {
        if (!progressFill) return;
        if (!slides.length) { progressFill.style.width = "0%"; return; }
        const s = getState(currentLessonId);
        progressFill.style.width = (s.visited.length / slides.length) * 100 + "%";
    }

    function renderTopicList() {
        if (!topicList) return;
        const lesson = currentLesson();
        if (!lesson) return;
        if (lesson.type !== "theory") return;

        const s = getState(currentLessonId);

        let html = "";
        slides.forEach((slide, i) => {
            let cls = "topic-item";
            if (i === currentSlide) cls += " current";
            else if (s.visited.includes(i)) cls += " visited";

            if (currentMode === "author") {
                html += `<div class="topic-item-wrap">`;
                html += `<button class="${cls}" onclick="goToSlide(${i})">${escapeHtml(slide.shortName || slide.title || "")}</button>`;
                html += `<button class="topic-item-edit-btn" data-slide-idx="${i}" title="Изменить имя в меню">✎</button>`;
                html += `<button class="topic-item-menu-btn" data-slide-idx="${i}" title="Действия">⋮</button>`;
                html += `</div>`;
            } else {
                html += `<button class="${cls}" onclick="goToSlide(${i})">${escapeHtml(slide.shortName || "")}</button>`;
            }
        });
        topicList.innerHTML = html;

        if (currentMode === "author") {
            topicList.querySelectorAll(".topic-item-edit-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.slideIdx, 10);
                    const slide = slides[idx];
                    if (!slide) return;
                    
                    const newName = prompt("Короткое имя для меню (shortName):", slide.shortName || slide.title || "");
                    if (newName !== null) {
                        slide.shortName = newName.trim() || slide.title || "Без названия";
                        scheduleSave();
                        renderTopicList();
                    }
                });
            });
            topicList.querySelectorAll(".topic-item-menu-btn").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.slideIdx, 10);
                    openSlideContextMenu(e, idx);
                });
            });
            const addBtn = document.createElement("div");
            addBtn.className = "add-slide-row author-only";
            addBtn.innerHTML = `<button class="btn btn-outline btn-sm" onclick="addSlide()">＋ Слайд</button>`;
            topicList.appendChild(addBtn);
        }
    }

    function goToSlide(i) {
        currentSlide = i;
        markVisited(i);
        renderSlide();
    }
    window.goToSlide = goToSlide;

    function renderSlide() {
        if (!slideContent) return;
        const lesson = currentLesson();
        if (!lesson) return;
        const slide = slides[currentSlide];

        if (!slide) {
            // Пустой блок — в авторе предложить создать слайд
            let html = `<div class="slide-empty">`;
            if (currentMode === "author") {
                html += `<p style="color:var(--text-muted);margin-bottom:16px;">В этом блоке пока нет слайдов.</p>`;
                html += `<button class="btn btn-primary" onclick="addSlide()">＋ Добавить слайд</button>`;
            } else {
                html += `<p style="color:var(--text-muted);">Слайд не найден.</p>`;
            }
            html += `</div>`;
            slideContent.innerHTML = html;
            renderTopicList();
            updateProgressBar();
            return;
        }

        const isLast = currentSlide === slides.length - 1;

        let html = "";

        // Шапка слайда
        html += `<div class="slide-header-row">`;
        html += `<h2 class="slide-title" data-editable="slide-title" data-idx="${currentSlide}">${escapeHtml(slide.title || "")}</h2>`;
        html += `</div>`;

        // Контент слайда — рендер блоков (в авторе — с инструментами)
        html += `<div class="slide-content" id="slide-content-blocks">`;
        html += renderSlideBlocks(slide.content, "slide");
        html += `</div>`;

        // Кнопки "＋ Абзац / ..." внизу в авторе
        if (currentMode === "author") {
            html += `<div class="slide-add-row author-only">`;
            html += `<button class="btn btn-outline" onclick="addBlock('p')">＋ Абзац</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('h3')">＋ Подзаголовок</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('ul')">＋ Список</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('quote')">＋ Выделение</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('link')">＋ Ссылка</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('image')">＋ 🖼 Картинка</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('video')">＋ 🎬 Видео</button>`;
            html += `<button class="btn btn-outline" onclick="addBlock('table')">＋ 📊 Таблица</button>`;
            html += `</div>`;
        }

        // Навигация
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

        // Error handlers для медиа
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

        // Обработчики инструментов автора
        if (currentMode === "author") {
            attachAuthorHandlers(slideContent, slide, "slide");
            // Inline-редактирование заголовка слайда
            const slideTitleEl = slideContent.querySelector("[data-editable='slide-title']");
            if (slideTitleEl) {
                slideTitleEl.addEventListener("click", () => startInlineEditSlideTitle(slideTitleEl, currentSlide));
            }
        }

        renderTopicList();
        updateProgressBar();
    }
    window.renderSlide = renderSlide;
        /* ============================================================
       НАВИГАЦИЯ ВПЕРЁД / НАЗАД
       ============================================================ */

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
        currentLessonId = h.lessonId;
        slides = lesson.slides || [];
        currentSlide = (h.slideIndex >= 0 && h.slideIndex < slides.length) ? h.slideIndex : 0;
        lessonTitleEl.textContent = lesson.title;
        showScreen("lesson");
        markVisited(currentSlide);
        renderSlide();
        updateBackButton();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.goBack = goBack;

    function goNext() {
        if (currentSlide < slides.length - 1) {
            currentSlide++;
            markVisited(currentSlide);
            renderSlide();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
    function goPrev() {
        if (currentSlide > 0) {
            currentSlide--;
            markVisited(currentSlide);
            renderSlide();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
    window.goNext = goNext;
    window.goPrev = goPrev;

    function finishLesson() {
        const s = getState(currentLessonId);
        s.completed = true;
        s.currentSlide = currentSlide;
        saveAll();
        showScreen("menu");
        currentLessonId = null;
        renderMenu();
    }
    window.finishLesson = finishLesson;

    function finishLessonSilent() {
        const s = getState(currentLessonId);
        s.completed = true;
        s.currentSlide = currentSlide;
        saveAll();
    }

    function goToNextLesson() {
        finishLessonSilent();
        const nextId = getNextLessonId(currentLessonId);
        if (!nextId) { showScreen("menu"); currentLessonId = null; renderMenu(); return; }

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
            slides = lesson.slides || [];
            lessonTitleEl.textContent = lesson.title;
            showScreen("lesson");
            markVisited(0);
            renderSlide();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.goToNextLesson = goToNextLesson;

    /* ============================================================
       ВНУТРЕННИЕ ССЫЛКИ (wiki)
       ============================================================ */

    function goToInternalLink(idOrHref, slideIdx) {
        let lessonId, slideNum;

        if (typeof idOrHref === "string" && idOrHref.startsWith("#")) {
            const raw = idOrHref.slice(1);
            const parts = raw.split(":");
            lessonId = parts[0];
            slideNum = parts[1] ? parseInt(parts[1]) - 1 : 0;
        } else {
            lessonId = idOrHref;
            slideNum = slideIdx || 0;
        }

        const lesson = allLessons[lessonId];
        if (!lesson) { alert("Блок не найден: " + lessonId); return; }

        saveNavHistory();

        if (lesson.type === "quiz") { startQuiz(lessonId); return; }
        if (lesson.type === "memo") { openMemo(lessonId); return; }
        if (lesson.type === "glossary") { openGlossary(lessonId); return; }

        if (currentLessonId) {
            const cur = allLessons[currentLessonId];
            if (cur && cur.type === "theory") {
                const s = getState(currentLessonId);
                s.currentSlide = currentSlide;
                saveAll();
            }
        }
        currentLessonId = lessonId;
        slides = lesson.slides || [];
        lessonTitleEl.textContent = lesson.title;
        showScreen("lesson");
        currentSlide = (slideNum >= 0 && slideNum < slides.length) ? slideNum : 0;
        markVisited(currentSlide);
        renderSlide();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.goToInternalLink = goToInternalLink;

    /* ============================================================
       ПАМЯТКА
       ============================================================ */

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
    window.openMemo = openMemo;

    function goToMemoCell(i) {
        currentSlide = i;
        const lesson = currentLesson();
        if (lesson) renderMemo(lesson);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.goToMemoCell = goToMemoCell;

function renderMemo(lesson) {
    if (!memoGridEl) return;
    const cells = lesson.cells || [];
    const count = cells.length;
    const cols = getMemoCols(count);
    memoGridEl.className = "memo-grid cols-" + cols;

    const oldNav = memoGridEl.parentNode.querySelector(".memo-nav-row");
    if (oldNav) oldNav.remove();
    const oldBacklinks = memoGridEl.parentNode.querySelector(".backlinks-block");
    if (oldBacklinks) oldBacklinks.remove();

    let html = "";
    cells.forEach((cell, i) => {
        html += `<div class="memo-cell" data-cell-idx="${i}">`;
        if (currentMode === "author") {
            html += `<div class="memo-cell-header-edit">`;
            html += `<input type="text" class="memo-cell-title-input" data-cell-idx="${i}" value="${escapeAttr(cell.title || "")}" placeholder="Заголовок ячейки">`;
            html += `<button class="cell-menu-btn" title="Действия" data-memo-menu-idx="${i}">⋮</button>`;
            html += `</div>`;
            html += `<div class="memo-cell-body">`;
            html += renderSlideBlocks(cell.content, "memo", i);
            html += `</div>`;
        } else {
            if (cell.title) {
                html += `<div class="memo-cell-header">${escapeHtml(cell.title)}</div>`;
            }
            html += `<div class="memo-cell-body">`;
            html += renderContentBlocks(cell.content);
            html += `</div>`;
        }
        html += `</div>`;
    });

    if (currentMode === "author") {
        html += `<div class="memo-add-cell-wrap author-only" style="grid-column:1/-1;text-align:center;padding:16px;">`;
        html += `<button class="btn btn-outline" onclick="addMemoCell()">＋ Добавить ячейку</button>`;
        html += `</div>`;
    }

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

    if (currentMode === "author") {
        // Обработчики блоков контента
        memoGridEl.querySelectorAll("[data-cell-idx]").forEach(cellEl => {
            if (cellEl.classList.contains("memo-cell")) {
                const cellIdx = parseInt(cellEl.dataset.cellIdx, 10);
                const cell = cells[cellIdx];
                if (cell) attachAuthorHandlers(cellEl, cell, "memo", cellIdx);
            }
        });

        // Изменение заголовка ячейки
        memoGridEl.querySelectorAll(".memo-cell-title-input").forEach(inp => {
            inp.addEventListener("input", () => {
                const idx = parseInt(inp.dataset.cellIdx, 10);
                if (cells[idx]) {
                    cells[idx].title = inp.value;
                    scheduleSave();
                }
            });
        });

        // Меню ⋮ ячейки
        memoGridEl.querySelectorAll("[data-memo-menu-idx]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.memoMenuIdx, 10);
                openMemoCellContextMenu(e, idx);
            });
        });
    }

    let navHtml = `<div class="memo-nav-row">`;
    const nextId = getNextLessonId(currentLessonId);
    if (nextId) {
        navHtml += `<button class="btn btn-outline" onclick="exitToMenu()">Завершить блок</button>`;
        navHtml += `<button class="btn btn-primary" onclick="goToNextLesson()">${escapeHtml(allLessons[nextId].title || "далее")} →</button>`;
    } else {
        navHtml += `<button class="btn btn-primary" onclick="exitToMenu()">← В меню</button>`;
    }
    navHtml += `</div>`;
    memoGridEl.insertAdjacentHTML("afterend", navHtml);

    renderTopicList();
}

    /* ============================================================
       ГЛОССАРИЙ
       ============================================================ */

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
    window.openGlossary = openGlossary;

    function renderGlossary(lesson) {
        renderGlossaryList(lesson);
        renderGlossaryTerm(lesson);
        renderTopicList();
    }

    function renderGlossaryList(lesson) {
        if (!glossaryListEl) return;
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
        if (!glossaryContentEl) return;
        const term = (lesson.terms || [])[glossaryState.selectedTermIndex];
        if (!term) {
            glossaryContentEl.innerHTML = `<p style="color:var(--text-muted);">Термин не выбран.</p>`;
            return;
        }

        const query = String(glossaryState.searchQuery || "").trim().toLowerCase();
        const name = String(term.name || "").trim() || "(без названия)";

        let html = "";

        if (currentMode === "author") {
            if (currentMode === "author") {
    html += `<div class="term-name-edit-row">`;
    html += `<input type="text" class="term-name-input glossary-term-title" data-term-idx="${glossaryState.selectedTermIndex}" value="${escapeAttr(term.name || "")}" placeholder="Название термина">`;
    html += `<button class="cell-menu-btn" title="Действия" data-term-menu-idx="${glossaryState.selectedTermIndex}">⋮</button>`;
    html += `</div>`;
}
        } else {
            html += `<h2 class="glossary-term-title">${highlightMatch(name, query)}</h2>`;
        }

        html += `<div class="slide-content" id="term-content-blocks">`;
        if (currentMode === "author") {
            html += renderSlideBlocks(term.content, "glossary", glossaryState.selectedTermIndex);
        } else {
            html += renderContentBlocks(term.content);
        }
        html += `</div>`;

        if (currentMode === "author") {
            html += `<div class="slide-add-row author-only">`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('p')">＋ Абзац</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('h3')">＋ Подзаголовок</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('ul')">＋ Список</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('quote')">＋ Выделение</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('link')">＋ Ссылка</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('image')">＋ 🖼 Картинка</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('video')">＋ 🎬 Видео</button>`;
            html += `<button class="btn btn-outline" onclick="addTermBlock('table')">＋ 📊 Таблица</button>`;
            html += `</div>`;
        }

        html += `<div class="glossary-nav-row">`;
        const nextId = getNextLessonId(currentLessonId);
        if (nextId) {
            html += `<button class="btn btn-outline" onclick="exitToMenu()">Завершить блок</button>`;
            html += `<button class="btn btn-primary" onclick="goToNextLesson()">${escapeHtml(allLessons[nextId].title || "далее")} →</button>`;
        } else {
            html += `<button class="btn btn-primary" onclick="exitToMenu()">← В меню</button>`;
        }
        html += `</div>`;

        glossaryContentEl.innerHTML = html;

        // Error handlers
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

        if (currentMode === "author") {
            // Меню ⋮ термина
            glossaryContentEl.querySelectorAll("[data-term-menu-idx]").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.dataset.termMenuIdx, 10);
                    openTermContextMenu(e, idx);
                });
            });
            // Заголовок термина
            const nameInput = glossaryContentEl.querySelector(".term-name-input");
            if (nameInput) {
                nameInput.addEventListener("input", () => {
                    const idx = parseInt(nameInput.dataset.termIdx, 10);
                    if (lesson.terms[idx]) {
                        lesson.terms[idx].name = nameInput.value;
                        scheduleSave();
                    }
                });
            }
            // Инструменты автора
            attachAuthorHandlers(glossaryContentEl, term, "glossary", glossaryState.selectedTermIndex);
        }
    }

    function onGlossarySearch() {
        glossaryState.searchQuery = glossarySearchEl ? glossarySearchEl.value : "";
        const lesson = allLessons[currentLessonId];
        if (lesson) renderGlossaryList(lesson);
    }
    window.onGlossarySearch = onGlossarySearch;

    function glossarySelect(origIndex) {
        glossaryState.selectedTermIndex = origIndex;
        const lesson = allLessons[currentLessonId];
        if (lesson) renderGlossary(lesson);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.glossarySelect = glossarySelect;

    /* ============================================================
       ТЕСТ — состояние, рендер, ответы
       ============================================================ */

    function startQuiz(id) {
        const lesson = allLessons[id];
        if (!lesson || !lesson.questions) return;
        currentLessonId = id;
        const qs = getQuizState(id);

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

        let needOptOrder = !qs._optionsOrder || qs._optionsOrder.length !== lesson.questions.length;
        if (!needOptOrder) {
            for (let i = 0; i < lesson.questions.length; i++) {
                const q = lesson.questions[i];
                const order = qs._optionsOrder[i];
                if (q.type === "single" || q.type === "multi") {
                    const optCount = (q.options || []).length;
                    if (!order || !Array.isArray(order) || order.length !== optCount) {
                        needOptOrder = true; break;
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
                        needMatchOrder = true; break;
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
    window.startQuiz = startQuiz;

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
    function stopQuizTimer() {
        if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
    }
    function updateQuizTimerDisplay() {
        if (quizTimerEl) {
            quizTimerEl.textContent = formatTime(getQuizState(currentLessonId).timerSeconds || 0);
        }
    }

    function renderQuiz() {
        const lesson = allLessons[currentLessonId];
        if (!lesson) return;
        const qs = getQuizState(currentLessonId);
        const done = qs.questionState.filter(q => q && q.done).length;
        if (quizProgressFill) {
            quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
        }

        if (qs.currentQuestion >= lesson.questions.length) {
            renderQuizResult(lesson, qs);
            renderQuizNavGrid();
            return;
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
    window.renderQuiz = renderQuiz;

    function renderChoiceQuestion(lesson, q, state, origIdx, qs) {
        const correctArr = normalizeCorrect(q.correct);
        const isMulti = q.type === "multi";
        const optOrder = qs._optionsOrder[origIdx] || (q.options || []).map((_, i) => i);

        let html = "";
        html += `<div class="quiz-question-text">${renderSafeText(q.text || "")}</div>`;
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
            html += `<button class="${cls}"${disabled} ${onclick}>${renderSafeText(opt)}</button>`;
        });
        html += `</div>`;

        if (q.explain) {
            html += `<div class="quiz-explain${state.done ? ' show' : ''}"><strong>💡 Почему так:</strong> ${renderSafeText(q.explain)}</div>`;
        }

        html += `<div class="quiz-nav-row">`;
        if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
        else html += `<div></div>`;

        if (isMulti) {
            if (state.done) {
                const isLast = qs.currentQuestion === lesson.questions.length - 1;
                html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()">${isLast ? 'К результату →' : 'Дальше →'}</button>`;
            } else {
                const canCheck = state.selected.length > 0;
                html += `<button class="quiz-nav-btn check" onclick="quizCheckMulti()" ${canCheck ? '' : 'disabled'}>Проверить</button>`;
            }
        } else {
            const isLast = qs.currentQuestion === lesson.questions.length - 1;
            html += `<button class="quiz-nav-btn primary" id="quiz-next-btn" onclick="quizGoNext()" ${state.done ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
        }
        html += `</div>`;
        return html;
    }

    function renderMatchQuestion(lesson, q, state, origIdx, qs) {
        let order = qs._matchOrder[origIdx];
        const total = (q.pairs || []).length;

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
        html += `<div class="quiz-question-text">${renderSafeText(q.text || "Соедини пары")}</div>`;
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
            html += `<button class="${cls}" ${onclick}>${renderSafeText(q.pairs[pairIdx].left || "")}</button>`;
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
            html += `<button class="${cls}" ${onclick}>${renderSafeText(q.pairs[pairIdx].right || "")}</button>`;
        });
        html += `</div>`;
        html += `</div>`;

        if (allMatched && q.explain) {
            html += `<div class="quiz-explain show"><strong>💡 Почему так:</strong> ${renderSafeText(q.explain)}</div>`;
        }

        html += `<div class="quiz-nav-row">`;
        if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
        else html += `<div></div>`;
        const isLast = qs.currentQuestion === lesson.questions.length - 1;
        html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()" ${allMatched ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
        html += `</div>`;

        return html;
    }

    function renderCardQuestion(lesson, q, state, origIdx, qs) {
        const answered = state.userAnswer !== null && state.userAnswer !== undefined;

        let html = "";
        html += `<div class="card-view">`;

        if (!answered) {
            html += `<div class="card-face">`;
            if (q.frontImage) html += `<img class="card-face-image" src="${escapeAttr(q.frontImage)}" alt="" onerror="this.style.display='none'">`;
            html += `<div class="card-face-text">${renderSafeText(q.front || "")}</div>`;
            html += `</div>`;
            html += `<div class="card-buttons">`;
            html += `<button class="card-btn dontknow" onclick="cardAnswer('dontknow')" title="Не знаю">✕</button>`;
            html += `<button class="card-btn know" onclick="cardAnswer('know')" title="Знаю">✓</button>`;
            html += `</div>`;
        } else {
            html += `<div class="card-answer-label">Ответ</div>`;
            html += `<div class="card-face">`;
            if (q.backImage) html += `<img class="card-face-image" src="${escapeAttr(q.backImage)}" alt="" onerror="this.style.display='none'">`;
            html += `<div class="card-face-text">${renderSafeText(q.back || "")}</div>`;
            html += `</div>`;
        }

        html += `</div>`;

        html += `<div class="quiz-nav-row">`;
        if (qs.currentQuestion > 0) html += `<button class="quiz-nav-btn" onclick="quizGoPrev()">← Назад</button>`;
        else html += `<div></div>`;
        const isLast = qs.currentQuestion === lesson.questions.length - 1;
        html += `<button class="quiz-nav-btn primary" onclick="quizGoNext()" ${answered ? '' : 'disabled'}>${isLast ? 'К результату →' : 'Дальше →'}</button>`;
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
    window.matchClickLeft = matchClickLeft;

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
    window.matchClickRight = matchClickRight;

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
                if (!state.hadError) qs.score++;
            }
            saveAll();
            renderQuizNavGrid();
            renderQuiz();
            const done = qs.questionState.filter(s => s && s.done).length;
            if (quizProgressFill) quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
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
        if (quizProgressFill) quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
    }
    window.cardAnswer = cardAnswer;

    function renderQuizNavGrid() {
        if (!quizNavGrid) return;
        const lesson = allLessons[currentLessonId];
        if (!lesson) return;
        const qs = getQuizState(currentLessonId);
        let html = "";
        (qs._questionsOrder || []).forEach((origIdx, displayIdx) => {
            const st = qs.questionState[origIdx] || { done: false, wrong: false };
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
            if (buttons[choiceIndex]) buttons[choiceIndex].classList.add("correct");
            const expEl = document.querySelector(".quiz-explain");
            if (expEl) expEl.classList.add("show");
            const nextBtn = $("quiz-next-btn");
            if (nextBtn) nextBtn.disabled = false;
        } else {
            state.wrong = true;
            state.selected = [choiceIndex];
            if (buttons[choiceIndex]) {
                buttons[choiceIndex].classList.add("wrong");
                buttons[choiceIndex].disabled = true;
            }
        }
        saveAll();
        renderQuizNavGrid();
        const done = qs.questionState.filter(s => s && s.done).length;
        if (quizProgressFill) quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
    }
    window.quizAnswer = quizAnswer;

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
    window.quizToggleOption = quizToggleOption;

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
        if (quizProgressFill) quizProgressFill.style.width = (done / lesson.questions.length) * 100 + "%";
    }
    window.quizCheckMulti = quizCheckMulti;

    function quizGoNext() {
        const lesson = allLessons[currentLessonId];
        const qs = getQuizState(currentLessonId);
        if (qs.currentQuestion < lesson.questions.length) {
            qs.currentQuestion++;
            saveAll();
            renderQuiz();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
    function quizGoPrev() {
        const qs = getQuizState(currentLessonId);
        if (qs.currentQuestion > 0) {
            qs.currentQuestion--;
            saveAll();
            renderQuiz();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }
    function quizGoTo(i) {
        const qs = getQuizState(currentLessonId);
        qs.currentQuestion = i;
        saveAll();
        renderQuiz();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.quizGoNext = quizGoNext;
    window.quizGoPrev = quizGoPrev;
    window.quizGoTo = quizGoTo;

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
        stopQuizTimer();
        qs.completed = true;
        saveAll();
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
            html += `<button class="btn btn-primary" onclick="goToNextLesson()">${escapeHtml(allLessons[nextId].title || "далее")} →</button>`;
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
                const safeDisplayName = escapeHtml(displayName);
                let color = "var(--success)";
                if (pct < 50) color = "var(--error)";
                else if (pct < 80) color = "var(--primary)";

                html += `<div class="group-row" id="group-row-${gi}">`;
                html += `<div class="group-row-head" onclick="toggleGroupRow(${gi})">`;
                html += `<div class="group-row-name"><span class="group-row-arrow">▶</span> ${safeDisplayName}</div>`;
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
            html += `<div class="group-q-text">${renderSafeText(q.text || "")} <span class="group-q-status ${isCorrect ? 'ok' : 'fail'}">${isCorrect ? '✓ верно' : '✗ неверно'}</span></div>`;
        } else if (q.type === "match") {
            html += `<div class="group-q-text">${renderSafeText(q.text || "Соответствие")} <span class="group-q-status ${isCorrect ? 'ok' : 'fail'}">${isCorrect ? '✓ верно' : '✗ неверно'}</span></div>`;
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

                html += `<div class="${cls}">${prefix} ${renderSafeText(opt)}</div>`;
            });
            html += `</div>`;
            if (q.explain) html += `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);font-style:italic;line-height:1.5;">💡 ${renderSafeText(q.explain)}</div>`;
        } else if (q.type === "match") {
            html += `<div class="group-match-pairs">`;
            (q.pairs || []).forEach(p => {
                html += `<div class="group-match-pair correct-answer">${renderSafeText(p.left || "")} → ${renderSafeText(p.right || "")}</div>`;
            });
            html += `</div>`;
            if (q.explain) html += `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);font-style:italic;line-height:1.5;">💡 ${renderSafeText(q.explain)}</div>`;
        } else if (q.type === "card") {
            html += `<div class="group-card-view">`;
            html += `<div class="group-card-side">`;
            html += `<div class="group-card-side-label">Передняя сторона</div>`;
            html += `<div>${renderSafeText(q.front || "")}</div>`;
            if (q.frontImage) html += `<img src="${escapeAttr(q.frontImage)}" alt="" onerror="this.style.display='none'">`;
            html += `</div>`;
            html += `<div class="group-card-side">`;
            html += `<div class="group-card-side-label">Задняя сторона</div>`;
            html += `<div>${renderSafeText(q.back || "")}</div>`;
            if (q.backImage) html += `<img src="${escapeAttr(q.backImage)}" alt="" onerror="this.style.display='none'">`;
            html += `</div>`;
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

    function toggleGroupRow(gi) {
        const row = $("group-row-" + gi);
        if (row) row.classList.toggle("expanded");
    }
    window.toggleGroupRow = toggleGroupRow;

    function quizRestart() {
        const lesson = allLessons[currentLessonId];
        if (!lesson) return;
        const qs = getQuizState(currentLessonId);
        qs.currentQuestion = 0;
        qs.score = 0;
        qs.timerSeconds = 0;
        qs.completed = false;
        qs.questionState = lesson.questions.map(q => makeFreshQuestionState(q));
        qs._questionsOrder = null;
        qs._optionsOrder = null;
        qs._matchOrder = null;
        saveAll();
        stopQuizTimer();
        startQuizTimer();

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
    window.quizRestart = quizRestart;

    /* ============================================================
       BACKLINKS
       ============================================================ */

    function buildBacklinksIndex() {
        backlinksIndex = {};
        for (const fromId in allLessons) {
            const lesson = allLessons[fromId];

            const processBlock = (blocks, slideIdx, slideType) => {
                (blocks || []).forEach(b => {
                    const texts = [];
                    if (b.type === "p" || b.type === "h3" || b.type === "quote") {
                        texts.push(b.text || "");
                    } else if (b.type === "ul") {
                        (b.items || []).forEach(item => {
                            const t = (typeof item === "string") ? item : (item.text || "");
                            if (t) texts.push(t);
                        });
                    } else if (b.type === "link") {
                        texts.push(b.text || "");
                    }

                    texts.forEach(text => {
                        const matches = String(text).matchAll(/\[\[([^\[\]]+?)\]\]/g);
                        for (const m of matches) {
                            let key = m[1];
                            const pipeIdx = key.indexOf("|");
                            if (pipeIdx !== -1) key = key.slice(0, pipeIdx);
                            const colonIdx = key.lastIndexOf(":");
                            if (colonIdx !== -1) key = key.slice(0, colonIdx);
                            key = key.trim();
                            if (!key || !allLessons[key]) continue;
                            if (!backlinksIndex[key]) backlinksIndex[key] = [];
                            const exists = backlinksIndex[key].some(
                                r => r.from === fromId && r.fromSlide === slideIdx
                            );
                            if (!exists) {
                                backlinksIndex[key].push({
                                    from: fromId,
                                    fromSlide: slideIdx,
                                    slideType: slideType
                                });
                            }
                        }
                    });
                });
            };

            if (lesson.type === "theory" && lesson.slides) {
                lesson.slides.forEach((s, i) => processBlock(s.content, i, "slide"));
            } else if (lesson.type === "memo" && lesson.cells) {
                lesson.cells.forEach((c, i) => processBlock(c.content, i, "cell"));
            } else if (lesson.type === "glossary" && lesson.terms) {
                lesson.terms.forEach((t, i) => processBlock(t.content, i, "term"));
            }
        }
    }

    function ensureBacklinksIndex() {
        if (!backlinksIndex) buildBacklinksIndex();
    }

    function renderBacklinks(targetLessonId) {
        ensureBacklinksIndex();
        const links = backlinksIndex[targetLessonId] || [];
        if (links.length === 0) return "";

        let html = `<div class="backlinks-block">`;
        html += `<div class="backlinks-title">↩ Упоминается в</div>`;
        html += `<ul class="backlinks-list">`;

        links.forEach(link => {
            const fromLesson = allLessons[link.from];
            if (!fromLesson) return;

            const typeClass = "wiki-link-" + fromLesson.type;
            let slideLabel = "";
            if (link.fromSlide > 0 || link.slideType) {
                if (fromLesson.type === "theory" && fromLesson.slides && fromLesson.slides[link.fromSlide]) {
                    const s = fromLesson.slides[link.fromSlide];
                    const sName = s.shortName || s.title || "";
                    if (sName) slideLabel = " → " + sName;
                } else if (fromLesson.type === "memo" && fromLesson.cells && fromLesson.cells[link.fromSlide]) {
                    const c = fromLesson.cells[link.fromSlide];
                    if (c.title) slideLabel = " → " + c.title;
                } else if (fromLesson.type === "glossary" && fromLesson.terms && fromLesson.terms[link.fromSlide]) {
                    const t = fromLesson.terms[link.fromSlide];
                    if (t.name) slideLabel = " → " + t.name;
                }
            }

            const onclick = `goToInternalLink('${escapeAttr(link.from)}', ${link.fromSlide})`;
            html += `<li><a href="javascript:void(0)" class="wiki-link ${typeClass}" onclick="${onclick}">${escapeHtml(fromLesson.title)}${escapeHtml(slideLabel)}</a></li>`;
        });

        html += `</ul></div>`;
        return html;
    }

    /* ============================================================
       СПРАВКА
       ============================================================ */

    function collectNotesForBlock(blocks) {
        const textNotes = [];
        const imageMarkers = [];

        (blocks || []).forEach((b) => {
            if (b.type === "p" || b.type === "h3" || b.type === "quote") {
                const notes = Array.isArray(b.notes) ? b.notes : [];
                if (notes.length > 0) {
                    const text = String(b.text || "");
                    notes.forEach((noteText, idx) => {
                        const marker = "((" + (idx + 1) + "))";
                        if (text.indexOf(marker) !== -1) {
                            textNotes.push({ num: idx + 1, text: noteText, where: "текст" });
                        }
                    });
                }
            }
            if (b.type === "image" && Array.isArray(b.markers)) {
                b.markers.forEach((m, idx) => {
                    imageMarkers.push({ num: idx + 1, text: m.text || "", where: b.src || "(картинка)" });
                });
            }
        });

        return { textNotes, imageMarkers };
    }

    function buildHelpContent() {
        const lesson = allLessons[currentLessonId];
        if (!lesson) return null;

        const lessonTypeLabel = {
            theory: "Теория", quiz: "Тест", memo: "Памятка", glossary: "Глоссарий"
        }[lesson.type] || lesson.type;

        let slideTitle = "";
        let editedAt = "";
        let blocks = [];

        if (lesson.type === "theory") {
            const slide = lesson.slides && lesson.slides[currentSlide];
            if (slide) {
                slideTitle = slide.title || slide.shortName || "(без названия)";
                editedAt = slide._editedAt || "";
                blocks = slide.content || [];
            }
        } else if (lesson.type === "memo") {
            const cell = lesson.cells && lesson.cells[currentSlide];
            if (cell) {
                slideTitle = cell.title || "(без названия)";
                editedAt = cell._editedAt || "";
                blocks = cell.content || [];
            }
        } else if (lesson.type === "glossary") {
            const term = lesson.terms && lesson.terms[glossaryState.selectedTermIndex];
            if (term) {
                slideTitle = term.name || "(без названия)";
                editedAt = term._editedAt || "";
                blocks = term.content || [];
            }
        } else if (lesson.type === "quiz") {
            slideTitle = lesson.title || "(без названия)";
            editedAt = "";
            blocks = [];
        }

        const { textNotes, imageMarkers } = collectNotesForBlock(blocks);
        const backlinksHtml = renderBacklinks(currentLessonId);

        return {
            lessonTitle: lesson.title,
            lessonType: lessonTypeLabel,
            slideTitle,
            editedAt,
            backlinksHtml,
            textNotes,
            imageMarkers
        };
    }

    function renderHelpBody() {
        const data = buildHelpContent();
        if (!data) return "<p>Нет данных для справки.</p>";

        let html = "";
        html += `<h2 class="help-title">Справка</h2>`;

        html += `<div class="help-section">`;
        html += `<div class="help-row"><span class="help-label">Блок:</span> <span class="help-value">${escapeHtml(data.lessonTitle)}</span></div>`;
        html += `<div class="help-row"><span class="help-label">Тип:</span> <span class="help-value">${escapeHtml(data.lessonType)}</span></div>`;
        if (data.slideTitle) {
            html += `<div class="help-row"><span class="help-label">Слайд:</span> <span class="help-value">${escapeHtml(data.slideTitle)}</span></div>`;
        }
        html += `<div class="help-row"><span class="help-label">Дата изменения:</span> <span class="help-value">${escapeHtml(formatDateTime(data.editedAt))}</span></div>`;
        html += `</div>`;

        if (data.backlinksHtml) {
            html += `<div class="help-section">`;
            html += `<div class="help-section-title">Упоминается в</div>`;
            html += data.backlinksHtml;
            html += `</div>`;
        }

        html += `<div class="help-section">`;
        html += `<div class="help-section-title">Сноски</div>`;

        if (data.textNotes.length === 0 && data.imageMarkers.length === 0) {
            html += `<div class="help-empty">Сносок нет.</div>`;
        } else {
            if (data.textNotes.length > 0) {
                html += `<div class="help-subsection-title">В тексте</div>`;
                html += `<ul class="help-notes-list">`;
                data.textNotes.forEach(n => {
                    html += `<li><span class="help-note-num">${n.num}</span> <span class="help-note-text">${escapeHtml(n.text)}</span></li>`;
                });
                html += `</ul>`;
            }
            if (data.imageMarkers.length > 0) {
                html += `<div class="help-subsection-title">На картинках</div>`;
                html += `<ul class="help-notes-list">`;
                data.imageMarkers.forEach(m => {
                    html += `<li><span class="help-note-num">${m.num}</span> <span class="help-note-text">${escapeHtml(m.text)}</span> <span class="help-note-where">(${escapeHtml(m.where)})</span></li>`;
                });
                html += `</ul>`;
            }
        }
        html += `</div>`;
        return html;
    }

    function openHelp() {
        const body = $("help-body");
        const overlay = $("help-overlay");
        if (!body || !overlay) return;
        body.innerHTML = renderHelpBody();
        overlay.classList.add("show");
        document.body.style.overflow = "hidden";
    }
    function closeHelp() {
        const overlay = $("help-overlay");
        if (!overlay) return;
        overlay.classList.remove("show");
        document.body.style.overflow = "";
    }
    function closeHelpIfOutside(event) {
        if (event.target.id === "help-overlay") closeHelp();
    }
    window.openHelp = openHelp;
    window.closeHelp = closeHelp;
    window.closeHelpIfOutside = closeHelpIfOutside;
        /* ============================================================
       ПРИМЕЧАНИЯ / МАРКЕРЫ — карточки и модалки (клик по .note)
       ============================================================ */

    let noteCardEl = null;
    let noteHideTimer = null;

    function showNoteCard(spanEl) {
        const text = spanEl.dataset.noteText || "";
        hideNoteCard();
        const card = document.createElement("div");
        card.className = "note-card";
        card.textContent = text;
        document.body.appendChild(card);
        noteCardEl = card;
        card._forEl = spanEl;
        positionCardNear(card, spanEl);
        requestAnimationFrame(() => card.classList.add("show"));
    }

    function hideNoteCard() {
        if (noteHideTimer) { clearTimeout(noteHideTimer); noteHideTimer = null; }
        if (noteCardEl) { noteCardEl.remove(); noteCardEl = null; }
    }

    function positionCardNear(card, anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        let top = rect.bottom + scrollY + 6;
        let left = rect.left + scrollX;
        if (left + cardRect.width + 16 > window.innerWidth + scrollX) {
            left = window.innerWidth + scrollX - cardRect.width - 16;
        }
        if (left < scrollX + 8) left = scrollX + 8;
        if (rect.bottom + cardRect.height + 16 > window.innerHeight) {
            top = rect.top + scrollY - cardRect.height - 6;
        }
        card.style.top = top + "px";
        card.style.left = left + "px";
    }

    document.addEventListener("mouseover", (e) => {
        const span = e.target.closest && e.target.closest(".note");
        if (!span) return;
        if (noteHideTimer) { clearTimeout(noteHideTimer); noteHideTimer = null; }
        if (noteCardEl && noteCardEl._forEl === span) return;
        showNoteCard(span);
    });

    document.addEventListener("mouseout", (e) => {
        const span = e.target.closest && e.target.closest(".note");
        if (!span) return;
        const related = e.relatedTarget;
        if (related && related.closest && related.closest(".note") === span) return;
        if (related && related.closest && related.closest(".note-card")) return;
        noteHideTimer = setTimeout(hideNoteCard, 150);
    });

    document.addEventListener("click", (e) => {
        const noteSpan = e.target.closest && e.target.closest(".note");
        if (noteSpan) {
            if (noteCardEl && noteCardEl._forEl === noteSpan) hideNoteCard();
            else showNoteCard(noteSpan);
            return;
        }
        const marker = e.target.closest && e.target.closest(".img-marker");
        if (marker) {
            const wrap = marker.closest(".img-with-markers");
            if (!wrap) return;
            const idx = parseInt(marker.dataset.markerIdx, 10);
            if (isNaN(idx)) return;
            const noteText = findMarkerText(idx, wrap);
            if (!noteText) return;
            if (isTouchDevice() || window.innerWidth < 700) {
                showMarkerModal(noteText);
            } else {
                showMarkerCard(marker, noteText);
            }
            return;
        }
        if (noteCardEl && !(e.target.closest && e.target.closest(".note-card"))) {
            hideNoteCard();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { hideNoteCard(); hideMarkerModal(); }
    });

    window.addEventListener("scroll", hideNoteCard, { passive: true });
    window.addEventListener("resize", hideNoteCard);

    function showMarkerCard(anchorEl, text) {
        hideNoteCard();
        hideMarkerModal();
        const card = document.createElement("div");
        card.className = "note-card";
        card.textContent = text;
        document.body.appendChild(card);
        noteCardEl = card;
        card._forEl = anchorEl;
        positionCardNear(card, anchorEl);
        requestAnimationFrame(() => card.classList.add("show"));
    }

       function findMarkerText(idx, wrapEl) {
        // Находим все маркеры внутри этой обертки
        const markers = wrapEl.querySelectorAll(".img-marker");
        const marker = markers[idx];
        
        // Если нашли маркер, берем текст из его атрибута title
        if (marker && marker.title) {
            return marker.title;
        }
        
        // Запасной вариант: старый способ поиска через data.js
        const container = wrapEl.closest(".slide-content, .memo-cell-body, .pv-slide-content");
        if (!container) return "";
        const wraps = Array.from(container.querySelectorAll(".img-with-markers"));
        const blockOrderInContainer = wraps.indexOf(wrapEl);

        const blocks = getBlocksForContainer(container);
        if (!Array.isArray(blocks)) return "";

        let imageBlockIdx = -1;
        let counter = -1;
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b && b.type === "image" && Array.isArray(b.markers) && b.markers.length > 0) {
                counter++;
                if (counter === blockOrderInContainer) {
                    imageBlockIdx = i;
                    break;
                }
            }
        }
        if (imageBlockIdx === -1) return "";
        const imgBlock = blocks[imageBlockIdx];
        const m = imgBlock.markers[idx];
        return m && m.text ? m.text : "";
    }

    function getBlocksForContainer(container) {
        if (!currentLessonId) return null;
        const lesson = allLessons[currentLessonId];
        if (!lesson) return null;

        if (container.classList.contains("memo-cell-body")) {
            const cell = container.closest(".memo-cell");
            if (!cell) return null;
            const allCells = Array.from(document.querySelectorAll(".memo-cell"));
            const cellIdx = allCells.indexOf(cell);
            if (cellIdx === -1) return null;
            const c = lesson.cells && lesson.cells[cellIdx];
            return c ? c.content : null;
        }

        if (container.classList.contains("pv-slide-content")) return null;

        if (lesson.type === "theory") {
            const slide = lesson.slides && lesson.slides[currentSlide];
            return slide ? slide.content : null;
        }

        if (lesson.type === "glossary") {
            const term = lesson.terms && lesson.terms[glossaryState.selectedTermIndex];
            return term ? term.content : null;
        }

        return null;
    }

    let markerModalEl = null;

    function showMarkerModal(text) {
        hideMarkerModal();
        const overlay = document.createElement("div");
        overlay.className = "img-marker-modal-overlay";
        overlay.innerHTML = `
            <div class="img-marker-modal">
                <h3 class="img-marker-modal-title">🎯 Примечание</h3>
                <div class="img-marker-modal-body">${escapeHtml(text)}</div>
                <div class="img-marker-modal-actions">
                    <button type="button" class="btn btn-primary" data-action="close">Понятно</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        markerModalEl = overlay;
        overlay.querySelector('[data-action="close"]').onclick = hideMarkerModal;
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) hideMarkerModal();
        });
    }

    function hideMarkerModal() {
        if (markerModalEl) { markerModalEl.remove(); markerModalEl = null; }
    }

    /* ============================================================
       ЛАЙТБОКС
       ============================================================ */

    let lightboxEl = null;

    function openLightbox(src) {
        if (lightboxEl) return;
        const overlay = document.createElement("div");
        overlay.className = "lightbox-overlay";
        overlay.innerHTML = `
            <button type="button" class="lightbox-close" aria-label="Закрыть">✕</button>
            <img src="${escapeAttr(src)}" alt="">
        `;
        document.body.appendChild(overlay);
        lightboxEl = overlay;
        document.body.style.overflow = "hidden";
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.classList.contains("lightbox-close") || e.target.tagName === "IMG") {
                if (e.target.tagName === "IMG" && e.target !== overlay.querySelector("img")) return;
                closeLightbox();
            }
        });
    }

    function closeLightbox() {
        if (lightboxEl) { lightboxEl.remove(); lightboxEl = null; }
        document.body.style.overflow = "";
    }

    document.addEventListener("dblclick", (e) => {
        const img = e.target.closest && e.target.closest('img[data-lightbox="1"]');
        if (!img) return;
        e.preventDefault();
        openLightbox(img.src);
    });

    let lastTapTime = 0;
    let lastTapTarget = null;
    document.addEventListener("touchend", (e) => {
        const img = e.target.closest && e.target.closest('img[data-lightbox="1"]');
        if (!img) return;
        const now = Date.now();
        if (now - lastTapTime < 350 && lastTapTarget === img) {
            e.preventDefault();
            openLightbox(img.src);
            lastTapTime = 0;
            lastTapTarget = null;
        } else {
            lastTapTime = now;
            lastTapTarget = img;
        }
    }, { passive: false });

    /* ============================================================
       ПЕЧАТЬ
       ============================================================ */

    function printCurrent() {
        const lesson = allLessons[currentLessonId];
        if (!lesson) { window.print(); return; }

        if (lesson.type === "quiz") {
            const backup = quizContent.innerHTML;
            quizContent.innerHTML = renderQuizForPrint(lesson);
            prepareNotesForPrint();
            prepareHelpForPrint();
            window.print();
            setTimeout(() => {
                cleanupPrintNotes();
                cleanupHelpForPrint();
                quizContent.innerHTML = backup;
            }, 100);
        } else if (lesson.type === "glossary") {
            const backup = glossaryContentEl.innerHTML;
            glossaryContentEl.innerHTML = renderGlossaryForPrint(lesson);
            const sidebar = document.querySelector(".glossary-sidebar");
            if (sidebar) sidebar.style.display = "none";
            prepareNotesForPrint();
            prepareHelpForPrint();
            window.print();
            setTimeout(() => {
                cleanupPrintNotes();
                cleanupHelpForPrint();
                glossaryContentEl.innerHTML = backup;
                if (sidebar) sidebar.style.display = "";
            }, 100);
        } else if (lesson.type === "theory") {
            const backup = slideContent.innerHTML;
            slideContent.innerHTML = renderTheoryForPrint(lesson);
            prepareNotesForPrint();
            prepareHelpForPrint();
            window.print();
            setTimeout(() => {
                cleanupPrintNotes();
                cleanupHelpForPrint();
                slideContent.innerHTML = backup;
            }, 100);
        } else {
            prepareNotesForPrint();
            prepareHelpForPrint();
            window.print();
            setTimeout(() => {
                cleanupPrintNotes();
                cleanupHelpForPrint();
            }, 100);
        }
    }
    window.printCurrent = printCurrent;

    function prepareNotesForPrint() {
        document.querySelectorAll(".slide-content, .memo-cell-body").forEach(container => {
            container.querySelectorAll("p, h3, .quote, .text-p").forEach(blockEl => {
                const notes = blockEl.querySelectorAll(".note");
                if (notes.length === 0) return;
                const seen = [];
                notes.forEach(sp => {
                    const idx = parseInt(sp.dataset.noteIdx, 10);
                    if (!isNaN(idx) && !seen.includes(idx)) seen.push(idx);
                });
                if (seen.length === 0) return;

                const box = document.createElement("div");
                box.className = "print-notes";
                box.setAttribute("data-print-notes", "1");
                seen.forEach(idx => {
                    let noteText = "";
                    document.querySelectorAll(`.note[data-note-idx="${idx}"]`).forEach(sp => {
                        if (!noteText && sp.dataset.noteText) noteText = sp.dataset.noteText;
                    });
                    const div = document.createElement("div");
                    div.className = "print-note-item";
                    div.textContent = (idx + 1) + ". " + noteText;
                    box.appendChild(div);
                });
                blockEl.insertAdjacentElement("afterend", box);
            });

            container.querySelectorAll(".img-with-markers").forEach(wrapEl => {
                const text = collectMarkersForPrint(wrapEl);
                if (text.length === 0) return;

                const box = document.createElement("div");
                box.className = "print-notes";
                box.setAttribute("data-print-notes", "1");
                text.forEach((t, i) => {
                    const div = document.createElement("div");
                    div.className = "print-note-item";
                    div.textContent = (i + 1) + ". " + t;
                    box.appendChild(div);
                });
                const media = wrapEl.closest(".slide-media") || wrapEl;
                media.insertAdjacentElement("afterend", box);
            });
        });
    }

    function collectMarkersForPrint(wrapEl) {
        const container = wrapEl.closest(".slide-content, .memo-cell-body");
        if (!container) return [];
        const wraps = Array.from(container.querySelectorAll(".img-with-markers"));
        const order = wraps.indexOf(wrapEl);
        if (order === -1) return [];

        const blocks = getBlocksForContainer(container);
        if (!Array.isArray(blocks)) return [];

        let counter = -1;
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b && b.type === "image" && Array.isArray(b.markers) && b.markers.length > 0) {
                counter++;
                if (counter === order) {
                    return b.markers.map(m => m.text || "");
                }
            }
        }
        return [];
    }

    function cleanupPrintNotes() {
        document.querySelectorAll('[data-print-notes="1"]').forEach(el => el.remove());
    }

    function renderQuizForPrint(lesson) {
        let html = "";
        html += `<h1 class="slide-title">${escapeHtml(lesson.title || "")}</h1>`;
        lesson.questions.forEach((q, idx) => {
            html += `<div class="print-question-item">`;
            html += `<div class="print-question-number">Вопрос ${idx + 1}</div>`;
            if (q.type === "single" || q.type === "multi") {
                html += `<div class="print-question-text">${escapeHtml(q.text || "")}</div>`;
                html += `<div class="print-options">`;
                (q.options || []).forEach((opt) => {
                    html += `<div class="print-option">☐ ${escapeHtml(opt)}</div>`;
                });
                html += `</div>`;
            } else if (q.type === "match") {
                html += `<div class="print-question-text">${escapeHtml(q.text || "Соедини пары")}</div>`;
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

    function renderGlossaryForPrint(lesson) {
        const terms = lesson.terms || [];
        let html = `<h1 class="slide-title">${escapeHtml(lesson.title || "")}</h1>`;
        terms.forEach((term) => {
            const name = String(term.name || "").trim() || "(без названия)";
            html += `<div class="print-glossary-item">`;
            html += `<h2 class="print-glossary-term">${escapeHtml(name)}</h2>`;
            html += `<div class="slide-content">`;
            html += renderContentBlocks(term.content);
            html += `</div>`;
            html += `</div>`;
        });
        return html;
    }

    function renderTheoryForPrint(lesson) {
        const list = lesson.slides || [];
        let html = `<h1 class="slide-title print-theory-title">${escapeHtml(lesson.title || "")}</h1>`;
        list.forEach((slide, i) => {
            html += `<section class="print-theory-slide${i > 0 ? ' print-page-break' : ''}">`;
            html += `<h2 class="slide-title">${escapeHtml(slide.title || "")}</h2>`;
            html += `<div class="slide-content">`;
            html += renderContentBlocks(slide.content);
            html += `</div>`;
            html += `</section>`;
        });
        return html;
    }

    function prepareHelpForPrint() {
        const data = buildHelpContent();
        if (!data) return;
        const wrap = document.createElement("div");
        wrap.className = "print-help";
        wrap.setAttribute("data-print-help", "1");
        let html = "";
        html += `<h1 class="print-help-title">Справка</h1>`;
        html += `<div class="print-help-section">`;
        html += `<div><b>Блок:</b> ${escapeHtml(data.lessonTitle)}</div>`;
        html += `<div><b>Тип:</b> ${escapeHtml(data.lessonType)}</div>`;
        if (data.slideTitle) html += `<div><b>Слайд:</b> ${escapeHtml(data.slideTitle)}</div>`;
        html += `<div><b>Дата изменения:</b> ${escapeHtml(formatDateTime(data.editedAt))}</div>`;
        html += `</div>`;
        if (data.backlinksHtml) {
            html += `<div class="print-help-section">`;
            html += `<div class="print-help-section-title">Упоминается в</div>`;
            html += data.backlinksHtml.replace(/<a[^>]*>/g, "<span>").replace(/<\/a>/g, "</span>");
            html += `</div>`;
        }
        html += `<div class="print-help-section">`;
        html += `<div class="print-help-section-title">Сноски</div>`;
        if (data.textNotes.length === 0 && data.imageMarkers.length === 0) {
            html += `<div class="print-help-empty">Сносок нет.</div>`;
        } else {
            if (data.textNotes.length > 0) {
                html += `<div class="print-help-sub">В тексте:</div>`;
                data.textNotes.forEach(n => {
                    html += `<div class="print-help-note"><b>${n.num}.</b> ${escapeHtml(n.text)}</div>`;
                });
            }
            if (data.imageMarkers.length > 0) {
                html += `<div class="print-help-sub">На картинках:</div>`;
                data.imageMarkers.forEach(m => {
                    html += `<div class="print-help-note"><b>${m.num}.</b> ${escapeHtml(m.text)} <span class="print-help-where">(${escapeHtml(m.where)})</span></div>`;
                });
            }
        }
        html += `</div>`;
        wrap.innerHTML = html;
        document.body.appendChild(wrap);
    }

    function cleanupHelpForPrint() {
        document.querySelectorAll('[data-print-help="1"]').forEach(el => el.remove());
    }

    /* ============================================================
       ПУБЛИЧНЫЙ API (для app.js)
       ============================================================ */

    window.reader = {
        renderMenu: renderMenu,
        renderSlide: renderSlide,
        renderQuiz: renderQuiz,
        renderMemo: renderMemo,
        renderGlossary: renderGlossary,
        openLessonById: openLessonById,
        goToInternalLink: goToInternalLink,
        printCurrent: printCurrent,
        openHelp: openHelp,
        setMode: setModeInternal,
        rerenderCurrentScreen: rerenderCurrentScreen,
        currentLesson: currentLesson,
        getCurrentLessonId: () => currentLessonId,
        getCurrentSlide: () => currentSlide
    };

    /* ============================================================
       ПРОСТАЯ ФУНКЦИЯ currentLesson() — используется ниже и в Части 2
       ============================================================ */

    function currentLesson() {
        if (!currentLessonId) return null;
        return allLessons[currentLessonId] || null;
    }

    /* ============================================================
       ЗАГЛУШКИ для Части 2 и 3 (будут перезаписаны ниже)
       ============================================================ */

    let renderSlideBlocks = function() { return ""; };
    let attachAuthorHandlers = function() {};
    let scheduleSave = function() {};
    let startInlineEditLessonTitle = function() {};
    let startInlineEditSlideTitle = function() {};
    let openLessonContextMenu = function() {};
    let openSlideContextMenu = function() {};
    let addLesson = function() {};
    let addSlide = function() {};
    let addMemoCell = function() {};
    let deleteMemoCell = function() {};
    let deleteTerm = function() {};
    let addBlock = function() {};
    let addMemoBlock = function() {};
    let addTermBlock = function() {};
    let openPreviewEditor = function() {};
    let openCourseSettings = function() {};
    let openQuizEditor = function() {};
    let closeQuizEditor = function() {};
    let closeQuizEditorIfOutside = function() {};
    let openModal = function() {};
    let closeModal = function() {};
    let closeModalIfOutside = function() {};
    let saveToFile = function() {};
    let downloadData = function() {};
    let reloadFromFile = function() {};
    let exportCourse = function() {};
    let importCourse = function() {};
    let importLesson = function() {};
    let exportGlossaryCsv = function() {};
    let importGlossaryCsv = function() {};
    let toggleDropdown = function() {};
    let closeAllDropdowns = function() {};
    let toggleTheme = function() {};
    let setStatus = function() {};
    let openCsvImport = function() {};
    let closeCsvModal = function() {};
    let closeCsvIfOutside = function() {};
    let openCsvTemplates = function() {};
    let downloadCsvTemplate = function() {};
    let csvPickType = function() {};
    let csvBackToStep1 = function() {};
    let csvApplyImport = function() {};

    // Экспортируем наверх, чтобы onclick в HTML нашёл их
    window.renderSlideBlocks = renderSlideBlocks;
    window.attachAuthorHandlers = attachAuthorHandlers;
    window.scheduleSave = scheduleSave;
    window.startInlineEditLessonTitle = startInlineEditLessonTitle;
    window.startInlineEditSlideTitle = startInlineEditSlideTitle;
    window.openLessonContextMenu = openLessonContextMenu;
    window.openSlideContextMenu = openSlideContextMenu;
    window.addLesson = addLesson;
    window.addSlide = addSlide;
    window.addMemoCell = addMemoCell;
    window.deleteMemoCell = deleteMemoCell;
    window.deleteTerm = deleteTerm;
    window.addBlock = addBlock;
    window.addMemoBlock = addMemoBlock;
    window.addTermBlock = addTermBlock;
    window.openPreviewEditor = openPreviewEditor;
    window.openCourseSettings = openCourseSettings;
    window.openQuizEditor = openQuizEditor;
    window.closeQuizEditor = closeQuizEditor;
    window.closeQuizEditorIfOutside = closeQuizEditorIfOutside;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.closeModalIfOutside = closeModalIfOutside;
    window.saveToFile = saveToFile;
    window.downloadData = downloadData;
    window.reloadFromFile = reloadFromFile;
    window.exportCourse = exportCourse;
    window.importCourse = importCourse;
    window.importLesson = importLesson;
    window.exportGlossaryCsv = exportGlossaryCsv;
    window.importGlossaryCsv = importGlossaryCsv;
    window.toggleDropdown = toggleDropdown;
    window.closeAllDropdowns = closeAllDropdowns;
    window.toggleTheme = toggleTheme;
    window.setStatus = setStatus;
    window.openCsvImport = openCsvImport;
    window.closeCsvModal = closeCsvModal;
    window.closeCsvIfOutside = closeCsvIfOutside;
    window.openCsvTemplates = openCsvTemplates;
    window.downloadCsvTemplate = downloadCsvTemplate;
    window.csvPickType = csvPickType;
    window.csvBackToStep1 = csvBackToStep1;
    window.csvApplyImport = csvApplyImport;

    /* ============================================================
       АВТОСТАРТ (только если мы в читателе и это не пустой data.js)
       ============================================================ */

    currentMode = getMode();

    if (READER_AVAILABLE) {
        // Проверка данных
        if (typeof allLessons === "undefined" || !allLessons || Object.keys(allLessons).length === 0) {
            // Покажем заглушку
            if (appContainer) {
                appContainer.innerHTML = `<div class="empty" style="max-width:600px;margin:80px auto;text-align:center;color:var(--text-muted);">
                    <h2 style="color:var(--text-strong);margin:0 0 12px;">Курс пустой</h2>
                    <p>В data.js нет ни одного блока. Открой редактор, чтобы добавить.</p>
                </div>`;
            }
        } else {
            renderMenu();
        }
    }
    /* ============================================================
       ЗАГЛУШКА setMode / setAppMode (перезапишет app.js)
       ============================================================ */

    window.setModeInternal = setModeInternal;

    /* ============================================================
       ЧАСТЬ 2 — РЕНДЕР БЛОКОВ В АВТОРЕ
       ============================================================ */

    /* ============================================================
       РЕНДЕР СЛАЙД-БЛОКОВ С ИНСТРУМЕНТАМИ
       В читателе — просто renderContentBlocks.
       В авторе — каждый блок в .block-wrapper-edit с ручкой и кнопкой ✕.
       ============================================================ */

    renderSlideBlocks = function (blocks, context, itemIndex) {
        if (currentMode !== "author") {
            return renderContentBlocks(blocks);
        }

        let html = "";
        (blocks || []).forEach((b, i) => {
            html += renderBlockEditor(b, i, context, itemIndex);
        });
        return html;
    };
  
    /* ============================================================
       РЕНДЕР ОДНОГО РЕДАКТИРУЕМОГО БЛОКА
       ============================================================ */

    function renderBlockEditor(block, index, context, itemIndex) {
        const isText = (block.type === "p" || block.type === "h3" || block.type === "quote");

        let inner = "";
        let richToolbar = "";

        if (block.type === "p") {
            inner = `<p contenteditable="true" data-block-index="${index}" data-block-type="p">${renderNotesInTextEditor(block.text || "", block.notes || [])}</p>`;
            richToolbar = createRichToolbarHTML(index, context, itemIndex);
        } else if (block.type === "h3") {
            inner = `<h3 contenteditable="true" data-block-index="${index}" data-block-type="h3">${renderNotesInTextEditor(block.text || "", block.notes || [])}</h3>`;
            richToolbar = createRichToolbarHTML(index, context, itemIndex);
        } else if (block.type === "quote") {
            const variantClass = block.variant ? ` variant-${block.variant}` : '';
            inner = `<div class="quote-text${variantClass}" contenteditable="true" data-block-index="${index}" data-block-type="quote">${renderNotesInTextEditor(block.text || "", block.notes || [])}</div>`;
            richToolbar = createRichToolbarHTML(index, context, itemIndex, block);
        } else if (block.type === "ul") {
            inner = renderListEditorHTML(block, index, context, itemIndex);
        } else if (block.type === "link") {
            inner = renderLinkEditorHTML(block, index);
        } else if (block.type === "image") {
            inner = renderMediaEditorHTML(block, index, "image", context, itemIndex);
        } else if (block.type === "video") {
            inner = renderMediaEditorHTML(block, index, "video", context, itemIndex);
        } else if (block.type === "table") {
            inner = renderTableEditorHTML(block, index);
        }

        // Инструменты блока
        const toolsHtml = `
            <div class="block-tools-inline">
                <button class="block-delete-btn" title="Удалить блок" data-action="delete-block" data-index="${index}" data-context="${context}" data-item-index="${itemIndex}">✕</button>
            </div>
        `;

        const handleHtml = `<div class="block-drag-handle" draggable="true" data-index="${index}" data-context="${context}" data-item-index="${itemIndex}" title="Перетащи, чтобы переместить">⠿</div>`;

        return `
            <div class="block-wrapper-edit" data-block-index="${index}" data-block-type="${block.type}" data-context="${context}" data-item-index="${itemIndex}">
                ${handleHtml}
                ${richToolbar}
                ${inner}
                ${toolsHtml}
            </div>
        `;
    }

    /* ============================================================
       RICH-ПАНЕЛЬ (B/I/U/S + 🔗 + 💬)
       ============================================================ */

    function createRichToolbarHTML(index, context, itemIndex, block) {
        // Генерируем палитру цветов только для цитаты
        let colorPalette = "";
        if (block && block.type === "quote") {
            const curColor = block.variant || "red"; // Красный (бордовый) по умолчанию
            colorPalette = `
                <span class="rich-sep"></span>
                <button type="button" class="rich-color-btn c-red ${curColor === 'red' ? 'active' : ''}" data-action="quote-color" data-color="red" data-index="${index}" title="Красный"></button>
                <button type="button" class="rich-color-btn c-green ${curColor === 'green' ? 'active' : ''}" data-action="quote-color" data-color="green" data-index="${index}" title="Зелёный"></button>
                <button type="button" class="rich-color-btn c-blue ${curColor === 'blue' ? 'active' : ''}" data-action="quote-color" data-color="blue" data-index="${index}" title="Синий"></button>
                <button type="button" class="rich-color-btn c-orange ${curColor === 'orange' ? 'active' : ''}" data-action="quote-color" data-color="orange" data-index="${index}" title="Оранжевый"></button>
            `;
        }

        return `
            <div class="rich-toolbar-inline" contenteditable="false">
                <button class="rich-btn" data-action="format" data-cmd="bold" title="Жирный (Ctrl+B)">B</button>
                <button class="rich-btn" data-action="format" data-cmd="italic" title="Курсив (Ctrl+I)">I</button>
                <button class="rich-btn" data-action="format" data-cmd="underline" title="Подчёркнутый (Ctrl+U)">U</button>
                <button class="rich-btn" data-action="format" data-cmd="strikeThrough" title="Зачёркнутый">S</button>
                <span class="rich-sep"></span>
                <button class="rich-btn" data-action="format" data-cmd="justifyLeft" title="По левому краю">⯇</button>
                <button class="rich-btn" data-action="format" data-cmd="justifyCenter" title="По центру">≡</button>
                <button class="rich-btn" data-action="format" data-cmd="justifyRight" title="По правому краю">⯈</button>
                <button class="rich-btn" data-action="format" data-cmd="justifyFull" title="По ширине">☰</button>
                <span class="rich-sep"></span>
                <button class="rich-btn" data-action="wiki" title="Вставить wiki-ссылку">🔗</button>
                <button class="rich-btn" data-action="note" title="Добавить примечание">💬</button>
                ${colorPalette}
            </div>
        `;
    }

    /* ============================================================
       РЕНДЕР СПИСКА (ul) — редактор
       ============================================================ */

    function renderListEditorHTML(block, index, context, itemIndex) {
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

        let styleOptions = "";
        [
            { v: "bullet", t: "• Точки" },
            { v: "number", t: "1. Цифры" },
            { v: "checkbox", t: "☐ Чекбоксы" }
        ].forEach(opt => {
            styleOptions += `<option value="${opt.v}"${block.style === opt.v ? " selected" : ""}>${opt.t}</option>`;
        });

        let itemsHtml = "";
        block.items.forEach((item, idx) => {
            let marker = "";
            if (block.style === "bullet") {
                marker = item.level === 0 ? "•" : (item.level === 1 ? "◦" : "▪");
            } else if (block.style === "number") {
                marker = (idx + 1) + ".";
            } else if (block.style === "checkbox") {
                marker = "☐";
            }
            itemsHtml += `
                <div class="list-editor-row" data-level="${item.level}" data-idx="${idx}" data-block-index="${index}">
                    <span class="list-editor-marker">${marker}</span>
                    <input type="text" class="list-editor-input" value="${escapeAttr(item.text)}" placeholder="Текст пункта" data-action="list-item-input" data-index="${index}" data-item-idx="${idx}">
                    <div class="list-editor-tools">
                        <button type="button" class="mini-icon-btn" data-action="list-lvl-down" data-index="${index}" data-item-idx="${idx}" title="Углубить (Tab)">⇥</button>
                        <button type="button" class="mini-icon-btn" data-action="list-lvl-up" data-index="${index}" data-item-idx="${idx}" title="Поднять (Shift+Tab)">⇤</button>
                        <button type="button" class="mini-icon-btn" data-action="list-add" data-index="${index}" data-item-idx="${idx}" title="Добавить ниже">＋</button>
                        <button type="button" class="mini-icon-btn del" data-action="list-del" data-index="${index}" data-item-idx="${idx}" title="Удалить">✕</button>
                    </div>
                </div>
            `;
        });

        return `
            <div class="list-editor" data-block-index="${index}">
                <div class="list-editor-header">
                    <label class="list-editor-style-label">Стиль:</label>
                    <select class="list-editor-style-select" data-action="list-style" data-index="${index}">
                        ${styleOptions}
                    </select>
                </div>
                <div class="list-editor-items">${itemsHtml}</div>
                <div style="margin-top:8px;">
                    <button class="btn btn-outline" style="padding:6px 14px;font-size:13px;" data-action="list-add-new" data-index="${index}">＋ Добавить пункт</button>
                </div>
            </div>
        `;
    }

    /* ============================================================
       РЕНДЕР ССЫЛКИ (link) — редактор
       ============================================================ */

    function renderLinkEditorHTML(block, index) {
        return `
            <div class="link-editor" data-block-index="${index}">
                <div class="link-text-row">
                    <span>🔗</span>
                    <span class="link-text" contenteditable="true" data-action="link-text" data-index="${index}">${escapeHtml(block.text || "Ссылка")}</span>
                </div>
                <div class="url-row">
                    <span>URL:</span>
                    <input type="text" class="link-url" data-action="link-url" data-index="${index}" value="${escapeAttr(block.href || "")}" placeholder="https://... или #ключ_блока:3">
                </div>
                <div class="url-hint">Внешние: https://... | внутри курса: #ключ_блока или #ключ_блока:3</div>
            </div>
        `;
    }

    /* ============================================================
       РЕНДЕР МЕДИА (image / video) — с кнопкой "✎ Изменить"
       ============================================================ */

function renderMediaEditorHTML(block, index, type, context, itemIndex) {
    const isImage = type === "image";
    const src = block.src || "";

    let previewHtml = "";
    if (!src) {
        previewHtml = `<div class="media-preview-empty">Превью появится здесь</div>`;
    } else if (isImage) {
               const markers = Array.isArray(block.markers) ? block.markers : [];
        const highlights = Array.isArray(block.highlights) ? block.highlights : [];
        
        if (markers.length > 0 || highlights.length > 0) {
            let innerHtml = "";
            
            // Рисуем рамки
            highlights.forEach(h => {
                const colorClass = h.color ? ` color-${h.color}` : ' color-red';
                innerHtml += `<div class="img-highlight-box${colorClass}" style="left:${h.x}%;top:${h.y}%;width:${h.w}%;height:${h.h}%;"></div>`;
            });
            
            // Рисуем маркеры
            markers.forEach((m, i) => {
                const x = Number(m.x) || 0;
                const y = Number(m.y) || 0;
                innerHtml += `<button type="button" class="img-marker" data-marker-idx="${i}" data-block-index="${index}" style="left:${x}%;top:${y}%;" aria-label="Примечание ${i + 1}" title="${escapeAttr(m.text || "")}"></button>`;
            });
            
            previewHtml = `<div class="img-with-markers"><img src="${escapeAttr(src)}" alt="" data-lightbox="1">${innerHtml}</div>`;
        } else {
            previewHtml = `<img src="${escapeAttr(src)}" alt="" loading="lazy" data-lightbox="1">`;
        }
    } else {
        previewHtml = `<video src="${escapeAttr(src)}" controls preload="metadata"></video>`;
    }

    // Кнопка "✎ Изменить" — раскрывает редактор медиа ниже
    const editBtn = `
        <button type="button" class="media-edit-overlay-btn" data-action="media-edit" data-index="${index}" data-type="${type}" data-context="${context}" data-item-index="${itemIndex}">✎ Изменить</button>
    `;

    // --- НОВОЕ: настройки размера и выравнивания для картинок ---
    let sizeControlsHtml = "";
    if (isImage) {
        const curWidth = (typeof block.width === "number" && block.width >= 10 && block.width <= 100) ? block.width : 100;
        const curAlign = (block.align === "center" || block.align === "right") ? block.align : "left";
        sizeControlsHtml = `
            <div class="media-size-controls" style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border);">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <span style="font-size: 13px; font-weight: 500; color: var(--text-muted); min-width: 60px;">Ширина:</span>
                    <input type="range" min="10" max="100" step="5" value="${curWidth}" data-action="media-width" data-index="${index}" style="flex: 1;">
                    <span class="media-width-val" data-width-val="${index}" style="font-size: 13px; font-weight: 700; color: var(--text-strong); min-width: 40px; text-align: right;">${curWidth}%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 13px; font-weight: 500; color: var(--text-muted); min-width: 60px;">Край:</span>
                    <div class="align-btn-group" style="display: flex; gap: 4px; flex: 1;">
                        <button type="button" class="btn btn-outline btn-sm ${curAlign === 'left' ? 'active' : ''}" data-action="media-align" data-index="${index}" data-align="left" style="flex: 1; padding: 6px; font-size: 14px;">⯇</button>
                        <button type="button" class="btn btn-outline btn-sm ${curAlign === 'center' ? 'active' : ''}" data-action="media-align" data-index="${index}" data-align="center" style="flex: 1; padding: 6px; font-size: 14px;">≡</button>
                        <button type="button" class="btn btn-outline btn-sm ${curAlign === 'right' ? 'active' : ''}" data-action="media-align" data-index="${index}" data-align="right" style="flex: 1; padding: 6px; font-size: 14px;">⯈</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Скрытый редактор медиа (раскроется при клике на "✎ Изменить")
    const editorHtml = `
        <div class="media-editor-inline" data-media-editor="${index}" style="display:none;">
            <div class="media-src-row">
                <input type="text" class="input media-src-input" data-action="media-src" data-index="${index}" value="${escapeAttr(src)}" placeholder="${isImage ? 'images/pic.png' : 'videos/lesson.mp4'}">
                <button type="button" class="btn btn-outline media-file-btn" data-action="media-file" data-index="${index}" data-type="${type}">📁 Выбрать</button>
            </div>
            <input type="file" data-media-file-input="${index}" accept="${isImage ? 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml' : 'video/mp4,video/webm,video/ogg'}" style="display:none;">
            ${sizeControlsHtml}
            <div class="media-progress" data-media-progress="${index}" style="display:none;">
                <div class="media-progress-bar"><div class="media-progress-fill" data-media-fill="${index}"></div></div>
                <div class="media-progress-text" data-media-text="${index}"></div>
            </div>
            <div class="media-drop-zone" data-media-drop="${index}">Перетащи файл сюда</div>
            ${isImage ? `<div class="img-marker-editor" data-marker-editor="${index}">
                <div class="img-marker-editor-title">🎯 Маркеры на картинке</div>
                <div class="img-marker-editor-hint">Клик по картинке ниже — добавить маркер. Клик по маркеру — редактировать.</div>
                <div class="img-marker-stage-wrap" data-marker-stage-wrap="${index}"></div>
                <div class="img-marker-list" data-marker-list="${index}"></div>
            </div>` : ''}
            <!-- НОВОЕ: Блок для рамок выделения -->
            ${isImage ? `<div class="img-highlight-editor" data-highlight-editor="${index}" style="margin-top: 12px; padding: 12px 14px; background: var(--input-bg); border: 1px solid var(--border); border-radius: var(--radius-md);">
                <div class="img-marker-editor-title" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🔴 Рамки выделения</span>
                    <button type="button" class="btn btn-outline btn-sm" data-action="highlight-add" data-index="${index}" style="padding: 4px 10px; font-size: 12px;">➕ Добавить рамку</button>
                </div>
                <div class="img-marker-editor-hint">Нарисуй рамку мышкой прямо на превью картинки.</div>
                <div class="img-highlight-list" data-highlight-list="${index}"></div>
            </div>` : ''}
        </div>
    `;

    return `
        <div class="media-editor ${isImage ? 'img-with-markers' : ''}" data-block-index="${index}">
            <div class="media-preview media-with-edit" data-media-preview="${index}">
                ${previewHtml}
                ${editBtn}
            </div>
            ${editorHtml}
        </div>
    `;
}

    /* ============================================================
       РЕНДЕР ТАБЛИЦЫ — редактор
       ============================================================ */

    function renderTableEditorHTML(block, index) {
        if (!block.rows) block.rows = [["", ""], ["", ""]];
        if (block.header === undefined) block.header = true;

        const MAX_ROWS = 10;
        const MAX_COLS = 10;
        const rows = block.rows;
        let maxCols = 0;
        rows.forEach(r => { if (Array.isArray(r) && r.length > maxCols) maxCols = r.length; });
        if (maxCols === 0) maxCols = 1;

        let gridHtml = "";
        rows.forEach((row, ri) => {
            gridHtml += `<tr>`;
            for (let ci = 0; ci < maxCols; ci++) {
                const val = (row[ci] !== undefined) ? row[ci] : "";
                const isHeader = block.header && ri === 0;
                gridHtml += `<td class="table-editor-cell${isHeader ? ' is-header' : ''}" data-row="${ri}" data-col="${ci}">
                    <input type="text" value="${escapeAttr(val)}" placeholder="${isHeader ? 'Заголовок ' + (ci + 1) : ''}" data-action="table-input" data-index="${index}" data-row="${ri}" data-col="${ci}">
                </td>`;
            }
            gridHtml += `</tr>`;
        });

        return `
            <div class="table-editor" data-block-index="${index}">
                <div class="table-editor-top">
                    <label class="table-editor-toggle">
                        <input type="checkbox" data-action="table-header" data-index="${index}" ${block.header ? 'checked' : ''}>
                        <span>Первая строка — заголовок</span>
                    </label>
                    <div class="table-editor-count">Строк: ${rows.length} / ${MAX_ROWS} · Столбцов: ${maxCols} / ${MAX_COLS}</div>
                </div>
                <div class="table-editor-actions">
                    <button type="button" class="btn btn-outline" data-action="table-add-row" data-index="${index}">＋ Строка</button>
                    <button type="button" class="btn btn-outline" data-action="table-del-row" data-index="${index}">− Строка</button>
                    <button type="button" class="btn btn-outline" data-action="table-add-col" data-index="${index}">＋ Столбец</button>
                    <button type="button" class="btn btn-outline" data-action="table-del-col" data-index="${index}">− Столбец</button>
                    <button type="button" class="btn btn-outline" data-action="table-paste" data-index="${index}">📥 Вставить из буфера</button>
                    <button type="button" class="btn btn-outline" data-action="table-copy" data-index="${index}">📤 Скопировать</button>
                </div>
                <div class="table-editor-grid-wrap">
                    <table class="table-editor-grid" data-table-grid="${index}">${gridHtml}</table>
                </div>
            </div>
        `;
    }

    /* ============================================================
       RENDERNOTES В РЕДАКТОРЕ — ((N)) → span.note (contenteditable=false)
       ============================================================ */

    function renderNotesInTextEditor(html, notes) {
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

    /* ============================================================
       ATTACH AUTHOR HANDLERS — все обработчики после рендера
       ============================================================ */

    attachAuthorHandlers = function (container, item, context, itemIndex) {
        if (currentMode !== "author") return;

        const blocks = getBlocksForItem(item, context);
        if (!Array.isArray(blocks)) return;

        // ============ RICH-ПАНЕЛЬ ============
        container.querySelectorAll("[data-action='format']").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const wrapper = btn.closest(".block-wrapper-edit");
                if (!wrapper) return;
                const editable = wrapper.querySelector("[contenteditable='true']");
                if (!editable) return;
                editable.focus();
                document.execCommand(btn.dataset.cmd, false, null);
                readEditableBlock(wrapper, blocks, context, itemIndex);
                scheduleSave();
            });
        });

        // ============ ЦВЕТА ЦИТАТЫ ============
        container.querySelectorAll("[data-action='quote-color']").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const idx = parseInt(btn.dataset.index, 10);
                const color = btn.dataset.color;
                if (!blocks[idx]) return;
                
                blocks[idx].variant = color;
                
                const wrapper = btn.closest(".block-wrapper-edit");
                const quoteEl = wrapper.querySelector(".quote-text");
                if (quoteEl) {
                    quoteEl.className = "quote-text variant-" + color;
                }
                
                const toolbar = btn.closest(".rich-toolbar-inline");
                if (toolbar) {
                    toolbar.querySelectorAll(".rich-color-btn").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }
                
                scheduleSave();
            });
        });

        // Wiki-ссылка
        container.querySelectorAll("[data-action='wiki']").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const wrapper = btn.closest(".block-wrapper-edit");
                if (!wrapper) return;
                const editable = wrapper.querySelector("[contenteditable='true']");
                if (!editable) return;
                editable.focus();
                insertWikiLinkAtCaret(editable);
                readEditableBlock(wrapper, blocks, context, itemIndex);
                scheduleSave();
            });
        });

        // Примечание
        container.querySelectorAll("[data-action='note']").forEach(btn => {
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const wrapper = btn.closest(".block-wrapper-edit");
                if (!wrapper) return;
                const editable = wrapper.querySelector("[contenteditable='true']");
                if (!editable) return;
                openNoteEditorInline(editable, blocks, context, itemIndex);
            });
        });

        // ============ ТЕКСТОВЫЕ БЛОКИ (contentEditable) ============
        container.querySelectorAll("[contenteditable='true'][data-block-index]").forEach(editable => {
            editable.addEventListener("input", () => {
                readEditableBlock(editable.closest(".block-wrapper-edit"), blocks, context, itemIndex);
                scheduleSave();
            });
            editable.addEventListener("keydown", (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    document.execCommand("insertLineBreak");
                    readEditableBlock(editable.closest(".block-wrapper-edit"), blocks, context, itemIndex);
                    scheduleSave();
                }
            });
            editable.addEventListener("paste", handlePasteInline);

            // Клик по .note — открыть модалку
            editable.addEventListener("click", (e) => {
                const noteEl = e.target.closest(".note");
                if (!noteEl) return;
                e.preventDefault();
                const idx = parseInt(noteEl.dataset.noteIdx, 10);
                if (isNaN(idx)) return;
                const wrapper = editable.closest(".block-wrapper-edit");
                const blockIdx = parseInt(wrapper.dataset.blockIndex, 10);
                openNoteEditModal(editable, blocks, blockIdx, idx, context, itemIndex);
            });

            initWikiAutocomplete(editable);
        });

        // ============ СПИСКИ ============
        container.querySelectorAll("[data-action='list-style']").forEach(sel => {
            sel.addEventListener("change", () => {
                const idx = parseInt(sel.dataset.index, 10);
                if (blocks[idx]) {
                    blocks[idx].style = sel.value;
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });

        container.querySelectorAll("[data-action='list-item-input']").forEach(inp => {
            inp.addEventListener("input", () => {
                const idx = parseInt(inp.dataset.index, 10);
                const itemIdx = parseInt(inp.dataset.itemIdx, 10);
                if (blocks[idx] && blocks[idx].items && blocks[idx].items[itemIdx]) {
                    blocks[idx].items[itemIdx].text = inp.value;
                    scheduleSave();
                }
            });
            inp.addEventListener("keydown", (e) => {
                const idx = parseInt(inp.dataset.index, 10);
                const itemIdx = parseInt(inp.dataset.itemIdx, 10);
                if (!blocks[idx] || !blocks[idx].items) return;
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    blocks[idx].items.splice(itemIdx + 1, 0, { text: "", level: blocks[idx].items[itemIdx].level });
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                    setTimeout(() => {
                        const newInput = document.querySelector(`[data-action='list-item-input'][data-index='${idx}'][data-item-idx='${itemIdx + 1}']`);
                        if (newInput) newInput.focus();
                    }, 0);
                } else if (e.key === "Tab") {
                    e.preventDefault();
                    const cur = blocks[idx].items[itemIdx];
                    if (e.shiftKey) {
                        if (cur.level > 0) cur.level--;
                    } else {
                        if (cur.level < 2) cur.level++;
                    }
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                    setTimeout(() => {
                        const newInput = document.querySelector(`[data-action='list-item-input'][data-index='${idx}'][data-item-idx='${itemIdx}']`);
                        if (newInput) newInput.focus();
                    }, 0);
                }
            });
        });

        container.querySelectorAll("[data-action='list-lvl-down']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                const itemIdx = parseInt(btn.dataset.itemIdx, 10);
                if (blocks[idx] && blocks[idx].items && blocks[idx].items[itemIdx].level < 2) {
                    blocks[idx].items[itemIdx].level++;
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='list-lvl-up']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                const itemIdx = parseInt(btn.dataset.itemIdx, 10);
                if (blocks[idx] && blocks[idx].items && blocks[idx].items[itemIdx].level > 0) {
                    blocks[idx].items[itemIdx].level--;
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='list-add']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                const itemIdx = parseInt(btn.dataset.itemIdx, 10);
                if (blocks[idx] && blocks[idx].items) {
                    blocks[idx].items.splice(itemIdx + 1, 0, { text: "", level: blocks[idx].items[itemIdx].level });
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='list-del']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                const itemIdx = parseInt(btn.dataset.itemIdx, 10);
                if (blocks[idx] && blocks[idx].items) {
                    blocks[idx].items.splice(itemIdx, 1);
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='list-add-new']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (blocks[idx]) {
                    if (!blocks[idx].items) blocks[idx].items = [];
                    blocks[idx].items.push({ text: "Новый пункт", level: 0 });
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });

        // ============ ССЫЛКИ ============
        container.querySelectorAll("[data-action='link-text']").forEach(el => {
            el.addEventListener("input", () => {
                const idx = parseInt(el.dataset.index, 10);
                if (blocks[idx]) {
                    blocks[idx].text = el.textContent;
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='link-url']").forEach(inp => {
            inp.addEventListener("input", () => {
                const idx = parseInt(inp.dataset.index, 10);
                if (blocks[idx]) {
                    blocks[idx].href = inp.value;
                    scheduleSave();
                }
            });
        });

        // ============ МЕДИА ============
        container.querySelectorAll("[data-action='media-edit']").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                const editor = container.querySelector(`[data-media-editor="${idx}"]`);
                if (!editor) return;
                const isVisible = editor.style.display !== "none";
                editor.style.display = isVisible ? "none" : "block";
                if (!isVisible) {
                    setupMediaEditorInline(container, blocks, idx, btn.dataset.type, context, itemIndex);
                }
            });
        });

        // ============ НОВОЕ: ШИРИНА И ВЫРАВНИВАНИЕ КАРТИНКИ ============
        container.querySelectorAll("[data-action='media-width']").forEach(input => {
            if (input.dataset.bound) return;
            input.dataset.bound = "1";
            input.addEventListener("input", (e) => {
                const idx = parseInt(input.dataset.index, 10);
                const block = blocks[idx];
                if (!block) return;
                
                const val = parseInt(e.target.value, 10);
                block.width = val;
                
                const valEl = container.querySelector(`[data-width-val="${idx}"]`);
                if (valEl) valEl.textContent = val + "%";
                
                const preview = container.querySelector(`[data-media-preview="${idx}"]`);
                if (preview) {
                    const img = preview.querySelector("img");
                    if (img) {
                        img.style.width = val + "%";
                        img.style.maxWidth = "100%";
                        img.style.height = "auto";
                    }
                }
                scheduleSave();
            });
        });

        container.querySelectorAll("[data-action='media-align']").forEach(btn => {
            if (btn.dataset.bound) return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const idx = parseInt(btn.dataset.index, 10);
                const align = btn.dataset.align;
                const block = blocks[idx];
                if (!block) return;
                
                block.align = align;
                
                const group = btn.closest(".align-btn-group");
                if (group) {
                    group.querySelectorAll("button").forEach(b => b.classList.remove("active"));
                    btn.classList.add("active");
                }
                
                const preview = container.querySelector(`[data-media-preview="${idx}"]`);
                if (preview) {
                    preview.classList.remove("img-align-left", "img-align-center", "img-align-right");
                    preview.classList.add("img-align-" + align);
                }
                scheduleSave();
            });
        });

        // ============ ТАБЛИЦЫ ============
        container.querySelectorAll("[data-action='table-input']").forEach(inp => {
            inp.addEventListener("input", () => {
                const idx = parseInt(inp.dataset.index, 10);
                const r = parseInt(inp.dataset.row, 10);
                const c = parseInt(inp.dataset.col, 10);
                if (blocks[idx] && blocks[idx].rows && blocks[idx].rows[r]) {
                    while (blocks[idx].rows[r].length <= c) blocks[idx].rows[r].push("");
                    blocks[idx].rows[r][c] = inp.value;
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='table-header']").forEach(cb => {
            cb.addEventListener("change", () => {
                const idx = parseInt(cb.dataset.index, 10);
                if (blocks[idx]) {
                    blocks[idx].header = cb.checked;
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='table-add-row']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (blocks[idx] && blocks[idx].rows.length < 10) {
                    let maxCols = 0;
                    blocks[idx].rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
                    blocks[idx].rows.push(new Array(maxCols || 1).fill(""));
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='table-del-row']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (blocks[idx] && blocks[idx].rows.length > 1) {
                    blocks[idx].rows.pop();
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='table-add-col']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (blocks[idx]) {
                    let maxCols = 0;
                    blocks[idx].rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
                    if (maxCols >= 10) return;
                    blocks[idx].rows.forEach(r => r.push(""));
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });
        container.querySelectorAll("[data-action='table-del-col']").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = parseInt(btn.dataset.index, 10);
                if (blocks[idx]) {
                    let maxCols = 0;
                    blocks[idx].rows.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
                    if (maxCols <= 1) return;
                    blocks[idx].rows.forEach(r => r.pop());
                    rerenderCurrentItem(context, itemIndex);
                    scheduleSave();
                }
            });
        });

        // ============ УДАЛЕНИЕ БЛОКА ============
        container.querySelectorAll("[data-action='delete-block']").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index, 10);
                deleteBlockByContext(blocks, idx, context, itemIndex);
            });
        });

        // ============ DRAG&DROP БЛОКОВ КОНТЕНТА ============
        container.querySelectorAll(".block-wrapper-edit").forEach(wrapper => {
            const handle = wrapper.querySelector(".block-drag-handle");
            if (!handle) return;
            setupBlockDragInline(wrapper, handle, blocks, context, itemIndex);
        });
    };
    window.attachAuthorHandlers = attachAuthorHandlers;
        /* ============================================================
       ВСПОМОГАТЕЛЬНЫЕ
       ============================================================ */

    function getBlocksForItem(item, context) {
        if (!item) return null;
        if (context === "memo") return item.content || [];
        if (context === "glossary") return item.content || [];
        return item.content || [];
    }

    function readEditableBlock(wrapper, blocks, context, itemIndex) {
        if (!wrapper) return;
        const idx = parseInt(wrapper.dataset.blockIndex, 10);
        const block = blocks[idx];
        if (!block) return;
        const editable = wrapper.querySelector("[contenteditable='true']");
        if (!editable) return;
        if (block.type === "p" || block.type === "h3" || block.type === "quote") {
            block.text = sanitizeHtmlInline(extractNoteMarkersInline(editable, block.notes || []));
        }
    }

    function rerenderCurrentItem(context, itemIndex) {
        if (context === "memo") {
            const lesson = currentLesson();
            if (lesson) renderMemo(lesson);
        } else if (context === "glossary") {
            const lesson = currentLesson();
            if (lesson) renderGlossary(lesson);
        } else {
            renderSlide();
        }
    }

    function deleteBlockByContext(blocks, idx, context, itemIndex) {
        if (!confirm("Удалить этот блок?")) return;
        blocks.splice(idx, 1);
        rerenderCurrentItem(context, itemIndex);
        scheduleSave();
    }

    /* ============================================================
       SANITIZE + PASTE INLINE
       ============================================================ */

    function sanitizeHtmlInline(html) {
        if (html == null) return "";
        let s = String(html);
        s = s.replace(/<!--[\s\S]*?-->/g, "");
        s = s.replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1>/gi, "");
        s = s.replace(/<(script|style|iframe|object|embed|svg|math)[^>]*\/?>/gi, "");
        s = s.replace(/<br\s*\/?>/gi, "<br>");
        s = s.replace(/&nbsp;/gi, " ");

        const allowed = /^(strong|b|em|i|u|s|strike|del|br|span|div|p)$/i;

        s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, function (match, tagName, attrs) {
            const tag = tagName.toLowerCase();
            if (!allowed.test(tag)) return "";
            const isClosing = match.charAt(1) === "/";
            if (isClosing) return "</" + tag + ">";

            let safeAttrs = "";
            // Сохраняем span.note (наш маркер) и его атрибуты
            if (tag === "span" && /class\s*=\s*["']note["']/i.test(attrs)) {
                const idxM = attrs.match(/data-note-idx\s*=\s*["'](\d+)["']/i);
                if (idxM) {
                    safeAttrs = ` class="note" contenteditable="false" data-note-idx="${idxM[1]}"`;
                } else {
                    safeAttrs = ` class="note" contenteditable="false"`;
                }
            }
            const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
            if (styleMatch) {
                const alignMatch = styleMatch[1].match(/text-align\s*:\s*(left|center|right|justify)/i);
                if (alignMatch) {
                    safeAttrs += ' style="text-align:' + alignMatch[1].toLowerCase() + '"';
                }
            }
            return "<" + tag + safeAttrs + ">";
        });

        s = s.replace(/[ \t]+/g, " ");
        s = s.trim();
        return s;
    }

    function extractNoteMarkersInline(el, notes) {
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

    function handlePasteInline(e) {
        e.preventDefault();
        const cd = e.clipboardData || window.clipboardData;
        if (!cd) return;
        const html = cd.getData("text/html") || "";
        const text = cd.getData("text/plain") || "";
        let clean;
        if (html) {
            clean = sanitizeHtmlInline(html);
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

    /* ============================================================
       DRAG&DROP БЛОКОВ КОНТЕНТА
       ============================================================ */

    function setupBlockDragInline(wrapper, handle, blocks, context, itemIndex) {
        handle.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", wrapper.dataset.blockIndex);
            wrapper.classList.add("dragging");
            document.body.dataset.dragType = "block-" + context;
        });
        handle.addEventListener("dragend", () => {
            wrapper.classList.remove("dragging");
            document.querySelectorAll(".block-wrapper-edit").forEach(w => {
                w.classList.remove("drag-over-top", "drag-over-bottom");
            });
        });
        wrapper.addEventListener("dragover", (e) => {
            if (document.body.dataset.dragType !== "block-" + context) return;
            e.preventDefault();
            const rect = wrapper.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                wrapper.classList.add("drag-over-top");
                wrapper.classList.remove("drag-over-bottom");
            } else {
                wrapper.classList.add("drag-over-bottom");
                wrapper.classList.remove("drag-over-top");
            }
        });
        wrapper.addEventListener("dragleave", () => {
            wrapper.classList.remove("drag-over-top", "drag-over-bottom");
        });
        wrapper.addEventListener("drop", (e) => {
            if (document.body.dataset.dragType !== "block-" + context) return;
            e.preventDefault();
            const draggedIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
            const targetIdx = parseInt(wrapper.dataset.blockIndex, 10);
            if (isNaN(draggedIdx) || isNaN(targetIdx) || draggedIdx === targetIdx) return;

            const rect = wrapper.getBoundingClientRect();
            const insertAfter = e.clientY >= rect.top + rect.height / 2;

            const [dragged] = blocks.splice(draggedIdx, 1);
            let newTargetIdx = targetIdx;
            if (draggedIdx < targetIdx) newTargetIdx--;
            const insertIdx = insertAfter ? newTargetIdx + 1 : newTargetIdx;
            blocks.splice(insertIdx, 0, dragged);

            rerenderCurrentItem(context, itemIndex);
            scheduleSave();
        });
    }

    /* ============================================================
       МЕДИА-РЕДАКТОР (раскрывается под картинкой)
       ============================================================ */

    function setupMediaEditorInline(container, blocks, blockIdx, type, context, itemIndex) {
        const block = blocks[blockIdx];
        if (!block) return;
        const isImage = type === "image";

        const srcInput = container.querySelector(`[data-action='media-src'][data-index='${blockIdx}']`);
        const fileBtn = container.querySelector(`[data-action='media-file'][data-index='${blockIdx}']`);
        const fileInput = container.querySelector(`[data-media-file-input='${blockIdx}']`);
        const dropZone = container.querySelector(`[data-media-drop='${blockIdx}']`);
        const progressWrap = container.querySelector(`[data-media-progress='${blockIdx}']`);
        const progressFill = container.querySelector(`[data-media-fill='${blockIdx}']`);
        const progressText = container.querySelector(`[data-media-text='${blockIdx}']`);
        
        // Инициализация рамок
        if (isImage && container.querySelector(`[data-highlight-editor='${blockIdx}']`)) {
            setupHighlightsEditor(container, block, blockIdx);
        }
        
        if (srcInput && !srcInput.dataset.bound) {
            srcInput.dataset.bound = "1";
            srcInput.addEventListener("input", () => {
                block.src = srcInput.value.trim();
                scheduleSave();
                // Обновляем превью
                const preview = container.querySelector(`[data-media-preview='${blockIdx}']`);
                if (preview) {
                    const img = preview.querySelector("img, video");
                    if (img) img.src = block.src;
                }
            });
        }

        if (fileBtn && fileInput && !fileBtn.dataset.bound) {
            fileBtn.dataset.bound = "1";
            fileBtn.addEventListener("click", () => fileInput.click());
            fileInput.addEventListener("change", () => {
                const f = fileInput.files && fileInput.files[0];
                if (f) uploadMediaInline(f, isImage, block, srcInput, preview_update_after_upload(container, blockIdx), progressWrap, progressFill, progressText);
                fileInput.value = "";
            });
        }

        if (dropZone && !dropZone.dataset.bound) {
            dropZone.dataset.bound = "1";
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
                if (f) uploadMediaInline(f, isImage, block, srcInput, preview_update_after_upload(container, blockIdx), progressWrap, progressFill, progressText);
            });
        }

        // Маркеры на картинке — только для image
        if (isImage && block.markers) {
            setupMarkersInline(container, block, blockIdx);
        }
    }

    function setupHighlightsEditor(container, block, blockIdx) {
        if (!Array.isArray(block.highlights)) block.highlights = [];
        
        const listBox = container.querySelector(`[data-highlight-list='${blockIdx}']`);
        const stageWrap = container.querySelector(`[data-marker-stage-wrap='${blockIdx}']`);
        const addBtn = container.querySelector(`[data-action='highlight-add'][data-index='${blockIdx}']`);
        
        if (!stageWrap || !listBox || !addBtn) return;
        
        let isDrawing = false;
        let startX = 0, startY = 0;
        let tempBox = null;
        let activeBoxIndex = -1;

        const refreshPreview = () => {
            const previewContainer = container.querySelector(`[data-media-preview='${blockIdx}']`);
            if (!previewContainer) return;
            
            // Ищем обертку, если её нет — создаем
            let imgWrap = previewContainer.querySelector('.img-with-markers');
            if (!imgWrap) {
                const img = previewContainer.querySelector("img");
                if (!img) return;
                imgWrap = document.createElement('div');
                imgWrap.className = 'img-with-markers';
                img.parentNode.insertBefore(imgWrap, img);
                imgWrap.appendChild(img);
            }
            
            imgWrap.querySelectorAll('.img-highlight-box').forEach(el => el.remove());
            
            block.highlights.forEach((h, i) => {
                const box = document.createElement('div');
                const colorClass = h.color ? ` color-${h.color}` : ' color-red';
                box.className = 'img-highlight-box' + colorClass;
                
                box.style.left = h.x + '%';
                box.style.top = h.y + '%';
                box.style.width = h.w + '%';
                box.style.height = h.h + '%';
                
                if (i === activeBoxIndex) {
                    box.classList.add('is-editing');
                } else {
                    box.style.pointerEvents = 'auto';
                    box.style.cursor = 'pointer';
                    box.onclick = (e) => {
                        e.stopPropagation();
                        activeBoxIndex = i;
                        refreshPreview();
                        renderList();
                    };
                }
                imgWrap.appendChild(box);
            });
        };

        const renderList = () => {
            listBox.innerHTML = "";
            if (block.highlights.length === 0) {
                listBox.innerHTML = `<div class="img-marker-empty">Рамок пока нет.</div>`;
            } else {
                block.highlights.forEach((h, i) => {
                    const row = document.createElement("div");
                    row.className = "img-marker-item" + (i === activeBoxIndex ? " is-current" : "");
                    if (i === activeBoxIndex) row.style.background = "var(--primary-soft)";
                    
                    const curColor = h.color || "red";
                    
                    row.innerHTML = `
                        <div class="img-marker-item-num" style="background:#e53935;">${i + 1}</div>
                        <div class="img-marker-item-text">
                            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 2px;">X: ${Math.round(h.x)}%, Y: ${Math.round(h.y)}% (${Math.round(h.w)}x${Math.round(h.h)})</div>
                            <div class="highlight-color-picker">
                                <div class="color-dot red ${curColor === 'red' ? 'active' : ''}" data-color="red"></div>
                                <div class="color-dot green ${curColor === 'green' ? 'active' : ''}" data-color="green"></div>
                                <div class="color-dot orange ${curColor === 'orange' ? 'active' : ''}" data-color="orange"></div>
                                <div class="color-dot blue ${curColor === 'blue' ? 'active' : ''}" data-color="blue"></div>
                            </div>
                        </div>
                        <div class="img-marker-item-actions">
                            <button type="button" class="mini-icon-btn del" title="Удалить">✕</button>
                        </div>
                    `;
                    
                    // Обработчик удаления
                    row.querySelector(".mini-icon-btn").onclick = (e) => {
                        e.stopPropagation();
                        if (!confirm("Удалить эту рамку?")) return;
                        block.highlights.splice(i, 1);
                        if (activeBoxIndex === i) activeBoxIndex = -1;
                        scheduleSave();
                        refreshPreview();
                        renderList();
                    };
                    
                    // Обработчики выбора цвета
                    row.querySelectorAll(".color-dot").forEach(dot => {
                        dot.onclick = (e) => {
                            e.stopPropagation();
                            const newColor = dot.dataset.color;
                            block.highlights[i].color = newColor;
                            scheduleSave();
                            refreshPreview();
                            renderList();
                        };
                    });
                    
                    listBox.appendChild(row);
                });
            }
        };

        addBtn.onclick = (e) => {
            e.preventDefault();
            activeBoxIndex = -1;
            renderList();
            refreshPreview();

            const stage = stageWrap.querySelector('.img-marker-stage');
            if (!stage) return;
            
            stage.style.cursor = 'crosshair';
            
            const onMouseDown = (e) => {
                if (e.target.closest('.img-marker') || e.target.closest('.img-highlight-box')) return;
                isDrawing = true;
                const rect = stage.getBoundingClientRect();
                startX = ((e.clientX - rect.left) / rect.width) * 100;
                startY = ((e.clientY - rect.top) / rect.height) * 100;
                
                tempBox = document.createElement('div');
                tempBox.className = 'img-highlight-box color-red';
                tempBox.style.left = startX + '%';
                tempBox.style.top = startY + '%';
                tempBox.style.width = '0%';
                tempBox.style.height = '0%';
                stage.appendChild(tempBox);
            };
            
            const onMouseMove = (e) => {
                if (!isDrawing || !tempBox) return;
                const rect = stage.getBoundingClientRect();
                const curX = ((e.clientX - rect.left) / rect.width) * 100;
                const curY = ((e.clientY - rect.top) / rect.height) * 100;
                
                const w = Math.abs(curX - startX);
                const h = Math.abs(curY - startY);
                tempBox.style.left = Math.min(startX, curX) + '%';
                tempBox.style.top = Math.min(startY, curY) + '%';
                tempBox.style.width = w + '%';
                tempBox.style.height = h + '%';
            };
            
            const onMouseUp = () => {
                if (!isDrawing) return;
                isDrawing = false;
                
                if (tempBox) {
                    const w = parseFloat(tempBox.style.width);
                    const h = parseFloat(tempBox.style.height);
                    if (w > 2 && h > 2) { 
                        block.highlights.push({
                            x: parseFloat(tempBox.style.left),
                            y: parseFloat(tempBox.style.top),
                            w: w,
                            h: h,
                            color: "red"
                        });
                        scheduleSave();
                        activeBoxIndex = block.highlights.length - 1;
                    }
                    tempBox.remove();
                    tempBox = null;
                }
                
                stage.style.cursor = '';
                stage.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                refreshPreview();
                renderList();
            };
            
            stage.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const previewContainer = container.querySelector(`[data-media-preview='${blockIdx}']`);
        if (previewContainer) {
            const imgWrap = previewContainer.querySelector('.img-with-markers') || previewContainer;
            
                        imgWrap.addEventListener('mousedown', (e) => {
                const activeBox = e.target.closest('.img-highlight-box.is-editing');
                if (!activeBox || activeBoxIndex === -1) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                const h = block.highlights[activeBoxIndex];
                if (!h) return;
                
                // Находим саму картинку, чтобы не учитывать рамки и отступы
                const imgEl = imgWrap.querySelector('img') || imgWrap;
                const rect = imgEl.getBoundingClientRect();
                
                let startMouseX = e.clientX;
                let startMouseY = e.clientY;
                const isShift = e.shiftKey; 
                
                // Запоминаем изначальные координаты рамки
                const startX = h.x;
                const startY = h.y;
                const startW = h.w;
                const startH = h.h;
                
                const onMouseMove = (ev) => {
                    const dx = ((ev.clientX - startMouseX) / rect.width) * 100;
                    const dy = ((ev.clientY - startMouseY) / rect.height) * 100;
                    
                    if (isShift) {
                        h.w = Math.max(2, Math.min(100 - h.x, startW + dx));
                        h.h = Math.max(2, Math.min(100 - h.y, startH + dy));
                    } else {
                        h.x = Math.max(0, Math.min(100 - h.w, startX + dx));
                        h.y = Math.max(0, Math.min(100 - h.h, startY + dy));
                    }
                    
                    activeBox.style.left = h.x + '%';
                    activeBox.style.top = h.y + '%';
                    activeBox.style.width = h.w + '%';
                    activeBox.style.height = h.h + '%';
                    
                    const textEl = listBox.querySelector(`.img-marker-item:nth-child(${activeBoxIndex + 1}) .img-marker-item-text div`);
                    if (textEl) {
                        textEl.textContent = `X: ${Math.round(h.x)}%, Y: ${Math.round(h.y)}% (${Math.round(h.w)}x${Math.round(h.h)})`;
                    }
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    scheduleSave();
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        refreshPreview();
        renderList();
    }
        
    function preview_update_after_upload(container, blockIdx) {
        return () => {
            // Просто перерисовываем текущий item
            const wrapper = container.querySelector(`[data-block-index='${blockIdx}']`);
            if (!wrapper) return;
            // Найдём context и itemIndex из обёртки
            const context = wrapper.closest("[data-context]")?.dataset.context;
            const itemIndex = wrapper.closest("[data-item-index]")?.dataset.itemIndex;
            if (context) rerenderCurrentItem(context, itemIndex ? parseInt(itemIndex, 10) : undefined);
        };
    }

    function uploadMediaInline(file, isImage, block, srcInput, onSuccess, progressWrap, progressFill, progressText) {
        const isFileImage = file.type.startsWith("image/");
        const isFileVideo = file.type.startsWith("video/");
        if (isImage && !isFileImage) {
            setStatusInline("⚠ Это не картинка", "err");
            return;
        }
        if (!isImage && !isFileVideo) {
            setStatusInline("⚠ Это не видео", "err");
            return;
        }

        const defaultName = file.name || (isImage ? "image.png" : "video.mp4");
        let name = prompt("Имя файла (с расширением):", defaultName);
        if (!name) return;
        name = name.trim();
        if (!name) return;

        const m = location.pathname.match(/^\/([^\/]+)\//);
        const course = m ? m[1] : COURSE_KEY;
        const uploadType = isImage ? "images" : "videos";

        if (progressWrap) progressWrap.style.display = "block";
        if (progressFill) progressFill.style.width = "0%";
        if (progressText) progressText.textContent = "Загрузка... 0%";

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/upload?course=${encodeURIComponent(course)}&type=${uploadType}&filename=${encodeURIComponent(name)}`);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                if (progressFill) progressFill.style.width = pct + "%";
                if (progressText) progressText.textContent = "Загрузка... " + pct + "%";
            }
        };
        xhr.onload = () => {
            if (progressWrap) progressWrap.style.display = "none";
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    block.src = data.path;
                    if (srcInput) srcInput.value = data.path;
                    scheduleSave();
                    setStatusInline("✓ Загружено: " + data.path, "ok");
                    if (onSuccess) onSuccess();
                } catch (e) {
                    setStatusInline("⚠ Ответ сервера непонятен", "err");
                }
            } else {
                setStatusInline("⚠ Ошибка загрузки: " + xhr.status, "err");
            }
        };
        xhr.onerror = () => {
            if (progressWrap) progressWrap.style.display = "none";
            setStatusInline("⚠ Сервер не запущен", "err");
        };
        xhr.send(file);
    }

    function setupMarkersInline(container, block, blockIdx) {
        const stageWrap = container.querySelector(`[data-marker-stage-wrap='${blockIdx}']`);
        const listBox = container.querySelector(`[data-marker-list='${blockIdx}']`);
        if (!stageWrap || !listBox) return;

        const render = () => {
            stageWrap.innerHTML = "";
            if (!block.src) {
                listBox.innerHTML = `<div class="img-marker-empty">Сначала добавь картинку.</div>`;
                return;
            }
            const stage = document.createElement("div");
            stage.className = "img-marker-stage";
            const img = document.createElement("img");
            img.src = block.src;
            img.alt = "";
            stage.appendChild(img);
            stageWrap.appendChild(stage);

            stage.addEventListener("click", (e) => {
                if (e.target.closest(".img-marker")) return;
                const rect = stage.getBoundingClientRect();
                const xPct = ((e.clientX - rect.left) / rect.width) * 100;
                const yPct = ((e.clientY - rect.top) / rect.height) * 100;
                if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return;
                showMarkerNoteModalInline({
                    initialText: "",
                    onSave: (text) => {
                        block.markers.push({
                            x: Math.round(xPct * 10) / 10,
                            y: Math.round(yPct * 10) / 10,
                            text: text
                        });
                        render();
                        scheduleSave();
                    }
                });
            });

            block.markers.forEach((m, i) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "img-marker";
                btn.style.left = m.x + "%";
                btn.style.top = m.y + "%";
                btn.title = m.text;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    showMarkerNoteModalInline({
                        initialText: m.text,
                        onSave: (text) => {
                            m.text = text;
                            render();
                            scheduleSave();
                        },
                        onDelete: () => {
                            if (!confirm("Удалить маркер?")) return;
                            block.markers.splice(i, 1);
                            render();
                            scheduleSave();
                        }
                    });
                };
                stage.appendChild(btn);
            });

            // Список маркеров
            listBox.innerHTML = "";
            if (block.markers.length === 0) {
                listBox.innerHTML = `<div class="img-marker-empty">Маркеров пока нет. Кликни по картинке выше.</div>`;
            } else {
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
                        showMarkerNoteModalInline({
                            initialText: m.text,
                            onSave: (text) => {
                                m.text = text;
                                render();
                                scheduleSave();
                            }
                        });
                    };
                    row.querySelectorAll("button")[1].onclick = () => {
                        if (!confirm("Удалить маркер?")) return;
                        block.markers.splice(i, 1);
                        render();
                        scheduleSave();
                    };
                    listBox.appendChild(row);
                });
            }
        };
        render();
    }

    /* ============================================================
       WIKI-АВТОКОМПЛИТ
       ============================================================ */

    function insertWikiLinkAtCaret(editable) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!editable.contains(range.startContainer)) return;

        const before = getTextBeforeCaretInline(editable) || "";
        const lastOpen = before.lastIndexOf("[[");
        const lastClose = before.lastIndexOf("]]");
        if (lastOpen > lastClose) return;

        document.execCommand("insertText", false, "[[");
        editable.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function getTextBeforeCaretInline(editable) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!editable.contains(range.startContainer)) return null;
        const preRange = range.cloneRange();
        preRange.selectNodeContents(editable);
        preRange.setEnd(range.startContainer, range.startOffset);
        return preRange.toString();
    }

    function getCaretRectInline(editable) {
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

    function initWikiAutocomplete(editable) {
        if (editable.dataset.wikiBound) return;
        editable.dataset.wikiBound = "1";

        let popup = null;
        let triggerStart = -1;
        let currentItems = [];
        let selectedIdx = 0;
        let ignoreNextInput = false;
        let isPickingFromPopup = false;

        const closePopup = () => {
            if (popup) { popup.remove(); popup = null; }
            triggerStart = -1;
            currentItems = [];
            selectedIdx = 0;
        };

        const renderPopup = () => {
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
                el.innerHTML = `<span class="wiki-ac-icon">${getLessonIcon(item.type)}</span><span class="wiki-ac-title">${escapeHtml(item.title)}</span><span class="wiki-ac-type">${getLessonTypeLabel(item.type)}</span>`;
                el.onmouseenter = () => { selectedIdx = i; renderPopup(); };
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
            hint.innerHTML = `<kbd>↑</kbd><kbd>↓</kbd> · <kbd>Enter</kbd> · <kbd>Esc</kbd>`;
            popup.appendChild(hint);
        };

        const insertItem = (idx) => {
            const item = currentItems[idx];
            if (!item) return;
            if (triggerStart < 0) return;
            replaceWikiTriggerInline(editable, triggerStart, "[[" + item.id + "]]");
            closePopup();
            ignoreNextInput = true;
            setTimeout(() => { ignoreNextInput = false; }, 300);
            editable.focus();
            scheduleSave();
        };

        editable.addEventListener("input", () => {
            if (ignoreNextInput) { ignoreNextInput = false; return; }
            const beforeText = getTextBeforeCaretInline(editable);
            if (beforeText === null) { closePopup(); return; }
            const lastOpen = beforeText.lastIndexOf("[[");
            if (lastOpen === -1) { closePopup(); return; }
            const afterOpen = beforeText.slice(lastOpen + 2);
            if (afterOpen.includes("]]") || afterOpen.includes("|") || afterOpen.includes("\n")) {
                closePopup();
                return;
            }
            triggerStart = lastOpen;
            const q = afterOpen.toLowerCase().trim();
            currentItems = [];
            for (const id in allLessons) {
                const l = allLessons[id];
                const title = l.title || "Без названия";
                if (!q || id.toLowerCase().includes(q) || title.toLowerCase().includes(q)) {
                    currentItems.push({ id, title, type: l.type });
                }
            }
            selectedIdx = 0;

            if (!popup) {
                popup = document.createElement("div");
                popup.className = "wiki-autocomplete";
                document.body.appendChild(popup);
            }
            const rect = getCaretRectInline(editable);
            if (rect) {
                let top = rect.bottom + 4;
                let left = rect.left;
                if (top + 300 > window.innerHeight) top = Math.max(10, rect.top - 304);
                if (left + 420 > window.innerWidth) left = window.innerWidth - 430;
                popup.style.top = top + "px";
                popup.style.left = left + "px";
                renderPopup();
            }
        });

        editable.addEventListener("keydown", (e) => {
            if (!popup) return;
            if (e.key === "Escape") { e.preventDefault(); closePopup(); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); selectedIdx = Math.min(currentItems.length - 1, selectedIdx + 1); renderPopup(); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); selectedIdx = Math.max(0, selectedIdx - 1); renderPopup(); return; }
            if (e.key === "Enter") { if (currentItems.length > 0) { e.preventDefault(); insertItem(selectedIdx); } return; }
            if (e.key === "Tab") { if (currentItems.length > 0) { e.preventDefault(); insertItem(selectedIdx); } return; }
        });

        editable.addEventListener("blur", () => {
            setTimeout(() => {
                if (isPickingFromPopup) return;
                if (popup && document.activeElement !== editable) closePopup();
            }, 150);
        });
    }

    function replaceWikiTriggerInline(editable, triggerStart, replacement) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const currentRange = sel.getRangeAt(0);
        if (!editable.contains(currentRange.startContainer)) return;
        try { editable.normalize(); } catch (e) {}
        const sel2 = window.getSelection();
        if (!sel2 || sel2.rangeCount === 0) return;
        const caretRange = sel2.getRangeAt(0);
        if (!editable.contains(caretRange.startContainer)) return;

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
        if (!startNode) { document.execCommand("insertText", false, replacement); return; }
        const r = document.createRange();
        try {
            r.setStart(startNode, startOffset);
            r.setEnd(caretRange.endContainer, caretRange.endOffset);
        } catch (e) { document.execCommand("insertText", false, replacement); return; }
        try {
            r.deleteContents();
            const textNode = document.createTextNode(replacement);
            r.insertNode(textNode);
            const newRange = document.createRange();
            newRange.setStart(textNode, replacement.length);
            newRange.collapse(true);
            sel2.removeAllRanges();
            sel2.addRange(newRange);
        } catch (e) {
            document.execCommand("insertText", false, replacement);
        }
    }

    /* ============================================================
       ПРИМЕЧАНИЯ — добавление, редактирование, удаление
       ============================================================ */

    let noteModalEl = null;
    let noteEditModalEl = null;

    function openNoteEditorInline(editable, blocks, context, itemIndex) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) { setStatusInline("Сначала выдели текст.", "err"); return; }
        const range = sel.getRangeAt(0);
        if (!editable.contains(range.startContainer)) { setStatusInline("Выделение вне блока.", "err"); return; }
        if (range.collapsed) { setStatusInline("Сначала выдели фрагмент.", "err"); return; }

        const wrapper = editable.closest(".block-wrapper-edit");
        const blockIdx = parseInt(wrapper.dataset.blockIndex, 10);
        const block = blocks[blockIdx];
        if (!block) return;
        if (!Array.isArray(block.notes)) block.notes = [];

        const savedRange = range.cloneRange();

        showNoteModalInline({
            initialText: "",
            onSave: (noteText) => {
                let noteNum = block.notes.indexOf(noteText);
                if (noteNum === -1) {
                    block.notes.push(noteText);
                    noteNum = block.notes.length - 1;
                }
                const marker = "((" + (noteNum + 1) + "))";
                editable.focus();
                const sel2 = window.getSelection();
                sel2.removeAllRanges();
                sel2.addRange(savedRange);
                let inserted = false;
                try { inserted = document.execCommand("insertText", false, marker); } catch (e) {}
                if (!inserted) {
                    const r3 = sel2.getRangeAt(0);
                    r3.collapse(false);
                    const tn = document.createTextNode(marker);
                    r3.insertNode(tn);
                    r3.setStartAfter(tn);
                    r3.collapse(true);
                    sel2.removeAllRanges();
                    sel2.addRange(r3);
                }
                readEditableBlock(wrapper, blocks, context, itemIndex);
                rerenderCurrentItem(context, itemIndex);
                scheduleSave();
                setStatusInline("💬 Примечание добавлено", "ok");
            }
        });
    }

    function openNoteEditModal(editable, blocks, blockIdx, noteIdx, context, itemIndex) {
        const block = blocks[blockIdx];
        if (!block) return;
        if (!Array.isArray(block.notes)) block.notes = [];
        if (noteIdx < 0 || noteIdx >= block.notes.length) return;
        if (noteEditModalEl) noteEditModalEl.remove();

        const overlay = document.createElement("div");
        overlay.className = "note-modal-overlay";
        let listHtml = "";
        block.notes.forEach((t, i) => {
            const isCurrent = i === noteIdx;
            const used = isNoteUsedInline(block, i);
            const cls = "note-modal-list-item" + (isCurrent ? " is-current" : "") + (!used ? " is-unused" : "");
            listHtml += `<div class="${cls}" data-idx="${i}">
                <span class="note-modal-list-num">${i + 1}</span>
                <span class="note-modal-list-text">${escapeHtml(t)}</span>
                ${!used ? `<span class="note-modal-list-badge">удалено</span>` : ""}
            </div>`;
        });

        overlay.innerHTML = `
            <div class="note-modal note-modal-wide">
                <h3 class="note-modal-title">💬 Примечание №${noteIdx + 1}</h3>
                <p class="note-modal-hint">Появится при наведении на маркер в тексте.</p>
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
                openNoteEditModal(editable, blocks, blockIdx, i, context, itemIndex);
            };
        });

        overlay.querySelector('[data-action="cancel"]').onclick = closeNoteEditModal;
        overlay.querySelector('[data-action="delete"]').onclick = () => {
            if (!confirm("Удалить примечание №" + (noteIdx + 1) + "?")) return;
            closeNoteEditModal();
            block.notes.splice(noteIdx, 1);
            rerenderCurrentItem(context, itemIndex);
            scheduleSave();
            setStatusInline("🗑 Примечание удалено", "ok");
        };
        overlay.querySelector('[data-action="save"]').onclick = () => {
            const text = ta.value.trim();
            if (!text) { setStatusInline("Примечание пустое.", "err"); return; }
            block.notes[noteIdx] = text;
            closeNoteEditModal();
            rerenderCurrentItem(context, itemIndex);
            scheduleSave();
            setStatusInline("💬 Примечание обновлено", "ok");
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

    function closeNoteEditModal() {
        if (noteEditModalEl) { noteEditModalEl.remove(); noteEditModalEl = null; }
    }

    function isNoteUsedInline(block, noteIdx) {
        if (!block || !block.text) return false;
        return String(block.text).indexOf("((" + (noteIdx + 1) + "))") !== -1;
    }

    function showNoteModalInline({ initialText, onSave }) {
        if (noteModalEl) noteModalEl.remove();
        const overlay = document.createElement("div");
        overlay.className = "note-modal-overlay";
        overlay.innerHTML = `
            <div class="note-modal">
                <h3 class="note-modal-title">💬 Примечание</h3>
                <p class="note-modal-hint">Появится при наведении на выделенный фрагмент.</p>
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
        overlay.querySelector('[data-action="cancel"]').onclick = () => { noteModalEl.remove(); noteModalEl = null; };
        overlay.querySelector('[data-action="save"]').onclick = () => {
            const text = ta.value.trim();
            if (!text) { setStatusInline("Примечание пустое.", "err"); return; }
            noteModalEl.remove();
            noteModalEl = null;
            onSave(text);
        };
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) { noteModalEl.remove(); noteModalEl = null; } });
    }

    /* ============================================================
       МАРКЕРЫ — модалка
       ============================================================ */

    let markerNoteModalEl = null;

    function showMarkerNoteModalInline({ initialText, onSave, onDelete }) {
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
        overlay.querySelector('[data-action="cancel"]').onclick = closeMarkerNoteModalInline;
        overlay.querySelector('[data-action="save"]').onclick = () => {
            const text = ta.value.trim();
            if (!text) { setStatusInline("Примечание пустое.", "err"); return; }
            closeMarkerNoteModalInline();
            onSave(text);
        };
        const delBtn = overlay.querySelector('[data-action="delete"]');
        if (delBtn && onDelete) {
            delBtn.onclick = () => { closeMarkerNoteModalInline(); onDelete(); };
        }
        overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeMarkerNoteModalInline(); });
        ta.addEventListener("keydown", (e) => {
            if (e.key === "Escape") { e.preventDefault(); closeMarkerNoteModalInline(); }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                overlay.querySelector('[data-action="save"]').click();
            }
        });
    }

    function closeMarkerNoteModalInline() {
        if (markerNoteModalEl) { markerNoteModalEl.remove(); markerNoteModalEl = null; }
    }

    /* ============================================================
       INLINE-РЕДАКТИРОВАНИЕ НАЗВАНИЙ
       ============================================================ */

    startInlineEditLessonTitle = function (el, lessonId) {
        if (currentMode !== "author") return;
        if (el.dataset.editing) return;
        el.dataset.editing = "1";
        el.classList.add("editing");
        el.contentEditable = "true";
        el.focus();

        // Выделяем весь текст
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finish = (save) => {
            el.contentEditable = "false";
            el.classList.remove("editing");
            delete el.dataset.editing;
            if (save) {
                const newTitle = el.textContent.trim() || "Без названия";
                if (allLessons[lessonId]) {
                    allLessons[lessonId].title = newTitle;
                    el.textContent = newTitle;
                    scheduleSave();
                    renderMenu();
                }
            } else {
                renderMenu();
            }
        };
        el.addEventListener("blur", () => finish(true), { once: true });
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); el.blur(); }
            if (e.key === "Escape") { e.preventDefault(); finish(false); }
        });
    };
    window.startInlineEditLessonTitle = startInlineEditLessonTitle;

    startInlineEditSlideTitle = function (el, slideIdx) {
        if (currentMode !== "author") return;
        if (el.dataset.editing) return;
        el.dataset.editing = "1";
        el.classList.add("editing");
        el.contentEditable = "true";
        el.focus();

        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const lesson = currentLesson();
        const finish = (save) => {
            el.contentEditable = "false";
            el.classList.remove("editing");
            delete el.dataset.editing;
            if (save && lesson && lesson.slides && lesson.slides[slideIdx]) {
                lesson.slides[slideIdx].title = el.textContent.trim() || "Без названия";
                scheduleSave();
                renderTopicList();
            }
        };
        el.addEventListener("blur", () => finish(true), { once: true });
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); el.blur(); }
            if (e.key === "Escape") { e.preventDefault(); finish(false); }
        });
    };
    window.startInlineEditSlideTitle = startInlineEditSlideTitle;

    /* ============================================================
       КОНТЕКСТНОЕ МЕНЮ БЛОКА КУРСА
       ============================================================ */

    openLessonContextMenu = function (event, id) {
        event.stopPropagation();
        const old = $("lesson-ctx-menu");
        if (old) old.remove();
        const ids = Object.keys(allLessons);
        const index = ids.indexOf(id);
        if (index === -1) return;

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
            upBtn.onclick = () => { menu.remove(); moveLessonInline(id, -1); };
            menu.appendChild(upBtn);
        }
        if (index < ids.length - 1) {
            const dnBtn = document.createElement("button");
            dnBtn.textContent = "↓ Переместить вниз";
            dnBtn.onclick = () => { menu.remove(); moveLessonInline(id, 1); };
            menu.appendChild(dnBtn);
        }
        const dupBtn = document.createElement("button");
        dupBtn.textContent = "📋 Дублировать";
        dupBtn.onclick = () => { menu.remove(); duplicateLessonInline(id); };
        menu.appendChild(dupBtn);
        const expBtn = document.createElement("button");
        expBtn.textContent = "📤 Экспортировать блок";
        expBtn.onclick = () => { menu.remove(); exportLessonInline(id); };
        menu.appendChild(expBtn);
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕ Удалить блок";
        delBtn.style.color = "var(--error)";
        delBtn.onclick = () => { menu.remove(); deleteLessonInline(id); };
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
    };
    window.openLessonContextMenu = openLessonContextMenu;

    function moveLessonInline(id, direction) {
        const ids = Object.keys(allLessons);
        const index = ids.indexOf(id);
        const ni = index + direction;
        if (ni < 0 || ni >= ids.length) return;
        const entries = Object.entries(allLessons);
        const [moved] = entries.splice(index, 1);
        entries.splice(ni, 0, moved);
        for (const k in allLessons) delete allLessons[k];
        entries.forEach(([k, v]) => { allLessons[k] = v; });
        renderMenu();
        scheduleSave();
    }

    function duplicateLessonInline(id) {
        const original = allLessons[id];
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        copy.title = (copy.title || "Без названия") + " (копия)";
        let baseKey = id + "_copy";
        let finalKey = baseKey;
        let n = 1;
        while (allLessons[finalKey]) { finalKey = baseKey + "_" + n; n++; if (n > 1000) return; }
        const entries = Object.entries(allLessons);
        const index = entries.findIndex(([k]) => k === id);
        entries.splice(index + 1, 0, [finalKey, copy]);
        for (const k in allLessons) delete allLessons[k];
        entries.forEach(([k, v]) => { allLessons[k] = v; });
        renderMenu();
        scheduleSave();
        setStatusInline("📋 Копия блока создана", "ok");
    }

    function deleteLessonInline(id) {
        const ids = Object.keys(allLessons);
        if (ids.length <= 1) { alert("Нельзя удалить единственный блок."); return; }
        if (!confirm("Удалить блок «" + allLessons[id].title + "»?")) return;
        delete allLessons[id];
        if (currentLessonId === id) currentLessonId = null;
        renderMenu();
        scheduleSave();
    }

    /* ============================================================
       КОНТЕКСТНОЕ МЕНЮ СЛАЙДА
       ============================================================ */

    openSlideContextMenu = function (event, index) {
        event.stopPropagation();
        const old = $("slide-ctx-menu");
        if (old) old.remove();
        const lesson = currentLesson();
        if (!lesson) return;
        const slides = lesson.slides || [];

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
            upBtn.onclick = () => { menu.remove(); moveSlideInline(index, -1); };
            menu.appendChild(upBtn);
        }
        if (index < slides.length - 1) {
            const dnBtn = document.createElement("button");
            dnBtn.textContent = "↓ Переместить вниз";
            dnBtn.onclick = () => { menu.remove(); moveSlideInline(index, 1); };
            menu.appendChild(dnBtn);
        }
        const dupBtn = document.createElement("button");
        dupBtn.textContent = "📋 Дублировать";
        dupBtn.onclick = () => { menu.remove(); duplicateSlideInline(index); };
        menu.appendChild(dupBtn);
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕ Удалить слайд";
        delBtn.style.color = "var(--error)";
        delBtn.onclick = () => { menu.remove(); deleteSlideInline(index); };
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
    };
    window.openSlideContextMenu = openSlideContextMenu;

    function moveSlideInline(index, dir) {
        const lesson = currentLesson();
        if (!lesson || !lesson.slides) return;
        const ni = index + dir;
        if (ni < 0 || ni >= lesson.slides.length) return;
        const [it] = lesson.slides.splice(index, 1);
        lesson.slides.splice(ni, 0, it);
        if (currentSlide === index) currentSlide = ni;
        else if (currentSlide === ni) currentSlide = index;
        renderSlide();
        scheduleSave();
    }

    function duplicateSlideInline(index) {
        const lesson = currentLesson();
        if (!lesson || !lesson.slides) return;
        const copy = JSON.parse(JSON.stringify(lesson.slides[index]));
        copy.title = (copy.title || "Без названия") + " (копия)";
        copy.shortName = (copy.shortName || "Без названия") + " (копия)";
        lesson.slides.splice(index + 1, 0, copy);
        currentSlide = index + 1;
        renderSlide();
        scheduleSave();
        setStatusInline("📋 Слайд скопирован", "ok");
    }

    function deleteSlideInline(index) {
        const lesson = currentLesson();
        if (!lesson || !lesson.slides) return;
        if (lesson.slides.length <= 1) { alert("Нельзя удалить единственный слайд."); return; }
        if (!confirm("Удалить слайд?")) return;
        lesson.slides.splice(index, 1);
        if (currentSlide >= lesson.slides.length) currentSlide = lesson.slides.length - 1;
        renderSlide();
        scheduleSave();
    }

    /* ============================================================
       ДОБАВЛЕНИЕ БЛОКОВ КУРСА / СЛАЙДОВ / ЯЧЕЕК / ТЕРМИНОВ
       ============================================================ */

    addLesson = function (type) {
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
                randomizeQuestions: false, randomizeOptions: false, groups: [],
                questions: [{
                    type: "single", text: "Первый вопрос?",
                    options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
                    correct: ["Вариант A"], explain: "Объяснение.", group: null
                }]
            };
        } else if (type === "memo") {
            allLessons[key] = {
                type: "memo", title: "Новая памятка",
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
                type: "glossary", title: "Новый глоссарий",
                terms: [{ name: "Новый термин", content: [{ type: "p", text: "Определение термина." }] }]
            };
        } else {
            allLessons[key] = {
                type: "theory", title: "Новый блок",
                slides: [{ shortName: "Новый слайд", title: "Новый слайд", content: [{ type: "p", text: "Текст нового слайда." }] }]
            };
        }
        renderMenu();
        scheduleSave();
    };
    window.addLesson = addLesson;

    addSlide = function () {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "theory") return;
        if (!lesson.slides) lesson.slides = [];
        lesson.slides.push({ shortName: "Новый слайд", title: "Новый слайд", content: [{ type: "p", text: "Текст нового слайда." }] });
        currentSlide = lesson.slides.length - 1;
        renderSlide();
        scheduleSave();
    };
    window.addSlide = addSlide;

    addMemoCell = function () {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "memo") return;
        if (!lesson.cells) lesson.cells = [];
        if (lesson.cells.length >= 8) { alert("Максимум 8 ячеек."); return; }
        lesson.cells.push({
            title: "НОВАЯ ЯЧЕЙКА",
            content: [{ type: "p", text: "Текст ячейки." }]
        });
        renderMemo(lesson);
        scheduleSave();
    };
    window.addMemoCell = addMemoCell;

    deleteMemoCell = function (idx) {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "memo") return;
        if (!lesson.cells || lesson.cells.length <= 1) { alert("Нельзя удалить единственную ячейку."); return; }
        if (!confirm("Удалить ячейку?")) return;
        lesson.cells.splice(idx, 1);
        renderMemo(lesson);
        scheduleSave();
    };
    window.deleteMemoCell = deleteMemoCell;

    deleteTerm = function (idx) {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "glossary") return;
        if (!lesson.terms || lesson.terms.length <= 1) { alert("Нельзя удалить единственный термин."); return; }
        if (!confirm("Удалить термин?")) return;
        lesson.terms.splice(idx, 1);
        if (glossaryState.selectedTermIndex >= lesson.terms.length) {
            glossaryState.selectedTermIndex = lesson.terms.length - 1;
        }
        renderGlossary(lesson);
        scheduleSave();
    };
    window.deleteTerm = deleteTerm;

    /* ============================================================
       ДОБАВЛЕНИЕ БЛОКОВ КОНТЕНТА
       ============================================================ */

    function makeNewBlockInline(type) {
        if (type === "p") return { type: "p", text: "Новый абзац" };
        if (type === "h3") return { type: "h3", text: "Новый подзаголовок" };
        if (type === "ul") return { type: "ul", style: "bullet", items: [
            { text: "Первый пункт", level: 0 },
            { text: "Второй пункт", level: 0 },
            { text: "Третий пункт", level: 0 }
        ]};
        if (type === "quote") return { type: "quote", text: "Выделенная мысль" };
        if (type === "link") return { type: "link", text: "Текст ссылки", href: "https://" };
        if (type === "image") return { type: "image", src: "", alt: "", markers: [] };
        if (type === "video") return { type: "video", src: "" };
        if (type === "table") return { type: "table", header: true, rows: [
            ["Заголовок 1", "Заголовок 2"], ["", ""], ["", ""]
        ]};
        return { type: "p", text: "" };
    }

    addBlock = function (type) {
        const lesson = currentLesson();
        if (!lesson) return;
        const slide = lesson.slides && lesson.slides[currentSlide];
        if (!slide) return;
        slide.content = slide.content || [];
        slide.content.push(makeNewBlockInline(type));
        renderSlide();
        scheduleSave();
    };
    window.addBlock = addBlock;

    addMemoBlock = function (type) {
        const lesson = currentLesson();
        if (!lesson) return;
        // В памятке блоки добавляем к выбранной ячейке
        const cell = lesson.cells && lesson.cells[0];
        if (!cell) return;
        cell.content = cell.content || [];
        cell.content.push(makeNewBlockInline(type));
        renderMemo(lesson);
        scheduleSave();
    };
    window.addMemoBlock = addMemoBlock;

    addTermBlock = function (type) {
        const lesson = currentLesson();
        if (!lesson) return;
        const term = lesson.terms && lesson.terms[glossaryState.selectedTermIndex];
        if (!term) return;
        term.content = term.content || [];
        term.content.push(makeNewBlockInline(type));
        renderGlossary(lesson);
        scheduleSave();
    };
    window.addTermBlock = addTermBlock;

    /* ============================================================
       МОДАЛКИ: описание/обложка блока, настройки курса
       ============================================================ */

    openPreviewEditor = function (lessonId) {
        const lesson = allLessons[lessonId];
        if (!lesson) return;
        if (!window.openModal) return;

        const html = `
            <h3 class="modal-title">Настройки блока</h3>
            <div class="modal-field">
                <label>Название блока</label>
                <input type="text" class="input" id="modal-lesson-title" value="${escapeAttr(lesson.title || "")}">
            </div>
            <div class="modal-field">
                <label>Краткое описание</label>
                <textarea class="input" id="modal-lesson-desc" rows="3" placeholder="Например: Как эффективно общаться">${escapeHtml(lesson.description || "")}</textarea>
            </div>
            <div class="modal-field">
                <label>Фоновая картинка (путь или URL)</label>
                <input type="text" class="input" id="modal-lesson-cover" value="${escapeAttr(lesson.coverImage || "")}" placeholder="images/cover.png">
                <div style="margin-top:8px;">
                    <button type="button" class="btn btn-outline" id="modal-lesson-cover-btn">📁 Выбрать файл</button>
                    <input type="file" id="modal-lesson-cover-file" accept="image/*" style="display:none;">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-text" onclick="closeModal()">Отмена</button>
                <button type="button" class="btn btn-primary" id="modal-lesson-save">Сохранить</button>
            </div>
        `;
        window.openModal(html);

        const titleInp = $("modal-lesson-title");
        const descInp = $("modal-lesson-desc");
        const coverInp = $("modal-lesson-cover");
        const coverBtn = $("modal-lesson-cover-btn");
        const coverFile = $("modal-lesson-cover-file");

        if (coverBtn && coverFile) {
            coverBtn.onclick = () => coverFile.click();
            coverFile.onchange = () => {
                const f = coverFile.files && coverFile.files[0];
                if (!f) return;
                const name = prompt("Имя файла:", f.name) || f.name;
                const m = location.pathname.match(/^\/([^\/]+)\//);
                const course = m ? m[1] : COURSE_KEY;
                const fd = new FormData();
                fd.append("file", f);
                const xhr = new XMLHttpRequest();
                xhr.open("POST", `/upload?course=${encodeURIComponent(course)}&type=images&filename=${encodeURIComponent(name)}`);
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            coverInp.value = data.path;
                        } catch (e) {}
                    }
                };
                xhr.send(f);
            };
        }

        $("modal-lesson-save").onclick = () => {
            lesson.title = titleInp.value.trim() || "Без названия";
            lesson.description = descInp.value.trim();
            lesson.coverImage = coverInp.value.trim();
            if (!lesson.description) delete lesson.description;
            if (!lesson.coverImage) delete lesson.coverImage;
            window.closeModal();
            renderMenu();
            scheduleSave();
        };
    };
    window.openPreviewEditor = openPreviewEditor;

    openCourseSettings = function () {
        if (!window.openModal) return;
        const html = `
            <h3 class="modal-title">Настройки курса</h3>
            <div class="modal-field">
                <label>Название курса</label>
                <input type="text" class="input" id="modal-course-title" value="${escapeAttr(courseSettings.courseTitle || "")}">
            </div>
            <div class="modal-field">
                <label>Заголовок вкладки браузера</label>
                <input type="text" class="input" id="modal-page-title" value="${escapeAttr(courseSettings.pageTitle || "")}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-text" onclick="closeModal()">Отмена</button>
                <button type="button" class="btn btn-primary" id="modal-course-save">Сохранить</button>
            </div>
        `;
        window.openModal(html);
        $("modal-course-save").onclick = () => {
            courseSettings.courseTitle = $("modal-course-title").value.trim() || "Курс";
            courseSettings.pageTitle = $("modal-page-title").value.trim() || "Курс";
            document.title = courseSettings.pageTitle;
            if (courseTitleEl) courseTitleEl.textContent = courseSettings.courseTitle;
            const topbarTitleEl = $("topbar-title");
            if (topbarTitleEl) topbarTitleEl.textContent = courseSettings.courseTitle;
            window.closeModal();
            scheduleSave();
        };
    };
    window.openCourseSettings = openCourseSettings;

    /* ============================================================
       ЧАСТЬ 3 — СБОР ДАННЫХ, СОХРАНЕНИЕ, МОДАЛКИ, CSV, ФИНАЛ
       ============================================================ */

    /* ============================================================
       ВСПОМОГАТЕЛЬНОЕ — СТАТУС, ТЕМА, DROPDOWN
       ============================================================ */

    setStatus = function (text, type) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = "status" + (type ? " " + type : "");
        statusEl.classList.add("show");
        clearTimeout(setStatus._t);
        setStatus._t = setTimeout(() => statusEl.classList.remove("show"), 6000);
    };
    window.setStatus = setStatus;
    const setStatusInline = setStatus;
    window.setStatusInline = setStatusInline;

    function applyThemeInline(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        const btn = $("theme-btn");
        if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    }

    toggleTheme = function () {
        const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
        const next = cur === "dark" ? "light" : "dark";
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        applyThemeInline(next);
    };
    window.toggleTheme = toggleTheme;

    toggleDropdown = function (event, menuId) {
        event.stopPropagation();
        const menu = $(menuId);
        if (!menu) return;
        const isOpen = menu.classList.contains("show");
        closeAllDropdowns();
        if (!isOpen) menu.classList.add("show");
    };
    window.toggleDropdown = toggleDropdown;

    closeAllDropdowns = function () {
        document.querySelectorAll(".dropdown-menu.show").forEach(m => m.classList.remove("show"));
    };
    window.closeAllDropdowns = closeAllDropdowns;

    document.addEventListener("click", (e) => {
        if (!e.target.closest(".dropdown-wrap")) {
            closeAllDropdowns();
        }
    });

    /* ============================================================
       УНИВЕРСАЛЬНАЯ МОДАЛКА
       ============================================================ */

    openModal = function (innerHtml, opts) {
        const overlay = $("modal-overlay");
        const body = $("modal-body");
        const card = $("modal-card");
        if (!overlay || !body || !card) return;
        body.innerHTML = innerHtml;
        card.classList.toggle("modal-wide", !!(opts && opts.wide));
        overlay.classList.add("show");
        document.body.style.overflow = "hidden";
    };
    window.openModal = openModal;

    closeModal = function () {
        const overlay = $("modal-overlay");
        if (!overlay) return;
        overlay.classList.remove("show");
        document.body.style.overflow = "";
    };
    window.closeModal = closeModal;

    closeModalIfOutside = function (event) {
        if (event.target.id === "modal-overlay") closeModal();
    };
    window.closeModalIfOutside = closeModalIfOutside;

    /* ============================================================
       СБОР ДАННЫХ ИЗ DOM (сейчас не используется, но нужен для buildDataJs)
       ============================================================ */

    function readFromDomInline() {
        // В новой архитектуре данные — это и есть allLessons/courseSettings,
        // которые правятся напрямую. Никакого отдельного «сбора из формы» нет.
        // Функция оставлена как заглушка для совместимости с buildDataJs.
    }
       function updateTimestamps() {
        const now = new Date().toISOString();
        const lesson = currentLesson();
        if (!lesson) return;
        
        // Обновляем дату только у ТЕКУЩЕГО слайда/ячейки/термина
        if (lesson.type === "theory" && lesson.slides && lesson.slides[currentSlide]) {
            lesson.slides[currentSlide]._editedAt = now;
        } else if (lesson.type === "memo" && lesson.cells && lesson.cells[currentSlide]) {
            lesson.cells[currentSlide]._editedAt = now;
        } else if (lesson.type === "glossary" && lesson.terms && lesson.terms[glossaryState.selectedTermIndex]) {
            lesson.terms[glossaryState.selectedTermIndex]._editedAt = now;
        }
    }
    function buildDataJs() {
        const sJ = JSON.stringify(courseSettings, null, 4)
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
        const lJ = JSON.stringify(allLessons, null, 4)
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
        return "// ============================================================\n" +
               "// ДАННЫЕ КУРСА\n" +
               "// Редактируется через app.html (режим «Редактор»).\n" +
               "// courseKey — уникальный ключ курса, не менять!\n" +
               "// ============================================================\n\n" +
               "const courseSettings = " + sJ + ";\n\n" +
               "const allLessons = " + lJ + ";\n";
    }

    /* ============================================================
       СОХРАНЕНИЕ НА СЕРВЕР
       ============================================================ */

    let autoSaveInFlight = false;
    let autoSavePending = false;
    let changeTimer = null;

    async function fetchWithTimeoutInline(url, options) {
        options = options || {};
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async function autoSaveToServerInline() {
        if (autoSaveInFlight) { autoSavePending = true; return; }
        autoSaveInFlight = true;
        try {
            const content = buildDataJs();
            const res = await fetchWithTimeoutInline("/save-data", {
                method: "POST",
                headers: { "Content-Type": "text/javascript; charset=utf-8" },
                body: content
            });
            if (!res.ok) throw new Error(await res.text() || ("HTTP " + res.status));
            try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        } catch (e) {
            console.warn("Автосохранение не удалось:", e);
        } finally {
            autoSaveInFlight = false;
            if (autoSavePending) {
                autoSavePending = false;
                autoSaveToServerInline();
            }
        }
    }

    scheduleSave = function () {
        if (currentMode !== "author") return;
        clearTimeout(changeTimer);
        changeTimer = setTimeout(() => {
            updateTimestamps(); 
            saveDraftInline();
            autoSaveToServerInline();
        }, 500);
    };
    window.scheduleSave = scheduleSave;

    function saveDraftInline() {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({
                allLessons: allLessons,
                courseSettings: courseSettings
            }));
        } catch (e) {}
    }

    saveToFile = async function () {
        const content = buildDataJs();
        try {
            const res = await fetchWithTimeoutInline("/save-data", {
                method: "POST",
                headers: { "Content-Type": "text/javascript; charset=utf-8" },
                body: content
            });
            if (!res.ok) throw new Error(await res.text() || ("HTTP " + res.status));
            try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
            setStatus("✓ data.js сохранён на сервере", "ok");
        } catch (e) {
            console.warn(e);
            setStatus("⚠ Сервер недоступен. Используй «📤 Скачать».", "err");
        }
    };
    window.saveToFile = saveToFile;

    downloadData = function () {
        const content = buildDataJs();
        const b = new Blob([content], { type: "text/javascript;charset=utf-8" });
        const u = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = u;
        a.download = "data.js";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(u), 1000);
        setStatus("📤 data.js скачан", "ok");
    };
    window.downloadData = downloadData;

    reloadFromFile = function () {
        if (!confirm("Откатить к data.js? Несохранённые изменения потеряются.")) return;
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        location.reload();
    };
    window.reloadFromFile = reloadFromFile;

    /* ============================================================
       ПРИМЕНЕНИЕ ЧЕРНОВИКА ПРИ СТАРТЕ (автор)
       ============================================================ */

    (function applyDraftIfAuthor() {
        if (currentMode !== "author") return;
        try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (!draft) return;
            const parsed = JSON.parse(draft);
            if (parsed && parsed.allLessons) {
                for (const k in allLessons) delete allLessons[k];
                for (const k in parsed.allLessons) allLessons[k] = parsed.allLessons[k];
            }
            if (parsed && parsed.courseSettings) {
                for (const k in courseSettings) delete courseSettings[k];
                for (const k in parsed.courseSettings) courseSettings[k] = parsed.courseSettings[k];
            }
            setStatus("Продолжаем с несохранённого черновика", "warn");
        } catch (e) {}
    })();

    /* ============================================================
       CSV ГЛОССАРИЯ
       ============================================================ */

    function termContentToTextInline(blocks) {
        const lines = [];
        (blocks || []).forEach(b => {
            if (b.type === "p" || b.type === "h3" || b.type === "quote") {
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

    function textToTermContentInline(text) {
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
                    blocks.push({ type: "ul", style: "bullet", items: [{ text: itemText, level: 0 }] });
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

    exportGlossaryCsv = function () {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "glossary") {
            setStatus("Экспорт доступен только для глоссария.", "err");
            return;
        }
        const terms = lesson.terms || [];
        if (terms.length === 0) { setStatus("В глоссарии нет терминов.", "err"); return; }
        const lines = [];
        terms.forEach(term => {
            const name = String(term.name || "").trim();
            const content = termContentToTextInline(term.content);
            lines.push(csvEscape(name) + ";" + csvEscape(content));
        });
        const content = "\uFEFF" + lines.join("\r\n");
        const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeName = (COURSE_KEY || "glossary").replace(/[^a-zA-Z0-9._-]/g, "_");
        a.href = url;
        a.download = safeName + "_glossary.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("📤 Экспортировано терминов: " + terms.length, "ok");
    };
    window.exportGlossaryCsv = exportGlossaryCsv;

    importGlossaryCsv = function () {
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
                    reader2.onload = () => processGlossaryCsvInline(String(reader2.result || ""));
                    reader2.readAsText(file, "windows-1251");
                } else {
                    processGlossaryCsvInline(text);
                }
            };
            reader.readAsText(file, "utf-8");
        };
        input.click();
    };
    window.importGlossaryCsv = importGlossaryCsv;

    function processGlossaryCsvInline(text) {
        const parsed = parseCsvInline(text);
        const rows = parsed.rows;
        if (rows.length === 0) { setStatus("Файл пустой.", "err"); return; }
        let startRow = 0;
        const firstRow = rows[0] || [];
        const firstCell = String(firstRow[0] || "").trim().toLowerCase();
        if (firstCell === "термин" || firstCell === "term" || firstCell === "name") startRow = 1;
        const terms = [];
        for (let r = startRow; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const name = String(row[0] || "").trim();
            if (!name) continue;
            const content = textToTermContentInline(String(row[1] || "").trim());
            terms.push({ name, content });
        }
        if (terms.length === 0) { setStatus("Не найдено ни одного термина.", "err"); return; }
        const choice = confirm("Найдено: " + terms.length + ".\n\nОК — ЗАМЕНИТЬ.\nОтмена — ДОБАВИТЬ.");
        const lesson = currentLesson();
        if (choice) { lesson.terms = terms; glossaryState.selectedTermIndex = 0; }
        else {
            if (!lesson.terms) lesson.terms = [];
            lesson.terms = lesson.terms.concat(terms);
        }
        renderGlossary(lesson);
        scheduleSave();
        setStatus("📥 Импортировано: " + terms.length, "ok");
    }

    /* ============================================================
       CSV ТЕСТА — ШАБЛОНЫ, ПАРСЕР
       ============================================================ */

    const CSV_TEMPLATES_INLINE = {
        single_multi: {
            filename: "template_single_multi.csv",
            content: [
                "type;text;option1;option2;option3;option4;correct;explain;group",
                "single;Какой артикль перед cat?;A;An;The;-;A;Перед согласными — A;Артикли",
                "multi;Выберите гласные;A;E;F;G;A|E;A и E — гласные;Буквы",
                "single;Пример без объяснения;Да;Нет;;;Да;;"
            ].join("\r\n")
        },
        match: {
            filename: "template_match.csv",
            content: [
                "text;pair1_left;pair1_right;pair2_left;pair2_right;pair3_left;pair3_right;pair4_left;pair4_right;pair5_left;pair5_right;explain;group",
                "Соедини слово и перевод;nature;природа;wool;шерсть;fault;вина;version;версия;create;создать;;Слова"
            ].join("\r\n")
        },
        card: {
            filename: "template_card.csv",
            content: [
                "front;frontImage;back;backImage;group",
                "nature;images/nature.png;природа;;Слова",
                "wool;;шерсть;;Слова"
            ].join("\r\n")
        }
    };

    function parseCsvLineInline(line, delim) {
        const cells = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; }
                    else inQuotes = false;
                } else cur += ch;
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === delim) { cells.push(cur); cur = ""; }
                else cur += ch;
            }
        }
        cells.push(cur);
        return cells;
    }

    function parseCsvInline(text) {
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
            rows.push(parseCsvLineInline(line, delim));
        }
        return { rows, delim };
    }

    openCsvTemplates = function () {
        const body = $("csv-modal-body");
        if (!body) return;
        let html = `<h2>📄 Шаблоны CSV</h2>`;
        html += `<p class="csv-modal-desc">Скачай шаблон, заполни, сохрани как CSV (разделитель — «;»).</p>`;
        html += `<div class="csv-samples">`;
        html += `<div class="csv-samples-item"><strong>single_multi</strong> — один/несколько ответов.</div>`;
        html += `<div class="csv-samples-item"><strong>match</strong> — соответствие. До 5 пар.</div>`;
        html += `<div class="csv-samples-item"><strong>card</strong> — карточки.</div>`;
        html += `</div>`;
        html += `<div class="csv-modal-actions">`;
        html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('single_multi')">📥 single/multi</button>`;
        html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('match')">📥 match</button>`;
        html += `<button class="btn btn-outline" onclick="downloadCsvTemplate('card')">📥 card</button>`;
        html += `<button class="btn btn-text" onclick="closeCsvModal()">Закрыть</button>`;
        html += `</div>`;
        body.innerHTML = html;
        $("csv-overlay").classList.add("show");
    };
    window.openCsvTemplates = openCsvTemplates;

    downloadCsvTemplate = function (key) {
        const tpl = CSV_TEMPLATES_INLINE[key];
        if (!tpl) return;
        const content = "\uFEFF" + tpl.content;
        const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = tpl.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus("📥 Шаблон скачан", "ok");
    };
    window.downloadCsvTemplate = downloadCsvTemplate;

    let csvImportState = null;

    openCsvImport = function () {
        csvImportState = null;
        renderCsvImportStep1Inline();
        $("csv-overlay").classList.add("show");
    };
    window.openCsvImport = openCsvImport;

    function renderCsvImportStep1Inline() {
        const body = $("csv-modal-body");
        let html = `<h2>📥 Импорт вопросов из CSV</h2>`;
        html += `<p class="csv-modal-desc">Выбери тип вопросов или автоопределение.</p>`;
        html += `<div class="csv-type-grid">`;
        html += `<button class="csv-type-card" onclick="csvPickType('single_multi')"><div class="csv-type-icon">✏</div><div class="csv-type-title">Один / Несколько</div><div class="csv-type-desc">Вопросы с выбором</div></button>`;
        html += `<button class="csv-type-card" onclick="csvPickType('match')"><div class="csv-type-icon">🔗</div><div class="csv-type-title">Соответствие</div><div class="csv-type-desc">Соединить пары</div></button>`;
        html += `<button class="csv-type-card" onclick="csvPickType('card')"><div class="csv-type-icon">🎴</div><div class="csv-type-title">Карточки</div><div class="csv-type-desc">Передняя и задняя</div></button>`;
        html += `</div>`;
        html += `<div class="csv-modal-actions">`;
        html += `<button class="btn btn-outline" onclick="csvPickType('auto')">🔍 Определить автоматически</button>`;
        html += `<button class="btn btn-text" onclick="closeCsvModal()">Отмена</button>`;
        html += `</div>`;
        body.innerHTML = html;
    }

    csvPickType = function (kind) {
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
                    reader2.onload = () => processCsvTextInline(String(reader2.result || ""), kind, file.name);
                    reader2.readAsText(file, "windows-1251");
                } else {
                    processCsvTextInline(text, kind, file.name);
                }
            };
            reader.readAsText(file, "utf-8");
        };
        input.click();
    };
    window.csvPickType = csvPickType;

    function detectCsvKindInline(headers) {
        const h = headers.map(x => String(x || "").trim().toLowerCase());
        if (h.includes("front") && h.includes("back")) return "card";
        if (h.some(x => x.startsWith("pair1_"))) return "match";
        if (h.includes("type") && h.includes("correct")) return "single_multi";
        return null;
    }

    function processCsvTextInline(text, kind, fileName) {
        const parsed = parseCsvInline(text);
        const rows = parsed.rows;
        if (rows.length < 2) { renderCsvErrorInline("Файл пустой или только заголовок."); return; }
        const headers = rows[0];
        if (kind === "auto") {
            const detected = detectCsvKindInline(headers);
            if (!detected) { renderCsvErrorInline("Не удалось определить тип."); return; }
            kind = detected;
        }
        let questions = [];
        let errors = [];
        let kindLabel = "";

        const idx = {};
        headers.forEach((h, i) => { idx[String(h || "").trim().toLowerCase()] = i; });

        if (kind === "single_multi") {
            kindLabel = "Один / Несколько";
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const lineNum = r + 1;
                const typeRaw = (row[idx["type"]] || "").trim().toLowerCase();
                const type = typeRaw === "multi" ? "multi" : (typeRaw === "single" ? "single" : null);
                if (!type) { errors.push("Строка " + lineNum + ": неизвестный тип"); continue; }
                const qText = (row[idx["text"]] || "").trim();
                if (!qText) { errors.push("Строка " + lineNum + ": пустой текст"); continue; }
                const options = [];
                for (let k = 1; k <= 10; k++) {
                    const ci = idx["option" + k];
                    if (ci === undefined) continue;
                    const val = (row[ci] || "").trim();
                    if (val) options.push(val);
                }
                if (options.length < 2) { errors.push("Строка " + lineNum + ": < 2 вариантов"); continue; }
                const correctRaw = (row[idx["correct"]] || "").trim();
                if (!correctRaw) { errors.push("Строка " + lineNum + ": пустой correct"); continue; }
                const correctParts = correctRaw.split("|").map(s => s.trim()).filter(Boolean);
                const bad = correctParts.filter(c => !options.includes(c));
                if (bad.length) { errors.push("Строка " + lineNum + ": ответы не найдены"); continue; }
                const explain = (row[idx["explain"]] || "").trim();
                const group = (row[idx["group"]] || "").trim() || null;
                questions.push({ type, text: qText, options, correct: correctParts, explain, group });
            }
        } else if (kind === "match") {
            kindLabel = "Соответствие";
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const lineNum = r + 1;
                const qText = (row[idx["text"]] || "").trim() || "Соедини пары";
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
                questions.push({ type: "match", text: qText, pairs, explain, group });
            }
        } else if (kind === "card") {
            kindLabel = "Карточки";
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                const lineNum = r + 1;
                const front = (row[idx["front"]] || "").trim();
                const back = (row[idx["back"]] || "").trim();
                if (!front && !back) continue;
                if (!front || !back) { errors.push("Строка " + lineNum + ": пустая сторона"); continue; }
                const frontImage = (row[idx["frontimage"]] || "").trim();
                const backImage = (row[idx["backimage"]] || "").trim();
                const group = (row[idx["group"]] || "").trim() || null;
                questions.push({ type: "card", front, frontImage, back, backImage, group });
            }
        } else {
            renderCsvErrorInline("Неизвестный тип: " + kind);
            return;
        }

        csvImportState = { kind, kindLabel, fileName, questions, errors };
        renderCsvImportStep2Inline();
    }

    function renderCsvImportStep2Inline() {
        const st = csvImportState;
        if (!st) return;
        const body = $("csv-modal-body");
        const total = st.questions.length + st.errors.length;

        let html = `<h2>📥 Импорт: проверка</h2>`;
        html += `<p class="csv-modal-desc">Файл: <strong>${escapeHtml(st.fileName)}</strong> · Тип: ${escapeHtml(st.kindLabel)}</p>`;
        html += `<div class="csv-preview">`;
        html += `<div class="csv-preview-row"><span>Всего</span><strong>${total}</strong></div>`;
        html += `<div class="csv-preview-row"><span class="csv-preview-ok">✓ Валидных</span><strong class="csv-preview-ok">${st.questions.length}</strong></div>`;
        html += `<div class="csv-preview-row"><span class="csv-preview-err">✗ Ошибок</span><strong class="csv-preview-err">${st.errors.length}</strong></div>`;
        html += `</div>`;
        if (st.errors.length > 0) {
            html += `<div class="csv-error-list"><div class="csv-error-title">Ошибки:</div>`;
            st.errors.forEach(e => { html += `<div class="csv-error-item">• ${escapeHtml(e)}</div>`; });
            html += `</div>`;
        }
        if (st.questions.length === 0) {
            html += `<div class="csv-modal-actions">`;
            html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
            html += `<button class="btn btn-text" onclick="closeCsvModal()">Закрыть</button>`;
            html += `</div>`;
            body.innerHTML = html;
            return;
        }

        html += `<div class="csv-modal-actions">`;
        html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
        html += `<button class="btn btn-outline" onclick="csvApplyImport('replace')">Заменить все</button>`;
        html += `<button class="btn btn-primary" onclick="csvApplyImport('append')">Добавить к текущим</button>`;
        html += `</div>`;
        body.innerHTML = html;
    }

    csvBackToStep1 = function () {
        csvImportState = null;
        renderCsvImportStep1Inline();
    };
    window.csvBackToStep1 = csvBackToStep1;

    csvApplyImport = function (mode) {
        if (!csvImportState) return;
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "quiz") {
            renderCsvErrorInline("Импорт возможен только в тест.");
            return;
        }
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

        const cnt = csvImportState.questions.length;
        csvImportState = null;
        closeCsvModal();
        // Обновить редактор теста
        renderQuizEditorInline();
        setStatus("📥 Импортировано: " + cnt, "ok");
        scheduleSave();
    };
    window.csvApplyImport = csvApplyImport;

    function renderCsvErrorInline(msg) {
        const body = $("csv-modal-body");
        let html = `<h2>Ошибка</h2>`;
        html += `<p class="csv-modal-desc">${escapeHtml(msg)}</p>`;
        html += `<div class="csv-modal-actions">`;
        html += `<button class="btn btn-text" onclick="csvBackToStep1()">← Назад</button>`;
        html += `<button class="btn btn-primary" onclick="closeCsvModal()">Закрыть</button>`;
        html += `</div>`;
        body.innerHTML = html;
    }

    closeCsvModal = function () {
        const overlay = $("csv-overlay");
        if (overlay) overlay.classList.remove("show");
        csvImportState = null;
    };
    window.closeCsvModal = closeCsvModal;

    closeCsvIfOutside = function (event) {
        if (event.target.id === "csv-overlay") closeCsvModal();
    };
    window.closeCsvIfOutside = closeCsvIfOutside;

    /* ============================================================
       ЭКСПОРТ / ИМПОРТ БЛОКА И КУРСА
       ============================================================ */

    function downloadJsonInline(filename, obj) {
        const content = JSON.stringify(obj, null, 4);
        const blob = new Blob([content], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportLessonInline(id) {
        const lesson = allLessons[id];
        if (!lesson) { setStatus("Ошибка: блок не найден", "err"); return; }
        const payload = { _type: "kp_block_export", _version: 1, lesson: lesson };
        downloadJsonInline("block_" + id + ".json", payload);
        setStatus("📤 Экспортирован блок", "ok");
    }

    exportCourse = function () {
        const payload = { _type: "kp_course_export", _version: 1, courseSettings, allLessons };
        downloadJsonInline("course_export.json", payload);
        setStatus("📤 Экспортирован курс", "ok");
    };
    window.exportCourse = exportCourse;

    importLesson = function () {
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
                        setStatus("Это не файл блока курса", "err");
                        return;
                    }
                    const lesson = data.lesson;
                    if (!["theory", "quiz", "memo", "glossary"].includes(lesson.type)) {
                        setStatus("Неизвестный тип блока", "err");
                        return;
                    }
                    let originalKey = null;
                    const m = file.name.match(/^block_(.+)\.json$/i);
                    if (m && m[1]) originalKey = m[1];
                    const baseKey = originalKey || (lesson.type === "quiz" ? "new_quiz" : (lesson.type === "memo" ? "new_memo" : (lesson.type === "glossary" ? "new_glossary" : "new_lesson")));
                    let finalKey = baseKey;
                    let n = 1;
                    while (allLessons[finalKey]) { finalKey = baseKey + "_" + n; n++; }
                    allLessons[finalKey] = lesson;
                    renderMenu();
                    scheduleSave();
                    setStatus("📥 Импортирован блок: " + lesson.title, "ok");
                } catch (e) {
                    setStatus("Ошибка чтения файла: " + e.message, "err");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    window.importLesson = importLesson;

    importCourse = function () {
        if (!confirm("Импорт всего курса ЗАМЕНИТ всё. Продолжить?")) return;
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
                        setStatus("Это не файл курса", "err");
                        return;
                    }
                    if (!data.allLessons) {
                        setStatus("В файле нет allLessons", "err");
                        return;
                    }
                    for (const k in allLessons) delete allLessons[k];
                    for (const k in data.allLessons) allLessons[k] = data.allLessons[k];
                    if (data.courseSettings) {
                        for (const k in courseSettings) delete courseSettings[k];
                        for (const k in data.courseSettings) courseSettings[k] = data.courseSettings[k];
                    }
                    try { localStorage.removeItem(PROGRESS_KEY); } catch (e) {}
                    renderMenu();
                    scheduleSave();
                    setStatus("📥 Курс импортирован", "ok");
                } catch (e) {
                    setStatus("Ошибка чтения: " + e.message, "err");
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    window.importCourse = importCourse;

    /* ============================================================
       РЕДАКТОР ТЕСТА — МОДАЛКА
       ============================================================ */

    openQuizEditor = function () {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "quiz") return;
        const overlay = $("quiz-editor-overlay");
        const body = $("quiz-editor-body");
        if (!overlay || !body) return;
        overlay.classList.add("show");
        renderQuizEditorInline();
    };
    window.openQuizEditor = openQuizEditor;

    closeQuizEditor = function () {
        const overlay = $("quiz-editor-overlay");
        if (overlay) overlay.classList.remove("show");
    };
    window.closeQuizEditor = closeQuizEditor;

    closeQuizEditorIfOutside = function (event) {
        if (event.target.id === "quiz-editor-overlay") closeQuizEditor();
    };
    window.closeQuizEditorIfOutside = closeQuizEditorIfOutside;

    function renderQuizEditorInline() {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "quiz") return;
        const body = $("quiz-editor-body");
        if (!body) return;

        // Группы
        let groupsHtml = "";
        if (!lesson.groups) lesson.groups = [];
        if (lesson.groups.length === 0) {
            groupsHtml = `<div class="groups-empty">Пока ни одной группы.</div>`;
        } else {
            lesson.groups.forEach((g, i) => {
                groupsHtml += `<div class="group-row-edit">
                    <input type="text" value="${escapeAttr(g)}" data-action="group-input" data-idx="${i}">
                    <button type="button" class="mini-icon-btn del" data-action="group-del" data-idx="${i}">✕</button>
                </div>`;
            });
        }

        // Вопросы
        let questionsHtml = "";
        lesson.questions = lesson.questions || [];
        lesson.questions.forEach((q, i) => {
            questionsHtml += renderQuizQuestionEditorHTML(q, i, lesson);
        });

        body.innerHTML = `
            <h2 style="margin:0 0 6px;font-size:20px;font-weight:700;color:var(--text-strong);">✎ Редактор теста</h2>
            <p style="font-size:13px;color:var(--text-muted);margin:0 0 16px;">Блок «${escapeHtml(lesson.title || "")}» · ${lesson.questions.length} вопросов</p>

            <div class="form-card" style="margin-bottom:16px;">
                <div class="form-card-header"><div class="icon-badge">🎲</div><div class="form-card-title">Настройки порядка</div></div>
                <label class="q-toggle">
                    <input type="checkbox" data-action="randomize-q" ${lesson.randomizeQuestions ? "checked" : ""}>
                    <span>Перемешивать вопросы</span>
                </label>
                <label class="q-toggle">
                    <input type="checkbox" data-action="randomize-o" ${lesson.randomizeOptions ? "checked" : ""}>
                    <span>Перемешивать варианты ответов</span>
                </label>
            </div>

            <div class="form-card" style="margin-bottom:16px;">
                <div class="form-card-header"><div class="icon-badge">📂</div><div class="form-card-title">Группы вопросов</div></div>
                <div id="quiz-editor-groups">${groupsHtml}</div>
                <div style="margin-top:12px;">
                    <button type="button" class="btn btn-outline" data-action="group-add">＋ Добавить группу</button>
                </div>
            </div>

            <div class="form-card" style="margin-bottom:16px;">
                <div class="form-card-header"><div class="icon-badge">📝</div><div class="form-card-title">Вопросы</div></div>
                <div id="quiz-editor-questions">${questionsHtml}</div>
                <div style="margin-top:16px;">
                    <button type="button" class="btn btn-primary" data-action="question-add">＋ Добавить вопрос</button>
                </div>
                <div class="csv-actions-row">
                    <button type="button" class="btn btn-outline" data-action="csv-import">📥 Импорт из CSV</button>
                    <button type="button" class="btn btn-outline" data-action="csv-templates">📄 Скачать шаблоны CSV</button>
                </div>
            </div>

            <div class="modal-actions" style="border-top:1px solid var(--border);padding-top:16px;">
                <button type="button" class="btn btn-text" onclick="closeQuizEditor()">Закрыть</button>
            </div>
        `;

        attachQuizEditorHandlers(body, lesson);
    }

    function renderQuizQuestionEditorHTML(q, index, lesson) {
        const type = q.type || "single";
        let bodyHtml = "";
        if (type === "single" || type === "multi") {
            let optionsHtml = "";
            (q.options || []).forEach((opt, j) => {
                const isCorrect = (q.correct || []).includes(opt);
                optionsHtml += `<div class="q-option ${isCorrect ? 'correct-row' : ''}">
                    <input type="checkbox" ${isCorrect ? "checked" : ""} data-action="opt-correct" data-q="${index}" data-opt="${j}">
                    <input type="text" class="q-opt-text" value="${escapeAttr(opt)}" data-action="opt-text" data-q="${index}" data-opt="${j}" placeholder="Вариант ${j + 1}">
                    <div class="opt-tools">
                        <button type="button" class="mini-icon-btn" data-action="opt-add" data-q="${index}" data-opt="${j}">＋</button>
                        <button type="button" class="mini-icon-btn del" data-action="opt-del" data-q="${index}" data-opt="${j}">✕</button>
                    </div>
                </div>`;
            });
            bodyHtml = `
                <textarea class="input q-text" data-action="q-text" data-q="${index}" placeholder="Текст вопроса">${escapeHtml(q.text || "")}</textarea>
                <div class="q-options" style="margin-top:12px;">${optionsHtml}</div>
                <div class="q-explain-label" style="margin-top:12px;">💡 Объяснение</div>
                <textarea class="q-explain" data-action="q-explain" data-q="${index}" placeholder="Почему это правильно">${escapeHtml(q.explain || "")}</textarea>
            `;
        } else if (type === "match") {
            let pairsHtml = "";
            (q.pairs || []).forEach((p, j) => {
                pairsHtml += `<div class="match-pair-row">
                    <input type="text" class="match-left" value="${escapeAttr(p.left || "")}" data-action="pair-left" data-q="${index}" data-pair="${j}" placeholder="Левая">
                    <span class="match-pair-arrow">↔</span>
                    <input type="text" class="match-right" value="${escapeAttr(p.right || "")}" data-action="pair-right" data-q="${index}" data-pair="${j}" placeholder="Правая">
                    <button type="button" class="mini-icon-btn del" data-action="pair-del" data-q="${index}" data-pair="${j}">✕</button>
                </div>`;
            });
            bodyHtml = `
                <textarea class="input q-text" data-action="q-text" data-q="${index}" placeholder="Инструкция">${escapeHtml(q.text || "")}</textarea>
                <div class="q-explain-label" style="margin-top:12px;">Пары</div>
                <div class="match-pairs-editor">${pairsHtml}</div>
                <div style="margin-top:8px;">
                    <button type="button" class="btn btn-outline" data-action="pair-add" data-q="${index}" style="padding:6px 14px;font-size:13px;">＋ Добавить пару</button>
                </div>
                <div class="q-explain-label" style="margin-top:12px;">💡 Объяснение</div>
                <textarea class="q-explain" data-action="q-explain" data-q="${index}">${escapeHtml(q.explain || "")}</textarea>
            `;
        } else if (type === "card") {
            bodyHtml = `
                <div class="card-editor-section">
                    <div class="card-editor-section-title">Передняя сторона</div>
                    <div class="card-editor-field"><label>Текст</label>
                        <textarea class="input card-front" data-action="card-front" data-q="${index}">${escapeHtml(q.front || "")}</textarea>
                    </div>
                    <div class="card-editor-field"><label>Картинка</label>
                        <input type="text" class="input card-front-image" value="${escapeAttr(q.frontImage || "")}" data-action="card-front-image" data-q="${index}" placeholder="images/front.png">
                    </div>
                </div>
                <div class="card-editor-section">
                    <div class="card-editor-section-title">Задняя сторона</div>
                    <div class="card-editor-field"><label>Текст</label>
                        <textarea class="input card-back" data-action="card-back" data-q="${index}">${escapeHtml(q.back || "")}</textarea>
                    </div>
                    <div class="card-editor-field"><label>Картинка</label>
                        <input type="text" class="input card-back-image" value="${escapeAttr(q.backImage || "")}" data-action="card-back-image" data-q="${index}" placeholder="images/back.png">
                    </div>
                </div>
            `;
        }

        let groupSelectHtml = "";
        if (lesson.groups && lesson.groups.length > 0) {
            let opts = `<option value="">— Без группы —</option>`;
            lesson.groups.forEach(g => {
                opts += `<option value="${escapeAttr(g)}"${q.group === g ? " selected" : ""}>${escapeHtml(g)}</option>`;
            });
            groupSelectHtml = `<div class="q-group-row"><label>📂 Группа:</label><select data-action="q-group" data-q="${index}">${opts}</select></div>`;
        }

        const typeLabel = { single: "Один ответ", multi: "Несколько", match: "Соответствие", card: "Карточка" }[type] || type;

        return `
            <div class="q-item" data-q-index="${index}" data-type="${type}">
                <div class="q-header">
                    <div class="q-header-left">
                        <span>Вопрос ${index + 1}</span>
                        <select class="q-type-select" data-action="q-type" data-q="${index}">
                            <option value="single"${type === "single" ? " selected" : ""}>Один ответ</option>
                            <option value="multi"${type === "multi" ? " selected" : ""}>Несколько ответов</option>
                            <option value="match"${type === "match" ? " selected" : ""}>Соответствие</option>
                            <option value="card"${type === "card" ? " selected" : ""}>Карточка</option>
                        </select>
                    </div>
                    <div class="q-tools">
                        <button type="button" class="mini-icon-btn" data-action="q-up" data-q="${index}">↑</button>
                        <button type="button" class="mini-icon-btn" data-action="q-down" data-q="${index}">↓</button>
                        <button type="button" class="mini-icon-btn" data-action="q-dup" data-q="${index}">📋</button>
                        <button type="button" class="mini-icon-btn del" data-action="q-del" data-q="${index}">✕</button>
                    </div>
                </div>
                ${groupSelectHtml}
                <div class="q-body">${bodyHtml}</div>
            </div>
        `;
    }

    function attachQuizEditorHandlers(body, lesson) {
        // Randomize
        body.querySelectorAll("[data-action='randomize-q']").forEach(cb => {
            cb.addEventListener("change", () => {
                lesson.randomizeQuestions = cb.checked;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='randomize-o']").forEach(cb => {
            cb.addEventListener("change", () => {
                lesson.randomizeOptions = cb.checked;
                scheduleSave();
            });
        });

        // Группы
        body.querySelectorAll("[data-action='group-input']").forEach(inp => {
            inp.addEventListener("input", () => {
                const i = parseInt(inp.dataset.idx, 10);
                lesson.groups[i] = inp.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='group-del']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.idx, 10);
                if (!confirm("Удалить группу?")) return;
                const name = lesson.groups[i];
                lesson.groups.splice(i, 1);
                lesson.questions.forEach(q => { if (q.group === name) q.group = null; });
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelector("[data-action='group-add']").addEventListener("click", () => {
            if (!lesson.groups) lesson.groups = [];
            lesson.groups.push("Новая группа");
            renderQuizEditorInline();
            scheduleSave();
        });

        // Вопросы
        body.querySelectorAll("[data-action='q-text']").forEach(el => {
            el.addEventListener("input", () => {
                const i = parseInt(el.dataset.q, 10);
                lesson.questions[i].text = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-explain']").forEach(el => {
            el.addEventListener("input", () => {
                const i = parseInt(el.dataset.q, 10);
                lesson.questions[i].explain = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-group']").forEach(sel => {
            sel.addEventListener("change", () => {
                const i = parseInt(sel.dataset.q, 10);
                lesson.questions[i].group = sel.value || null;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-type']").forEach(sel => {
            sel.addEventListener("change", () => {
                const i = parseInt(sel.dataset.q, 10);
                if (!confirm("Сменить тип вопроса? Содержимое заменится на шаблон.")) {
                    renderQuizEditorInline();
                    return;
                }
                const newType = sel.value;
                const common = { type: newType, group: lesson.questions[i].group || null };
                if (newType === "single" || newType === "multi") {
                    common.text = "Новый вопрос?";
                    common.options = ["Вариант A", "Вариант B", "Вариант C", "Вариант D"];
                    common.correct = ["Вариант A"];
                    common.explain = "";
                } else if (newType === "match") {
                    common.text = "Соедини пары";
                    common.pairs = [
                        { left: "Слово 1", right: "Перевод 1" },
                        { left: "Слово 2", right: "Перевод 2" }
                    ];
                } else {
                    common.front = "nature";
                    common.frontImage = "";
                    common.back = "природа";
                    common.backImage = "";
                }
                lesson.questions[i] = common;
                renderQuizEditorInline();
                scheduleSave();
            });
        });

        // Вопросы — перемещение/дублирование/удаление
        body.querySelectorAll("[data-action='q-up']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                if (i <= 0) return;
                const [it] = lesson.questions.splice(i, 1);
                lesson.questions.splice(i - 1, 0, it);
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-down']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                if (i >= lesson.questions.length - 1) return;
                const [it] = lesson.questions.splice(i, 1);
                lesson.questions.splice(i + 1, 0, it);
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-dup']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                const copy = JSON.parse(JSON.stringify(lesson.questions[i]));
                if (copy.text) copy.text += " (копия)";
                lesson.questions.splice(i + 1, 0, copy);
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='q-del']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                if (lesson.questions.length <= 1) { alert("Нельзя удалить единственный вопрос."); return; }
                if (!confirm("Удалить вопрос?")) return;
                lesson.questions.splice(i, 1);
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelector("[data-action='question-add']").addEventListener("click", () => {
            lesson.questions.push({
                type: "single",
                text: "Новый вопрос?",
                options: ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],
                correct: ["Вариант A"],
                explain: "",
                group: (lesson.groups && lesson.groups[0]) || null
            });
            renderQuizEditorInline();
            scheduleSave();
        });

        // Опции
        body.querySelectorAll("[data-action='opt-text']").forEach(el => {
            el.addEventListener("input", () => {
                const i = parseInt(el.dataset.q, 10);
                const j = parseInt(el.dataset.opt, 10);
                const oldVal = lesson.questions[i].options[j];
                lesson.questions[i].options[j] = el.value;
                // Обновляем correct
                const correctArr = lesson.questions[i].correct || [];
                const ci = correctArr.indexOf(oldVal);
                if (ci !== -1) correctArr[ci] = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='opt-correct']").forEach(cb => {
            cb.addEventListener("change", () => {
                const i = parseInt(cb.dataset.q, 10);
                const j = parseInt(cb.dataset.opt, 10);
                const q = lesson.questions[i];
                const optText = q.options[j];
                if (cb.checked) {
                    if (q.type === "single") {
                        q.correct = [optText];
                        // Снять остальные галки
                        body.querySelectorAll(`[data-action='opt-correct'][data-q='${i}']`).forEach(otherCb => {
                            if (otherCb !== cb) {
                                otherCb.checked = false;
                                otherCb.closest(".q-option").classList.remove("correct-row");
                            }
                        });
                    } else {
                        if (!q.correct.includes(optText)) q.correct.push(optText);
                    }
                    cb.closest(".q-option").classList.add("correct-row");
                } else {
                    q.correct = (q.correct || []).filter(c => c !== optText);
                    if (q.correct.length === 0) q.correct = [q.options[0]];
                    cb.closest(".q-option").classList.remove("correct-row");
                }
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='opt-add']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                const j = parseInt(btn.dataset.opt, 10);
                lesson.questions[i].options.splice(j + 1, 0, "Новый вариант");
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='opt-del']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                const j = parseInt(btn.dataset.opt, 10);
                const q = lesson.questions[i];
                if (q.options.length <= 2) { alert("Минимум 2 варианта."); return; }
                const removedText = q.options[j];
                q.options.splice(j, 1);
                q.correct = (q.correct || []).filter(c => c !== removedText);
                if (q.correct.length === 0) q.correct = [q.options[0]];
                renderQuizEditorInline();
                scheduleSave();
            });
        });

        // Match
        body.querySelectorAll("[data-action='pair-left']").forEach(el => {
            el.addEventListener("input", () => {
                const i = parseInt(el.dataset.q, 10);
                const j = parseInt(el.dataset.pair, 10);
                lesson.questions[i].pairs[j].left = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='pair-right']").forEach(el => {
            el.addEventListener("input", () => {
                const i = parseInt(el.dataset.q, 10);
                const j = parseInt(el.dataset.pair, 10);
                lesson.questions[i].pairs[j].right = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='pair-add']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                lesson.questions[i].pairs.push({ left: "", right: "" });
                renderQuizEditorInline();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='pair-del']").forEach(btn => {
            btn.addEventListener("click", () => {
                const i = parseInt(btn.dataset.q, 10);
                const j = parseInt(btn.dataset.pair, 10);
                if ((lesson.questions[i].pairs || []).length <= 1) { alert("Минимум 1 пара."); return; }
                lesson.questions[i].pairs.splice(j, 1);
                renderQuizEditorInline();
                scheduleSave();
            });
        });

        // Card
        body.querySelectorAll("[data-action='card-front']").forEach(el => {
            el.addEventListener("input", () => {
                lesson.questions[parseInt(el.dataset.q, 10)].front = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='card-back']").forEach(el => {
            el.addEventListener("input", () => {
                lesson.questions[parseInt(el.dataset.q, 10)].back = el.value;
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='card-front-image']").forEach(el => {
            el.addEventListener("input", () => {
                lesson.questions[parseInt(el.dataset.q, 10)].frontImage = el.value.trim();
                scheduleSave();
            });
        });
        body.querySelectorAll("[data-action='card-back-image']").forEach(el => {
            el.addEventListener("input", () => {
                lesson.questions[parseInt(el.dataset.q, 10)].backImage = el.value.trim();
                scheduleSave();
            });
        });

        // CSV
        body.querySelector("[data-action='csv-import']").addEventListener("click", () => {
            openCsvImport();
        });
        body.querySelector("[data-action='csv-templates']").addEventListener("click", () => {
            openCsvTemplates();
        });
    }

    /* ============================================================
       ПЕРЕКЛЮЧЕНИЕ РЕЖИМА (вызывается из app.js)
       ============================================================ */

    // Уже определено в Части 1 как setModeInternal и window.setModeInternal.

    /* ============================================================
       ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ
       ============================================================ */

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if ($("csv-overlay") && $("csv-overlay").classList.contains("show")) closeCsvModal();
            if ($("quiz-editor-overlay") && $("quiz-editor-overlay").classList.contains("show")) closeQuizEditor();
            if ($("modal-overlay") && $("modal-overlay").classList.contains("show")) closeModal();
            const ctx1 = $("lesson-ctx-menu");
            if (ctx1) ctx1.remove();
            const ctx2 = $("slide-ctx-menu");
            if (ctx2) ctx2.remove();
            if (noteModalEl) { noteModalEl.remove(); noteModalEl = null; }
            if (noteEditModalEl) { noteEditModalEl.remove(); noteEditModalEl = null; }
            if (markerNoteModalEl) { markerNoteModalEl.remove(); markerNoteModalEl = null; }
        }
        if (e.key === "d" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            if (currentMode !== "author") return;
            const t = e.target;
            const inInput = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
            if (inInput) return;
            const lesson = currentLesson();
            if (lesson && lesson.type === "theory") {
                e.preventDefault();
                duplicateSlideInline(currentSlide);
            }
        }
        if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
            const t = e.target;
            if (t && t.isContentEditable && currentMode === "author") {
                e.preventDefault();
                insertWikiLinkAtCaret(t);
                scheduleSave();
            }
        }
    });

    /* ============================================================
       СЛУШАЕМ СМЕНУ РЕЖИМА (MutationObserver на data-app-mode)
       ============================================================ */

    const modeObserver = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.attributeName === "data-app-mode") {
                const newMode = getMode();
                if (newMode !== currentMode) {
                    currentMode = newMode;
                    updateTopicListTitle();
                    rerenderCurrentScreen();
                }
            }
        });
    });
    modeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-app-mode"] });

    /* ============================================================
       СТАРТ
       ============================================================ */

    // Первый рендер уже сделан в Части 1 (renderMenu при currentMode === "reader").
    // Если мы в авторе — перерисуем меню.
    if (READER_AVAILABLE && currentMode === "author") {
        renderMenu();
    }

    /* ============================================================
       КОНТЕКСТНОЕ МЕНЮ ЯЧЕЙКИ ПАМЯТКИ
       ============================================================ */

    function openMemoCellContextMenu(event, index) {
        event.stopPropagation();
        const old = $("memo-ctx-menu");
        if (old) old.remove();
        const lesson = currentLesson();
        if (!lesson || !lesson.cells) return;
        const cells = lesson.cells;

        const menu = document.createElement("div");
        menu.className = "dropdown-menu show";
        menu.id = "memo-ctx-menu";
        menu.style.position = "fixed";
        menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + "px";
        menu.style.top = (event.clientY + 4) + "px";
        menu.style.zIndex = "1000";

        if (index > 0) {
            const upBtn = document.createElement("button");
            upBtn.textContent = "↑ Переместить вверх";
            upBtn.onclick = () => { menu.remove(); moveMemoCellInline(index, -1); };
            menu.appendChild(upBtn);
        }
        if (index < cells.length - 1) {
            const dnBtn = document.createElement("button");
            dnBtn.textContent = "↓ Переместить вниз";
            dnBtn.onclick = () => { menu.remove(); moveMemoCellInline(index, 1); };
            menu.appendChild(dnBtn);
        }
        const dupBtn = document.createElement("button");
        dupBtn.textContent = "📋 Дублировать";
        dupBtn.onclick = () => { menu.remove(); duplicateMemoCellInline(index); };
        menu.appendChild(dupBtn);
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕ Удалить ячейку";
        delBtn.style.color = "var(--error)";
        delBtn.onclick = () => { menu.remove(); deleteMemoCell(index); };
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

    function moveMemoCellInline(index, dir) {
        const lesson = currentLesson();
        if (!lesson || !lesson.cells) return;
        const ni = index + dir;
        if (ni < 0 || ni >= lesson.cells.length) return;
        const [it] = lesson.cells.splice(index, 1);
        lesson.cells.splice(ni, 0, it);
        renderMemo(lesson);
        scheduleSave();
    }

    function duplicateMemoCellInline(index) {
        const lesson = currentLesson();
        if (!lesson || !lesson.cells) return;
        if (lesson.cells.length >= 8) { alert("Максимум 8 ячеек."); return; }
        const copy = JSON.parse(JSON.stringify(lesson.cells[index]));
        copy.title = (copy.title || "Без названия") + " (копия)";
        lesson.cells.splice(index + 1, 0, copy);
        renderMemo(lesson);
        scheduleSave();
        setStatus("📋 Ячейка скопирована", "ok");
    }

    /* ============================================================
       КОНТЕКСТНОЕ МЕНЮ ТЕРМИНА
       ============================================================ */

    function openTermContextMenu(event, index) {
        event.stopPropagation();
        const old = $("term-ctx-menu");
        if (old) old.remove();
        const lesson = currentLesson();
        if (!lesson || !lesson.terms) return;
        const terms = lesson.terms;

        const menu = document.createElement("div");
        menu.className = "dropdown-menu show";
        menu.id = "term-ctx-menu";
        menu.style.position = "fixed";
        menu.style.left = Math.min(event.clientX, window.innerWidth - 220) + "px";
        menu.style.top = (event.clientY + 4) + "px";
        menu.style.zIndex = "1000";

        if (index > 0) {
            const upBtn = document.createElement("button");
            upBtn.textContent = "↑ Переместить вверх";
            upBtn.onclick = () => { menu.remove(); moveTermInline(index, -1); };
            menu.appendChild(upBtn);
        }
        if (index < terms.length - 1) {
            const dnBtn = document.createElement("button");
            dnBtn.textContent = "↓ Переместить вниз";
            dnBtn.onclick = () => { menu.remove(); moveTermInline(index, 1); };
            menu.appendChild(dnBtn);
        }
        const dupBtn = document.createElement("button");
        dupBtn.textContent = "📋 Дублировать";
        dupBtn.onclick = () => { menu.remove(); duplicateTermInline(index); };
        menu.appendChild(dupBtn);
        const delBtn = document.createElement("button");
        delBtn.textContent = "✕ Удалить термин";
        delBtn.style.color = "var(--error)";
        delBtn.onclick = () => { menu.remove(); deleteTerm(index); };
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

    function moveTermInline(index, dir) {
        const lesson = currentLesson();
        if (!lesson || !lesson.terms) return;
        const ni = index + dir;
        if (ni < 0 || ni >= lesson.terms.length) return;
        const [it] = lesson.terms.splice(index, 1);
        lesson.terms.splice(ni, 0, it);
        if (glossaryState.selectedTermIndex === index) glossaryState.selectedTermIndex = ni;
        else if (glossaryState.selectedTermIndex === ni) glossaryState.selectedTermIndex = index;
        renderGlossary(lesson);
        scheduleSave();
    }

    function duplicateTermInline(index) {
        const lesson = currentLesson();
        if (!lesson || !lesson.terms) return;
        const copy = JSON.parse(JSON.stringify(lesson.terms[index]));
        copy.name = (copy.name || "Без названия") + " (копия)";
        lesson.terms.splice(index + 1, 0, copy);
        renderGlossary(lesson);
        scheduleSave();
        setStatus("📋 Термин скопирован", "ok");
    }

    function addTerm() {
        const lesson = currentLesson();
        if (!lesson || lesson.type !== "glossary") return;
        if (!lesson.terms) lesson.terms = [];
        lesson.terms.push({
            name: "Новый термин",
            content: [{ type: "p", text: "Определение термина." }]
        });
        glossaryState.selectedTermIndex = lesson.terms.length - 1;
        renderGlossary(lesson);
        scheduleSave();
    }

    window.openMemoCellContextMenu = openMemoCellContextMenu;
    window.openTermContextMenu = openTermContextMenu;
    window.addTerm = addTerm;
    })();