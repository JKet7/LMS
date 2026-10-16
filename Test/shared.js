/* ============================================================
   SHARED.JS — общие утилиты для читателя и редактора
   Подключается ПОСЛЕ data.js и ДО reader.js / admin.js.
   Никаких side-effect'ов, кроме миграций allLessons.
   ============================================================ */

/* ============================================================
   ЭКРАНИРОВАНИЕ
   ============================================================ */

function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function escapeAttr(s) {
    return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ============================================================
   ТИПЫ БЛОКОВ / ИКОНКИ
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

/* ============================================================
   ВОПРОСЫ — нормализация
   ============================================================ */

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

/* ============================================================
   МИГРАЦИИ СТАРЫХ ФОРМАТОВ
   ============================================================ */

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

// Один проход по allLessons при загрузке — миграции.
// Все утилиты выше к этому моменту уже определены.
(function migrateAllData() {
    if (typeof allLessons === "undefined" || !allLessons) return;

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
                // старые slide.video / slide.image -> блоки
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
})();

/* ============================================================
   БЕЗОПАСНЫЙ РЕНДЕР ТЕКСТА С WIKI-ССЫЛКАМИ
   ============================================================ */

const SAFE_TAGS = /^(b|i|u|s|strong|em|br|strike|del|div|span|p)$/i;

function renderSafeText(text, opts) {
    opts = opts || {};
    const allowWiki = opts.allowWiki !== false;

    if (text == null) return "";
    let s = String(text);

    // 0. Удаляем HTML-комментарии
    s = s.replace(/<!--[\s\S]*?-->/g, "");

    // 1. Экранируем
    s = s.replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#39;");

    // 2. Восстанавливаем разрешённые теги + style="text-align:..."
    s = s.replace(/&lt;(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([\s\S]*?)&gt;/g, function(match, slash, tag, attrs) {
        const t = tag.toLowerCase();
        if (!SAFE_TAGS.test(t)) return "";

        if (slash === "/") return "</" + t + ">";

        let safeStyle = "";
        const styleMatch = attrs.match(/style\s*=\s*(?:&quot;|&#39;)([^&]*?)(?:&quot;|&#39;)/i);
        if (styleMatch) {
            const alignMatch = styleMatch[1].match(/text-align\s*:\s*(left|center|right|justify)/i);
            if (alignMatch) {
                safeStyle = ' style="text-align:' + alignMatch[1].toLowerCase() + '"';
            }
        }
        return "<" + t + safeStyle + ">";
    });

    // 3. <br>
    s = s.replace(/&lt;br\s*\/?&gt;/gi, "<br>");

    // 4. Wiki-ссылки
    if (allowWiki) {
        s = renderWikiLinks(s);
    }

    return s;
}

/* ============================================================
   WIKI-ССЫЛКИ
   ============================================================ */

function getWikiLinkDefaultText(lesson, slideNum) {
    const title = lesson.title || "Без названия";
    if (slideNum > 0) {
        if (lesson.type === "theory" && lesson.slides && lesson.slides[slideNum]) {
            const slideTitle = lesson.slides[slideNum].title || lesson.slides[slideNum].shortName || "";
            return title + (slideTitle ? " → " + slideTitle : " (слайд " + (slideNum + 1) + ")");
        }
        if (lesson.type === "memo" && lesson.cells && lesson.cells[slideNum]) {
            const cellTitle = lesson.cells[slideNum].title || "";
            return title + (cellTitle ? " → " + cellTitle : " (ячейка " + (slideNum + 1) + ")");
        }
        if (lesson.type === "glossary" && lesson.terms && lesson.terms[slideNum]) {
            const termName = lesson.terms[slideNum].name || "";
            return title + (termName ? " → " + termName : " (термин " + (slideNum + 1) + ")");
        }
        if (lesson.type === "quiz") {
            return title + " (вопрос " + (slideNum + 1) + ")";
        }
    }
    return title;
}

function renderWikiLinks(html) {
    if (!html) return html;
    return String(html).replace(/\[\[([^\[\]]+?)\]\]/g, (match, inner) => {
        let key = inner;
        let slideNum = 0;
        let customText = "";

        const pipeIdx = key.indexOf("|");
        if (pipeIdx !== -1) {
            customText = key.slice(pipeIdx + 1).trim();
            key = key.slice(0, pipeIdx).trim();
        }

        const colonIdx = key.lastIndexOf(":");
        if (colonIdx !== -1) {
            const numStr = key.slice(colonIdx + 1).trim();
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > 0) {
                slideNum = num - 1;
                key = key.slice(0, colonIdx).trim();
            }
        }

        const lesson = allLessons[key];
        if (!lesson) {
            return `<span class="wiki-link-broken" title="Блок не найден: ${escapeHtml(key)}">[[${escapeHtml(inner)}]]</span>`;
        }

        const displayText = customText || getWikiLinkDefaultText(lesson, slideNum);
        const typeClass = "wiki-link-" + lesson.type;
        const onclick = `goToInternalLink('${escapeAttr(key)}', ${slideNum})`;

        return `<a href="javascript:void(0)" class="wiki-link ${typeClass}" onclick="${onclick}" title="${escapeAttr(lesson.title)}">${escapeHtml(displayText)}</a>`;
    });
}

/* ============================================================
   ПРИМЕЧАНИЯ ((N))
   ============================================================ */

function renderNotes(html, notes) {
    if (!html) return html;
    if (!Array.isArray(notes) || notes.length === 0) {
        return String(html).replace(/\(\((\d+)\)\)/g, (m, n) =>
            `<span class="note-broken" title="Нет примечания №${escapeHtml(n)}">((${escapeHtml(n)}))</span>`);
    }
    return String(html).replace(/\(\((\d+)\)\)/g, (match, nStr) => {
        const n = parseInt(nStr, 10);
        if (!n || n < 1 || n > notes.length) {
            return `<span class="note-broken" title="Нет примечания №${escapeHtml(nStr)}">((${escapeHtml(nStr)}))</span>`;
        }
        const text = escapeHtml(notes[n - 1] || "");
        return `<span class="note" data-note-idx="${n - 1}" data-note-text="${text.replace(/"/g, '&quot;')}">${n}</span>`;
    });
}

/* ============================================================
   МАРКЕРЫ НА КАРТИНКЕ — рендер
   ============================================================ */

function renderImageBlock(b) {
    const hasMarkers = Array.isArray(b.markers) && b.markers.length > 0;
    const safeSrc = escapeAttr(b.src || "");
    const safeAlt = escapeAttr(b.alt || "");

    if (!hasMarkers) {
        return `<div class="slide-media"><img src="${safeSrc}" alt="${safeAlt}" loading="lazy" data-lightbox="1"></div>`;
    }

    let html = `<div class="slide-media"><div class="img-with-markers">`;
    html += `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" data-lightbox="1">`;
    b.markers.forEach((m, i) => {
        const x = Number(m.x) || 0;
        const y = Number(m.y) || 0;
        html += `<button type="button" class="img-marker" data-marker-idx="${i}" style="left:${x}%;top:${y}%;" aria-label="Примечание ${i + 1}"></button>`;
    });
    html += `</div></div>`;
    return html;
}

/* ============================================================
   ССЫЛКИ — рендер блока и превью
   ============================================================ */

function renderLinkBlock(b) {
    const href = b.href || "";
    const text = b.text || "Ссылка";

    if (href.startsWith("#")) {
        return `<div class="link-block"><a class="slide-link internal" href="javascript:void(0)" onclick="goToInternalLink('${escapeAttr(href)}')">🔗 ${escapeHtml(text)}</a></div>`;
    }

    const preview = getLinkPreview(href, text);
    if (preview) return preview;

    const domain = getDomain(href);
    return `<div class="link-block">
        <a class="slide-link link-with-domain" href="${escapeAttr(href)}" target="_blank" rel="noopener">
            <span class="link-icon">🔗</span>
            <span class="link-text-main">${escapeHtml(text)}</span>
            <span class="link-domain">${escapeHtml(domain)}</span>
        </a>
    </div>`;
}

function getDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace(/^www\./, "");
    } catch (e) {
        return "";
    }
}

function getLinkPreview(href, text) {
    const url = String(href || "").trim();
    const label = escapeHtml(text);

    let ytId = null;
    let m;
    if ((m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/))) {
        ytId = m[1];
    }
    if (ytId) {
        const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        return `<div class="link-block link-preview">
            <a class="link-preview-card" href="${escapeAttr(url)}" target="_blank" rel="noopener">
                <div class="link-preview-thumb">
                    <img src="${thumb}" alt="" loading="lazy">
                    <div class="link-preview-play">▶</div>
                </div>
                <div class="link-preview-info">
                    <div class="link-preview-title">${label}</div>
                    <div class="link-preview-domain">youtube.com</div>
                </div>
            </a>
        </div>`;
    }

    if ((m = url.match(/(?:vkvideo\.ru|vk\.com)\/video(-?\d+)_(\d+)/))) {
        return `<div class="link-block link-preview">
            <a class="link-preview-card link-preview-vk" href="${escapeAttr(url)}" target="_blank" rel="noopener">
                <div class="link-preview-thumb link-preview-thumb-vk">
                    <div class="link-preview-vk-icon">📺</div>
                    <div class="link-preview-play">▶</div>
                </div>
                <div class="link-preview-info">
                    <div class="link-preview-title">${label}</div>
                    <div class="link-preview-domain">vkvideo.ru</div>
                </div>
            </a>
        </div>`;
    }

    return null;
}

