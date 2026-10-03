/* ============================================================
   ADMIN.JS — логика редактора курса
   Требуется: data.js загружен ДО этого файла (allLessons, courseSettings)
   ============================================================ */

let state = { currentLessonId: null, currentSlideIndex: 0 };
const DRAFT_KEY = "kp_course_draft_v1";
const THEME_KEY = "kp_course_theme";
const PROGRESS_KEY = "kp_course_v1";
const MAX_MEMO_CELLS = 8;
const MAX_TABLE_ROWS = 10;
const MAX_TABLE_COLS = 10;
let pvState = null;

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
        });
    }
});

Object.values(allLessons).forEach(lesson => {
    if (lesson.type === "theory" && lesson.slides) {
        lesson.slides.forEach(slide => {
            if (!slide.content) slide.content = [];
            if (slide.video && slide.video.trim()) {
                const hasVideo = slide.content.some(b => b.type === "video");
                if (!hasVideo) slide.content.unshift({ type: "video", src: slide.video });
                slide.video = "";
            }
            if (slide.image && slide.image.trim()) {
                const hasImage = slide.content.some(b => b.type === "image");
                if (!hasImage) slide.content.unshift({ type: "image", src: slide.image, alt: "" });
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
                        });
                    }
                });
                setStatus("Продолжаем с несохранённого черновика", "warn");
            }
        } catch (e) {}
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
    document.getElementById("lesson-title-input").value = lesson.title;
    const typeLabels = { quiz: "Тест", theory: "Теория", memo: "Памятка" };
    document.getElementById("lesson-type-display").value = typeLabels[lesson.type] || lesson.type;

    document.getElementById("theory-editor").style.display = "none";
    document.getElementById("quiz-editor").style.display = "none";
    document.getElementById("memo-editor").style.display = "none";

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
    } else {
        document.getElementById("theory-editor").style.display = "block";
        document.getElementById("slides-card").style.display = "block";
        document.getElementById("cells-section-title").textContent = "Слайды блока";
        document.getElementById("add-slide-btn").textContent = "＋ Слайд";
        renderSlideList(); renderSlide();
    }
}

function renderLessonList() {
    const list = document.getElementById("lesson-list");
    list.innerHTML = "";
    const ids = Object.keys(allLessons);
    ids.forEach((id, index) => {
        const l = allLessons[id];
        const row = document.createElement("div");
        row.className = "lesson-row";
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
        } else {
            typeLabel = "Теория";
            count = `${l.slides.length} слайдов`;
        }
        btn.innerHTML = `${l.title}<span class="ltype">${typeLabel} · ${count}</span>`;
        btn.onclick = () => { readFromDom(); state.currentLessonId = id; state.currentSlideIndex = 0; refreshAll(); };
        row.appendChild(btn);

        const exp = document.createElement("button");
        exp.className = "icon-btn-sm export"; exp.textContent = "📤";
        exp.title = "Экспортировать блок в файл .json";
        exp.onclick = (e) => { e.stopPropagation(); exportLesson(id); };
        row.appendChild(exp);

        const up = document.createElement("button");
        up.className = "icon-btn-sm"; up.textContent = "↑";
        up.title = "Вверх";
        up.disabled = index === 0;
        up.onclick = (e) => { e.stopPropagation(); moveLesson(id, -1); };
        row.appendChild(up);

        const dn = document.createElement("button");
        dn.className = "icon-btn-sm"; dn.textContent = "↓";
        dn.title = "Вниз";
        dn.disabled = index === ids.length - 1;
        dn.onclick = (e) => { e.stopPropagation(); moveLesson(id, 1); };
        row.appendChild(dn);

        list.appendChild(row);
    });
}

function pluralizeCells(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "ячейка";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ячейки";
    return "ячеек";
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
}

