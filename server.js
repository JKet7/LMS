/* ============================================================
   server.js — локальный сервер для конструктора курсов
   Запуск: node server.js
   Открыть: http://localhost:3000/courses.html
   С телефона: http://<IP-компьютера>:3000/courses.html
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3000;

// ROOT — папка, где лежит server.js.
// fs.realpathSync — резолвит реальный путь (важно при кириллице в пути).
// .normalize("NFC") — приводит Unicode к единой форме (Windows + кириллица).
let ROOT;
try {
    ROOT = fs.realpathSync(__dirname).normalize("NFC");
} catch (e) {
    ROOT = path.resolve(__dirname).normalize("NFC");
}

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ttf":  "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif":  "image/gif",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".mp4":  "video/mp4",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".csv":  "text/csv; charset=utf-8",
    ".txt":  "text/plain; charset=utf-8"
};

function send(res, code, body, contentType) {
    res.writeHead(code, {
        "Content-Type": contentType || "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(body);
}

// Нормализация пути + защита от выхода за ROOT.
function safeJoin(root, target) {
    const a = path.resolve(root).normalize("NFC");
    const b = path.resolve(root, target).normalize("NFC");
    if (!b.startsWith(a)) return null;
    return b;
}

// Извлекаем папку курса из Referer: http://host/EN/admin.html -> "EN"
function getCourseFromReferer(referer) {
    if (!referer) return null;
    try {
        const url = new URL(referer);
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2 && parts[parts.length - 1].startsWith("admin")) {
            return decodeURIComponent(parts[parts.length - 2]);
        }
    } catch (e) {}
    return null;
}

const server = http.createServer((req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        res.end();
        return;
    }

    const reqUrl = new URL(req.url, "http://x");

    // ===== POST /save-data — сохранение data.js =====
    if (req.method === "POST" && reqUrl.pathname === "/save-data") {
        let course = getCourseFromReferer(req.headers.referer);
        if (!course) course = reqUrl.searchParams.get("course");
        if (!course) {
            send(res, 400, "Не удалось определить папку курса. Открой админку через сервер (http://.../EN/admin.html).");
            return;
        }

        const filePath = safeJoin(ROOT, path.join(course, "data.js"));
        if (!filePath) { send(res, 403, "Недопустимый путь"); return; }
        if (!fs.existsSync(path.dirname(filePath))) {
            send(res, 404, "Папка курса не найдена: " + course);
            return;
        }

        let body = "";
        req.on("data", chunk => {
            body += chunk;
            if (body.length > 50 * 1024 * 1024) req.destroy();
        });
        req.on("end", () => {
            try {
                fs.writeFileSync(filePath, body, "utf-8");
                console.log(`✓ Сохранено: ${course}/data.js (${body.length} байт)`);
                send(res, 200, "ok");
            } catch (e) {
                console.error("Ошибка записи:", e);
                send(res, 500, "Ошибка записи: " + e.message);
            }
        });
        return;
    }
    // ===== POST /upload — загрузка файла (картинка/видео) =====
    if (req.method === "POST" && reqUrl.pathname === "/upload") {
        const course = reqUrl.searchParams.get("course");
        const type = reqUrl.searchParams.get("type"); // "images" | "videos"
        const filename = reqUrl.searchParams.get("filename");

        if (!course || !type || !filename) {
            send(res, 400, "Нужны параметры: course, type, filename");
            return;
        }
        if (type !== "images" && type !== "videos") {
            send(res, 400, "type должен быть images или videos");
            return;
        }

        // Защита: только буквы, цифры, точки, дефисы, подчёркивания, пробелы
        const safeName = String(filename).replace(/[^a-zA-Zа-яА-Я0-9._\-\s]/g, "_");
        const courseDir = safeJoin(ROOT, course);
        if (!courseDir || !fs.existsSync(courseDir)) {
            send(res, 404, "Папка курса не найдена: " + course);
            return;
        }

        const targetDir = path.join(courseDir, type);
        if (!fs.existsSync(targetDir)) {
            try { fs.mkdirSync(targetDir, { recursive: true }); }
            catch (e) { send(res, 500, "Не удалось создать папку: " + e.message); return; }
        }

        const filePath = safeJoin(targetDir, safeName);
        if (!filePath) { send(res, 403, "Недопустимое имя файла"); return; }

        // Если файл с таким именем уже есть — добавим суффикс
        let finalPath = filePath;
        let finalName = safeName;
        if (fs.existsSync(filePath)) {
            const ext = path.extname(safeName);
            const base = path.basename(safeName, ext);
            let n = 1;
            while (fs.existsSync(finalPath)) {
                finalName = base + "_" + n + ext;
                finalPath = safeJoin(targetDir, finalName);
                n++;
                if (n > 1000) { send(res, 500, "Слишком много дубликатов"); return; }
            }
        }

        const writeStream = fs.createWriteStream(finalPath);
        let received = 0;
        req.on("data", chunk => { received += chunk.length; });
        req.on("end", () => {
            writeStream.end();
            console.log(`✓ Загружено: ${course}/${type}/${finalName} (${received} байт)`);
            send(res, 200, JSON.stringify({
                path: type + "/" + finalName,
                size: received
            }), "application/json; charset=utf-8");
        });
        req.on("error", (e) => {
            console.error("Ошибка загрузки:", e);
            writeStream.destroy();
            if (!res.headersSent) send(res, 500, "Ошибка загрузки: " + e.message);
        });
        req.pipe(writeStream);
        return;
    }
    // ===== GET /ping =====
    if (req.method === "GET" && reqUrl.pathname === "/ping") {
        send(res, 200, "pong");
        return;
    }

    // ===== favicon — без 403 =====
    let pathname = decodeURIComponent(reqUrl.pathname);
    if (pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === "/") pathname = "/courses.html";

    // Убираем ведущий слэш для safeJoin (path.resolve его сам понимает)
    const filePath = safeJoin(ROOT, pathname.replace(/^\/+/, ""));
    if (!filePath) {
        console.warn(`⚠ 403: ${pathname}`);
        send(res, 403, "Недопустимый путь: " + pathname);
        return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        console.warn(`⚠ 404: ${pathname}`);
        send(res, 404, "Не найдено: " + pathname);
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*"
    });
    fs.createReadStream(filePath).pipe(res);
});

server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
        console.error(`\n⚠ Порт ${PORT} занят.`);
        console.error(`  Открой server.js и поменяй PORT на 3001 или 8080.\n`);
    } else {
        console.error("Ошибка сервера:", e);
    }
    process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
    // Диагностика
    const coursesHtml = path.join(ROOT, "courses.html");
    const coursesExists = fs.existsSync(coursesHtml);

    console.log("\n========================================================");
    console.log("  КОНСТРУКТОР КУРСОВ — СЕРВЕР ЗАПУЩЕН");
    console.log("========================================================\n");
    console.log("  ROOT:                " + ROOT);
    console.log("  courses.html ищется: " + coursesHtml);
    console.log("  courses.html найден: " + (coursesExists ? "ДА" : "НЕТ"));
    console.log("");

    if (!coursesExists) {
        console.log("  ⚠ ВНИМАНИЕ: courses.html не найден в ROOT.");
        console.log("  Проверь, что server.js лежит рядом с courses.html.\n");
    }

    console.log("  На этом компьютере:");
    console.log(`    http://localhost:${PORT}/courses.html\n`);

    console.log("  С телефона (в той же Wi-Fi):");
    const ifaces = os.networkInterfaces();
    let found = false;
    for (const name in ifaces) {
        for (const iface of ifaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                console.log(`    http://${iface.address}:${PORT}/courses.html`);
                found = true;
            }
        }
    }
    if (!found) console.log("    (не удалось определить IP — проверь сеть)");

    console.log("\n  Чтобы остановить: Ctrl+C или закрой это окно.\n");
});