/* ============================================================
   ТАБЛИЦА И СПИСОК — рендер контента
   ============================================================ */

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
            const safeCell = renderSafeText(cell);
            if (isHeaderRow) html += `<th>${safeCell}</th>`;
            else html += `<td>${safeCell}</td>`;
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
        html += `<li class="slide-list-item level-${safeLevel}">${markerHtml}<span class="slide-list-text">${renderSafeText(text)}</span></li>`;
    });
    html += `</ul>`;
    return html;
}

/* ============================================================
   РЕНДЕР КОНТЕНТНЫХ БЛОКОВ
   ============================================================ */

function renderContentBlocks(blocks) {
    let html = "";
    (blocks || []).forEach(b => {
        if (b.type === "p") html += `<div class="text-p">${renderNotes(renderSafeText(b.text || ""), b.notes)}</div>`;
        else if (b.type === "h3") html += `<h3>${renderNotes(renderSafeText(b.text || ""), b.notes)}</h3>`;
        else if (b.type === "ul") html += renderList(b);
        else if (b.type === "quote") html += `<div class="quote">${renderNotes(renderSafeText(b.text || ""), b.notes)}</div>`;
        else if (b.type === "link") html += renderLinkBlock(b);
        else if (b.type === "image" && b.src) html += renderImageBlock(b);
        else if (b.type === "video" && b.src) {
            const safeSrc = escapeAttr(b.src);
            html += `<div class="slide-media has-video">`;
            html += `<video src="${safeSrc}" controls preload="metadata"></video>`;
            html += `<div class="print-video-placeholder">🎬 [Видео: ${escapeHtml(b.src)}]</div>`;
            html += `</div>`;
        }
        else if (b.type === "table") html += renderTable(b);
    });
    return html;
}

