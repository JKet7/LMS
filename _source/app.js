/* ============================================================
   APP.JS — точка входа, переключение режимов
   Подключается ПОСЛЕДНИМ.
   Требует: data.js, shared.js, reader.js.
   ============================================================ */

(function () {
    "use strict";

    const MODE_KEY = "kp_app_mode";
    const htmlEl = document.documentElement;

    /* ============================================================
       ПЕРЕКЛЮЧЕНИЕ РЕЖИМА
       ============================================================ */

    function setAppMode(mode) {
        if (mode !== "reader" && mode !== "author") return;

        // Если уже в этом режиме — ничего не делаем
        const current = htmlEl.getAttribute("data-app-mode");
        if (current === mode) return;

        // 1. Запоминаем
        try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}

        // 2. Меняем атрибут на <html>
        //    CSS мгновенно скрывает/показывает .author-only / .reader-only.
        htmlEl.setAttribute("data-app-mode", mode);

        // 3. Обновляем кнопки и topbar
        updateModeButtons(mode);
        updateTopbar(mode);
        updatePageTitle(mode);

        // 4. Просим reader перерисовать текущий экран.
        //    reader.js слушает атрибут через MutationObserver и сам
        //    вызывает rerenderCurrentScreen. Но на всякий случай — дёрнем
        //    явно, чтобы избежать гонок.
        if (window.reader && typeof window.reader.setMode === "function") {
            try { window.reader.setMode(mode); } catch (e) { console.warn("reader.setMode:", e); }
        }

        // 5. Скролл вверх
        window.scrollTo({ top: 0, behavior: "auto" });
    }
    window.setAppMode = setAppMode;

    /* ============================================================
       ОБНОВЛЕНИЕ UI
       ============================================================ */

    function updateModeButtons(mode) {
        const btnReader = document.getElementById("mode-btn-reader");
        const btnAuthor = document.getElementById("mode-btn-author");
        if (btnReader) btnReader.classList.toggle("active", mode === "reader");
        if (btnAuthor) btnAuthor.classList.toggle("active", mode === "author");
    }

    function updateTopbar(mode) {
        const logoEl = document.getElementById("topbar-logo");
        const titleEl = document.getElementById("topbar-title");
        if (logoEl) {
            logoEl.textContent = (mode === "author") ? "✎" : "📚";
        }
        if (titleEl) {
            if (mode === "author") {
                const courseTitle = (typeof courseSettings !== "undefined" && courseSettings && courseSettings.courseTitle)
                    ? courseSettings.courseTitle
                    : "Курс";
                titleEl.textContent = courseTitle + " — редактор";
            } else {
                const courseTitle = (typeof courseSettings !== "undefined" && courseSettings && courseSettings.courseTitle)
                    ? courseSettings.courseTitle
                    : "Курс";
                titleEl.textContent = courseTitle;
            }
        }
    }

    function updatePageTitle(mode) {
        if (mode === "author") {
            const courseTitle = (typeof courseSettings !== "undefined" && courseSettings && courseSettings.courseTitle)
                ? courseSettings.courseTitle
                : "Курс";
            document.title = courseTitle + " — редактор";
        } else {
            const pageTitle = (typeof courseSettings !== "undefined" && courseSettings && courseSettings.pageTitle)
                ? courseSettings.pageTitle
                : "Курс";
            document.title = pageTitle;
        }
    }

    /* ============================================================
       ИНИЦИАЛИЗАЦИЯ
       ============================================================ */

    function initApp() {
        // Читаем режим из localStorage (или reader по умолчанию)
        let mode = "reader";
        try {
            const saved = localStorage.getItem(MODE_KEY);
            if (saved === "reader" || saved === "author") mode = saved;
        } catch (e) {}

        // Синхронизируем атрибут на <html> с localStorage
        // (inline-скрипт в <head> уже что-то поставил — но мы точно ставим нужное)
        const currentAttr = htmlEl.getAttribute("data-app-mode");
        if (currentAttr !== mode) {
            htmlEl.setAttribute("data-app-mode", mode);
        }

        // Кнопки-переключатели
        const btnReader = document.getElementById("mode-btn-reader");
        const btnAuthor = document.getElementById("mode-btn-author");

        if (btnReader) {
            btnReader.addEventListener("click", (e) => {
                e.preventDefault();
                setAppMode("reader");
            });
        }
        if (btnAuthor) {
            btnAuthor.addEventListener("click", (e) => {
                e.preventDefault();
                setAppMode("author");
            });
        }

        // Первичная установка UI
        updateModeButtons(mode);
        updateTopbar(mode);
        updatePageTitle(mode);

        // Просим reader перерисоваться в нужном режиме.
        // (reader.js сам прочитал data-app-mode при старте — Часть 1.)
        if (window.reader && typeof window.reader.setMode === "function") {
            try { window.reader.setMode(mode); } catch (e) {}
        }
    }

    /* ============================================================
       СТАРТ
       ============================================================ */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initApp);
    } else {
        initApp();
    }

})();