function renderSlideList() {
    const slides = currentLesson().slides || [];
    const list = document.getElementById("slide-list");
    list.innerHTML = "";
    slides.forEach((s, i) => {
        const btn = document.createElement("button");
        btn.className = "slide-item" + (i === state.currentSlideIndex ? " current" : "");
        const hasMedia = (s.content || []).some(b => b.type === "image" || b.type === "video");
        const icon = hasMedia ? "🖼 " : "📄 ";
        btn.textContent = icon + (i + 1) + ". " + (s.shortName || s.title || "Без названия");
        btn.onclick = () => { readFromDom(); state.currentSlideIndex = i; renderSlideList(); renderSlide(); };
        list.appendChild(btn);
    });
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

function renderCellsList() {
    const lesson = currentLesson();
    const cells = lesson.cells || [];
    const list = document.getElementById("slide-list");
    list.innerHTML = "";
    cells.forEach((c, i) => {
        const btn = document.createElement("button");
        btn.className = "slide-item" + (i === state.currentSlideIndex ? " current" : "");
        const hasMedia = (c.content || []).some(b => b.type === "image" || b.type === "video");
        const icon = hasMedia ? "🖼 " : "📌 ";
        const title = c.title ? c.title : "(без заголовка)";
        btn.textContent = icon + (i + 1) + ". " + title;
        btn.onclick = () => { readFromDom(); state.currentSlideIndex = i; renderCellsList(); renderCell(); };
        list.appendChild(btn);
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

function renderCell() {
    const lesson = currentLesson();
    const cell = lesson.cells[state.currentSlideIndex];
    if (!cell) return;
    document.getElementById("cell-title-input").value = cell.title || "";
    const box = document.getElementById("memo-content");
    box.innerHTML = "";
    (cell.content || []).forEach((b, i) => box.appendChild(createBlockElement(b, i, "memo")));
}

function createTableBody(block) {
    const wrap = document.createElement("div");
    wrap.className = "table-editor";

    if (!block.rows) block.rows = [["", ""], ["", ""]];
    if (block.header === undefined) block.header = true;

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

    const gridWrap = document.createElement("div");
    gridWrap.className = "table-editor-grid-wrap";
    const gridTable = document.createElement("table");
    gridTable.className = "table-editor-grid";
    gridWrap.appendChild(gridTable);
    wrap.appendChild(gridWrap);

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

    wrap.appendChild(actions);

    function renderTableGrid() {
        const rows = block.rows || [];
        const cols = getMaxCols(rows) || 1;
        const hasHeader = block.header === true;

        gridTable.innerHTML = "";
        rows.forEach((row, ri) => {
            const tr = document.createElement("tr");
            for (let ci = 0; ci < cols; ci++) {
                const td = document.createElement("td");
                if (hasHeader && ri === 0) td.classList.add("is-header");
                const inp = document.createElement("input");
                inp.type = "text";
                inp.value = (row[ci] !== undefined) ? row[ci] : "";
                inp.placeholder = (hasHeader && ri === 0) ? ("Заголовок " + (ci + 1)) : "";
                inp.addEventListener("input", () => {
                    while (row.length <= ci) row.push("");
                    row[ci] = inp.value;
                    onFieldChange();
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
    }

    renderTableGrid();
    return wrap;
}

function getMaxCols(rows) {
    let m = 0;
    (rows || []).forEach(r => { if (Array.isArray(r) && r.length > m) m = r.length; });
    return m;
}

function createBlockElement(block, index, context) {
    const wrapper = document.createElement("div");
    wrapper.className = "block-wrapper";
    wrapper.dataset.type = block.type;
    wrapper.dataset.index = index;

    let editable = null;

    if (block.type === "p") {
        editable = document.createElement("p");
        editable.contentEditable = "true";
        editable.innerHTML = block.text || "";
    } else if (block.type === "h3") {
        editable = document.createElement("h3");
        editable.contentEditable = "true";
        editable.innerHTML = block.text || "";
    } else if (block.type === "quote") {
        editable = document.createElement("div");
        editable.className = "quote-text";
        editable.contentEditable = "true";
        editable.innerHTML = block.text || "";
    } else if (block.type === "ul") {
        editable = document.createElement("ul");
        (block.items || []).forEach(item => {
            const li = document.createElement("li");
            const sp = document.createElement("span");
            sp.className = "li-text"; sp.contentEditable = "true"; sp.innerHTML = item;
            li.appendChild(sp);
            const tools = document.createElement("div");
            tools.className = "li-tools";
            tools.innerHTML = `<button class="mini-icon-btn" onclick="addListItem(this)">＋</button><button class="mini-icon-btn del" onclick="removeListItem(this)">✕</button>`;
            li.appendChild(tools);
            editable.appendChild(li);
        });
    } else if (block.type === "link") {
        editable = document.createElement("div");
        editable.className = "link-editor";
        editable.innerHTML = `
            <div class="link-text-row"><span>🔗</span><span class="link-text" contenteditable="true">${block.text || "Ссылка"}</span></div>
            <div class="url-row"><span>URL:</span><input type="text" class="link-url" value="${(block.href || "").replace(/"/g, '&quot;')}" placeholder="https://... или #lessonId:3"></div>
            <div class="url-hint">Внешние: https://... | файлы: files/doc.pdf | внутри: #smarts или #smarts:3</div>`;
        editable.querySelector(".link-url").addEventListener("input", onFieldChange);
    } else if (block.type === "image") {
        editable = createMediaBlock(block, "image");
    } else if (block.type === "video") {
        editable = createMediaBlock(block, "video");
    } else if (block.type === "table") {
        editable = createTableBody(block);
    }

    if (editable) {
        wrapper.appendChild(editable);
        if (block.type !== "ul" && block.type !== "link" && block.type !== "image" && block.type !== "video" && block.type !== "table") {
            editable.addEventListener("keydown", e => {
                if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
            });
        }
    }

    wrapper.addEventListener("input", onFieldChange);

    const tools = document.createElement("div");
    tools.className = "block-tools";
    const moveHandlerPrefix = context === "memo" ? "moveMemoBlock" : "moveBlock";
    const removeHandlerPrefix = context === "memo" ? "removeMemoBlock" : "removeBlock";
    tools.innerHTML = `<button class="mini-icon-btn" onclick="${moveHandlerPrefix}(this, -1)" title="Вверх">↑</button><button class="mini-icon-btn" onclick="${moveHandlerPrefix}(this, 1)" title="Вниз">↓</button><button class="mini-icon-btn del" onclick="${removeHandlerPrefix}(this)" title="Удалить">✕</button>`;
    wrapper.appendChild(tools);

    return wrapper;
}

function createMediaBlock(block, type) {
    const wrap = document.createElement("div");
    wrap.className = "media-editor";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input media-src-input";
    input.placeholder = type === "image"
        ? "images/pic.png  или  https://example.com/pic.png"
        : "videos/lesson.mp4  или  https://example.com/video.mp4";
    input.value = block.src || "";
    wrap.appendChild(input);

    const hint = document.createElement("div");
    hint.className = "field-hint";
    hint.innerHTML = type === "image"
        ? `Путь к файлу в папке курса или ссылка.<br>Файлы клади в <code>images/</code> рядом с <code>index.html</code>. Пиши <b>images/foo.png</b> — без ведущего слэша.`
        : `Путь к файлу в папке курса или ссылка.<br>Файлы клади в <code>videos/</code> рядом с <code>index.html</code>. Пиши <b>videos/foo.mp4</b> — без ведущего слэша. Формат: MP4 (H.264).`;
    wrap.appendChild(hint);

    const preview = document.createElement("div");
    preview.className = "media-preview";
    wrap.appendChild(preview);

    const renderPreview = () => {
        preview.innerHTML = "";
        const src = input.value.trim();
        if (!src) {
            preview.innerHTML = '<div class="media-preview-empty">Превью появится здесь</div>';
            return;
        }
        if (type === "image") {
            const img = document.createElement("img");
            img.alt = "";
            img.onerror = () => {
                preview.innerHTML = '<div class="media-preview-error">⚠ Файл не найден: ' + escapeHtml(src) + '</div>';
            };
            img.src = src;
            preview.appendChild(img);
        } else {
            const v = document.createElement("video");
            v.controls = true;
            v.preload = "metadata";
            v.onerror = () => {
                preview.innerHTML = '<div class="media-preview-error">⚠ Видео не загрузилось. Проверь путь и формат.</div>';
            };
            v.src = src;
            preview.appendChild(v);
        }
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

    renderPreview();
    return wrap;
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
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
    if (type === "ul") return { type: "ul", items: ["Первый пункт", "Второй пункт", "Третий пункт"] };
    if (type === "quote") return { type: "quote", text: "Выделенная мысль" };
    if (type === "link") return { type: "link", text: "Текст ссылки", href: "https://" };
    if (type === "image") return { type: "image", src: "", alt: "" };
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

function addListItem(btn) {
    readFromDom();
    const li = btn.closest("li"); const ul = li.parentNode;
    const idx = Array.from(ul.children).indexOf(li);
    const wrapper = btn.closest(".block-wrapper");
    const bIdx = parseInt(wrapper.dataset.index);
    const lesson = currentLesson();
    let items;
    if (lesson.type === "memo") items = lesson.cells[state.currentSlideIndex].content[bIdx].items;
    else items = lesson.slides[state.currentSlideIndex].content[bIdx].items;
    items.splice(idx + 1, 0, "Новый пункт");
    if (lesson.type === "memo") renderCell();
    else renderSlide();
    saveDraft();
}
function removeListItem(btn) {
    readFromDom();
    const li = btn.closest("li"); const ul = li.parentNode;
    const idx = Array.from(ul.children).indexOf(li);
    const wrapper = btn.closest(".block-wrapper");
    const bIdx = parseInt(wrapper.dataset.index);
    const lesson = currentLesson();
    let items;
    if (lesson.type === "memo") items = lesson.cells[state.currentSlideIndex].content[bIdx].items;
    else items = lesson.slides[state.currentSlideIndex].content[bIdx].items;
    if (items.length <= 1) { alert("Нельзя удалить последний пункт."); return; }
    items.splice(idx, 1);
    if (lesson.type === "memo") renderCell();
    else renderSlide();
    saveDraft();
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
            content: [{ type: "ul", items: ["Первый пункт", "Второй пункт"] }]
        });
        state.currentSlideIndex = lesson.cells.length - 1;
        refreshAll(); saveDraft();
    } else {
        lesson.slides.push({ shortName: "Новый слайд", title: "Новый слайд", content: [{ type: "p", text: "Текст нового слайда." }] });
        state.currentSlideIndex = lesson.slides.length - 1;
        refreshAll(); saveDraft();
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

function readFromDom() {
    const lesson = currentLesson();
    if (!lesson) return;
    lesson.title = document.getElementById("lesson-title-input").value;
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
        cell.content = readBlocksFromContainer("memo-content");
    } else {
        const slide = lesson.slides[state.currentSlideIndex];
        if (!slide) return;
        slide.shortName = document.getElementById("slide-shortname-input").value;
        slide.title = document.getElementById("slide-title-input").value;
        slide.content = readBlocksFromContainer("preview-content");
    }
    courseSettings.courseTitle = document.getElementById("course-title-input").value;
    courseSettings.pageTitle = document.getElementById("page-title-input").value;
    saveDraft();
}

function readBlocksFromContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const wrappers = container.querySelectorAll(":scope > .block-wrapper");
    const nc = [];
    wrappers.forEach(w => {
        const type = w.dataset.type;
        if (type === "p" || type === "h3") nc.push({ type, text: w.querySelector("p, h3").innerHTML });
        else if (type === "quote") nc.push({ type: "quote", text: w.querySelector(".quote-text").innerHTML });
        else if (type === "ul") nc.push({ type: "ul", items: Array.from(w.querySelectorAll("li .li-text")).map(s => s.innerHTML) });
        else if (type === "link") nc.push({ type: "link", text: w.querySelector(".link-text").innerHTML, href: w.querySelector(".link-url").value });
        else if (type === "image") {
            const inp = w.querySelector(".media-src-input");
            nc.push({ type: "image", src: inp ? inp.value.trim() : "", alt: "" });
        }
        else if (type === "video") {
            const inp = w.querySelector(".media-src-input");
            nc.push({ type: "video", src: inp ? inp.value.trim() : "" });
        }
        else if (type === "table") {
            const grid = w.querySelector(".table-editor-grid");
            const hasHeader = w.querySelector(".table-editor-toggle input[type='checkbox']").checked;
            const rows = [];
            if (grid) {
                grid.querySelectorAll("tr").forEach(tr => {
                    const row = [];
                    tr.querySelectorAll("input").forEach(inp => row.push(inp.value));
                    rows.push(row);
                });
            }
            nc.push({ type: "table", header: hasHeader, rows });
        }
    });
    return nc;
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
            else renderSlideList();
        }
        saveDraft();
    }, 400);
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

function addLesson(type) {
    readFromDom();
    let baseKey;
    if (type === "quiz") baseKey = "new_quiz";
    else if (type === "memo") baseKey = "new_memo";
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
                content: [{ type: "ul", items: ["Первый пункт", "Второй пункт"] }]
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
}

function deleteLesson() {
    const ids = Object.keys(allLessons);
    if (ids.length <= 1) { alert("Нельзя удалить единственный блок."); return; }
    if (!confirm("Удалить блок «" + currentLesson().title + "»?")) return;
    delete allLessons[state.currentLessonId];
    state.currentLessonId = Object.keys(allLessons)[0]; state.currentSlideIndex = 0;
    refreshAll(); saveDraft();
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
                if (lesson.type !== "theory" && lesson.type !== "quiz" && lesson.type !== "memo") {
                    setStatus("Ошибка: неизвестный тип блока", "err");
                    return;
                }
                readFromDom();
                let originalKey = null;
                const m = file.name.match(/^block_(.+)\.json$/i);
                if (m && m[1]) originalKey = m[1];
                const baseKey = originalKey || (lesson.type === "quiz" ? "new_quiz" : (lesson.type === "memo" ? "new_memo" : "new_lesson"));
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
                    lesson.slides.forEach(slide => { if (!slide.content) slide.content = []; });
                } else if (lesson.type === "memo") {
                    if (!lesson.cells) lesson.cells = [];
                    lesson.cells.forEach(cell => {
                        if (!cell.content) cell.content = [];
                        if (cell.title === undefined) cell.title = "";
                    });
                }
                allLessons[finalKey] = lesson;
                state.currentLessonId = finalKey;
                state.currentSlideIndex = 0;
                refreshAll();
                saveDraft();
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
                        });
                    }
                });
                localStorage.removeItem(PROGRESS_KEY);
                state.currentLessonId = Object.keys(allLessons)[0];
                state.currentSlideIndex = 0;
                refreshAll();
                saveDraft();
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

function openPreview() {
    readFromDom();
    const lesson = currentLesson();
    pvState = { questionIdx: 0, qStates: [] };
    if (lesson.type === "quiz") {
        pvState.qStates = lesson.questions.map(q => makePvQuestionState(q));
        pvState.lessonType = "quiz";
    } else if (lesson.type === "memo") {
        pvState.lessonType = "memo";
    } else {
        pvState.lessonType = "theory";
    }
    document.getElementById("pv-overlay").classList.add("show");
    document.body.style.overflow = "hidden";
    const pvCard = document.getElementById("pv-card");
    if (lesson.type === "memo") pvCard.classList.add("wide");
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

function renderPreviewMemoBlocks(blocks) {
    let html = "";
    (blocks || []).forEach(b => {
        if (b.type === "p") html += `<p>${b.text}</p>`;
        else if (b.type === "h3") html += `<h3>${b.text}</h3>`;
        else if (b.type === "ul") { html += `<ul>`; b.items.forEach(i => html += `<li>${i}</li>`); html += `</ul>`; }
        else if (b.type === "quote") html += `<div class="quote">${b.text}</div>`;
        else if (b.type === "link") html += `<div class="pv-link-block"><a class="pv-slide-link" href="javascript:void(0)">🔗 ${b.text || "Ссылка"}</a></div>`;
        else if (b.type === "image" && b.src) html += `<div class="slide-media"><img src="${b.src}" alt=""></div>`;
        else if (b.type === "video" && b.src) html += `<div class="slide-media"><video src="${b.src}" controls preload="metadata"></video></div>`;
        else if (b.type === "table") html += renderPreviewTable(b);
    });
    return html;
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
        if (b.type === "p") html += `<p>${b.text}</p>`;
        else if (b.type === "h3") html += `<h3>${b.text}</h3>`;
        else if (b.type === "ul") { html += `<ul>`; b.items.forEach(i => html += `<li>${i}</li>`); html += `</ul>`; }
        else if (b.type === "quote") html += `<div class="quote">${b.text}</div>`;
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

function buildDataJs() {
    readFromDom();
    const sJ = JSON.stringify(courseSettings, null, 4);
    const lJ = JSON.stringify(allLessons, null, 4);
    return "// ============================================================\n// ДАННЫЕ КУРСА\n// Редактируется через admin.html.\n// Типы блоков: lesson.type = \"theory\" | \"quiz\" | \"memo\".\n// Тип вопроса: q.type = \"single\" | \"multi\" | \"match\" | \"card\".\n// single/multi: { text, options, correct: [массив], explain, group }\n// match:        { text, pairs: [{left, right}], explain?, group }\n// card:         { front, frontImage, back, backImage, group }\n// memo:         { title, cells: [{ title, content: [...] }] }\n// table:        { type: \"table\", header: bool, rows: [[...], [...]] }\n// randomizeQuestions / randomizeOptions — перемешивание.\n// Контент слайдов/ячеек: блоки p, h3, ul, quote, link, image, video, table.\n// ============================================================\n\n" +
           "const courseSettings = " + sJ + ";\n\n" +
           "const allLessons = " + lJ + ";\n";
}

async function saveToFile() {
    const content = buildDataJs();
    localStorage.removeItem(DRAFT_KEY);
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: "data.js",
                types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }]
            });
            const w = await handle.createWritable();
            await w.write(content); await w.close();
            setStatus("✓ data.js сохранён. Обнови страницу курса (F5).", "ok");
            return;
        } catch (e) { if (e.name === "AbortError") return; }
    }
    downloadBlob("data.js", content);
    setStatus("✓ Файл скачан в Загрузки. Перемести в папку курса.", "ok");
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
    setTimeout(() => el.classList.remove("show"), 4000);
}

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
    html += `<p class="csv-modal-desc">Скачай нужный шаблон, открой в Excel, заполни и сохрани в формате CSV (разделитель — точка с запятой). Потом загрузи его в разделе «📥 Импорт из CSV».</p>`;

    html += `<div class="csv-samples">`;
    html += `<div class="csv-samples-title">Что в шаблоне</div>`;
    html += `<div class="csv-samples-item"><strong>single_multi</strong> — вопросы с одним или несколькими правильными ответами. Колонки: <code>type, text, option1..4, correct, explain, group</code>.</div>`;
    html += `<div class="csv-samples-item"><strong>match</strong> — вопросы на соответствие. До 5 пар. Колонки: <code>text, pair1_left, pair1_right, ... pair5_right, explain, group</code>.</div>`;
    html += `<div class="csv-samples-item"><strong>card</strong> — карточки для запоминания. Колонки: <code>front, frontImage, back, backImage, group</code>.</div>`;
    html += `</div>`;

    html += `<div class="csv-samples">`;
    html += `<div class="csv-samples-title">Правила заполнения</div>`;
    html += `<div class="csv-samples-item">Разделитель — <strong>точка с запятой</strong> <code>;</code>.</div>`;
    html += `<div class="csv-samples-item">Для multi правильные ответы — через <code>|</code>, например <code>A|E</code>.</div>`;
    html += `<div class="csv-samples-item">Пустые ячейки — можно. Для match, если пара пустая — она не считается.</div>`;
    html += `<div class="csv-samples-item">Кодировка: сохраняй как <strong>CSV UTF-8</strong> или как обычный CSV — мы поймём.</div>`;
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
                if (line[i+1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === delim) {
                cells.push(cur);
                cur = "";
            } else {
                cur += ch;
            }
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
        if (!line.trim() && rows.length > 0) continue;
        if (!line.trim() && rows.length === 0) continue;
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
        if (!type) {
            errors.push("Строка " + lineNum + ": неизвестный тип «" + typeRaw + "» (ожидается single или multi)");
            continue;
        }
        const text = (row[idx["text"]] || "").trim();
        if (!text) {
            errors.push("Строка " + lineNum + ": пустой текст вопроса");
            continue;
        }
        const options = [];
        for (let k = 1; k <= 10; k++) {
            const colName = "option" + k;
            const ci = idx[colName];
            if (ci === undefined) continue;
            const val = (row[ci] || "").trim();
            if (val) options.push(val);
        }
        if (options.length < 2) {
            errors.push("Строка " + lineNum + ": меньше 2 вариантов ответа");
            continue;
        }
        const correctRaw = (row[idx["correct"]] || "").trim();
        if (!correctRaw) {
            errors.push("Строка " + lineNum + ": пустое поле correct");
            continue;
        }
        const correctParts = correctRaw.split("|").map(s => s.trim()).filter(Boolean);
        const badOnes = correctParts.filter(c => !options.includes(c));
        if (badOnes.length) {
            errors.push("Строка " + lineNum + ": правильный ответ(ы) «" + badOnes.join(", ") + "» не найдены среди вариантов");
            continue;
        }
        if (type === "single" && correctParts.length !== 1) {
            errors.push("Строка " + lineNum + ": у single должен быть ровно 1 правильный ответ, найдено " + correctParts.length);
            continue;
        }
        if (type === "multi" && correctParts.length < 1) {
            errors.push("Строка " + lineNum + ": у multi должен быть хотя бы 1 правильный ответ");
            continue;
        }
        const explain = (row[idx["explain"]] || "").trim();
        const group = (row[idx["group"]] || "").trim() || null;

        questions.push({
            type,
            text,
            options,
            correct: correctParts,
            explain,
            group
        });
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
            if (!left || !right) {
                errors.push("Строка " + lineNum + ": пара " + k + " заполнена не полностью");
                continue;
            }
            pairs.push({ left, right });
        }
        if (pairs.length === 0) {
            errors.push("Строка " + lineNum + ": ни одной полной пары");
            continue;
        }
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
        if (!front) {
            errors.push("Строка " + lineNum + ": пустая передняя сторона (front)");
            continue;
        }
        if (!back) {
            errors.push("Строка " + lineNum + ": пустая задняя сторона (back)");
            continue;
        }
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
    html += `<p class="csv-modal-desc">Выбери тип вопросов в файле. Или нажми «Определить автоматически» — мы посмотрим на заголовки и сами поймём.</p>`;
    html += `<div class="csv-type-grid">`;
    html += `<button class="csv-type-card" onclick="csvPickType('single_multi')">`;
    html += `<div class="csv-type-icon">✏</div>`;
    html += `<div class="csv-type-title">Один / Несколько</div>`;
    html += `<div class="csv-type-desc">Вопросы с выбором одного или нескольких правильных</div>`;
    html += `</button>`;
    html += `<button class="csv-type-card" onclick="csvPickType('match')">`;
    html += `<div class="csv-type-icon">🔗</div>`;
    html += `<div class="csv-type-title">Соответствие</div>`;
    html += `<div class="csv-type-desc">Соединить пары: слово ↔ перевод</div>`;
    html += `</button>`;
    html += `<button class="csv-type-card" onclick="csvPickType('card')">`;
    html += `<div class="csv-type-icon">🎴</div>`;
    html += `<div class="csv-type-title">Карточки</div>`;
    html += `<div class="csv-type-desc">Передняя и задняя стороны для запоминания</div>`;
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
    if (rows.length < 2) {
        renderCsvError("Файл пустой или содержит только заголовок.");
        return;
    }
    const headers = rows[0];
    if (kind === "auto") {
        const detected = detectCsvKind(headers);
        if (!detected) {
            renderCsvError("Не удалось определить тип файла по заголовкам. Попробуй выбрать тип вручную.");
            return;
        }
        kind = detected;
    }
    let result;
    let kindLabel;
    if (kind === "single_multi") {
        result = buildSingleMultiQuestions(rows, headers);
        kindLabel = "Один / Несколько";
    } else if (kind === "match") {
        result = buildMatchQuestions(rows, headers);
        kindLabel = "Соответствие";
    } else if (kind === "card") {
        result = buildCardQuestions(rows, headers);
        kindLabel = "Карточки";
    } else {
        renderCsvError("Неизвестный тип: " + kind);
        return;
    }

    csvImportState = {
        kind,
        kindLabel,
        fileName,
        questions: result.questions,
        errors: result.errors
    };
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
    html += `<div class="csv-preview-row"><span>Всего строк (с данными)</span><strong>${total}</strong></div>`;
    html += `<div class="csv-preview-row"><span class="csv-preview-ok">✓ Валидных вопросов</span><strong class="csv-preview-ok">${st.questions.length}</strong></div>`;
    html += `<div class="csv-preview-row"><span class="csv-preview-err">✗ Ошибок (пропущены)</span><strong class="csv-preview-err">${st.errors.length}</strong></div>`;
    html += `</div>`;

    if (st.errors.length > 0) {
        html += `<div class="csv-error-list">`;
        html += `<div class="csv-error-title">Ошибки в строках (эти вопросы не будут импортированы):</div>`;
        st.errors.forEach(e => {
            html += `<div class="csv-error-item">• ${escapeHtml(e)}</div>`;
        });
        html += `</div>`;
    }

    if (st.questions.length === 0) {
        html += `<div class="csv-preview" style="background:var(--error-bg);border-color:var(--error-border);color:var(--error);">Ни одного валидного вопроса. Исправь файл и попробуй снова.</div>`;
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
        if (q.type === "single" || q.type === "multi") {
            line = `<strong>${i+1}.</strong> [${q.type}] ${escapeHtml(q.text)} → <em>${escapeHtml(q.correct.join(", "))}</em>`;
        } else if (q.type === "match") {
            const pairsStr = q.pairs.map(p => p.left + " → " + p.right).join("; ");
            line = `<strong>${i+1}.</strong> [match] ${escapeHtml(pairsStr)}`;
        } else if (q.type === "card") {
            line = `<strong>${i+1}.</strong> [card] ${escapeHtml(q.front)} → ${escapeHtml(q.back)}`;
        }
        html += `<div class="csv-samples-item">${line}</div>`;
    });
    html += `</div>`;

    const lesson = currentLesson();
    const existing = (lesson.questions || []).length;
    html += `<p class="csv-modal-desc" style="margin-top:16px;">В текущем тесте <strong>${existing}</strong> вопрос(ов). Что сделать с ними?</p>`;

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
    if (!lesson || lesson.type !== "quiz") {
        renderCsvError("Импорт возможен только в тест.");
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

    if (mode === "replace") {
        lesson.questions = csvImportState.questions;
    } else {
        lesson.questions = lesson.questions.concat(csvImportState.questions);
    }

    refreshAll();

    const cnt = csvImportState.questions.length;
    const errCnt = csvImportState.errors.length;
    setStatus("📥 Импортировано вопросов: " + cnt + (errCnt ? " (пропущено с ошибками: " + errCnt + ")" : ""), "ok");
    csvImportState = null;
    closeCsvModal();
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
    }
});

init();