/* ============================================================
   ПЛЮРАЛИЗАЦИЯ
   ============================================================ */

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
function pluralizeSlides(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "слайд";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "слайда";
    return "слайдов";
}
function pluralizeQuestions(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "вопрос";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "вопроса";
    return "вопросов";
}

/* ============================================================
   ПАМЯТКА / ТЕСТ — общие утилиты
   ============================================================ */

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

/* ============================================================
   ВРЕМЯ
   ============================================================ */

function formatTime(s) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
}

function formatDateTime(iso) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "—";
        const pad = (n) => String(n).padStart(2, "0");
        return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() +
               " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    } catch (e) { return "—"; }
}

/* ============================================================
   ГЛОССАРИЙ — сортировка, поиск, подсветка
   ============================================================ */

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
    return s.charAt(0).toUpperCase();
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

/* ============================================================
   ГЛОССАРИЙ — CSV экспорт (термин -> текст)
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

/* ============================================================
   ПРОЧЕЕ
   ============================================================ */

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
}

function copyToClipboard(text) {
    const onSuccess = () => { if (typeof setStatus === "function") setStatus("📋 Ключ скопирован: " + text, "ok"); };
    const onFail = () => { if (typeof setStatus === "function") setStatus("⚠ Не удалось скопировать. Ключ: " + text, "err"); };
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