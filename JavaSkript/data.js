// ============================================================
// ДАННЫЕ КУРСА
// Редактируется через admin.html.
// courseKey — уникальный ключ курса, не менять!
// Типы блоков: lesson.type = "theory" | "quiz" | "memo" | "glossary".
// Тип вопроса: q.type = "single" | "multi" | "match" | "card".
// single/multi: { text, options, correct: [массив], explain, group }
// match:        { text, pairs: [{left, right}], explain?, group }
// card:         { front, frontImage, back, backImage, group }
// memo:         { title, cells: [{ title, content: [...] }] }
// glossary:     { title, terms: [{ name, content: [...] }] }
// table:        { type: "table", header: bool, rows: [[...], [...]] }
// ul:           { type: "ul", style: "bullet"|"number"|"checkbox", items: [{text, level}] }
// randomizeQuestions / randomizeOptions — перемешивание.
// Контент слайдов/ячеек/терминов: блоки p, h3, ul, quote, link, image, video, table.
// В p/h3/quote допустимы <b>, <i>, <u>, <s> и style="text-align:...".
// ============================================================

const courseSettings = {
    "courseKey": "JavaSkript",
    "pageTitle": "JavaScript",
    "courseTitle": "JavaScript"
};

const allLessons = {
    "new_lesson": {
        "type": "theory",
        "title": "НАЧАЛО РАБОТЫ",
        "slides": [
            {
                "shortName": "JS",
                "title": "JS",
                "content": [
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>JavaScript - это язык программирования, который работает прямо в браузере. Когда страница реагирует на клик, проверяет форму, анимирует меню или подгружает новый контент без перезагрузки - за этим стоит именно JavaScript. Движок этого языка встроен в любой браузер на любом устройстве, и поэтому JavaScript - единственный язык, который выполняется в вебе «из коробки».</p><p>Но браузером дело давно не ограничивается. Node.js, Deno и Bun позволяют писать на JavaScript серверы, консольные утилиты, сборочные скрипты и API. Один и тот же язык крутится и на <b>фронтенде</b>, <em>и</em> на <b>бэкенде</b> - во многом поэтому он так широко распространён.</p><!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/paste_2026-10-09T08-15-14.png",
                        "alt": ""
                    },
                    {
                        "type": "h3",
                        "text": "Где выполняется JavaScript?"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Сам по себе JavaScript - это всего лишь спецификация языка (она называется ECMAScript). Чтобы код реально заработал, нужен <em>движок</em> - программа, которая читает ваш код и исполняет его. На практике вы столкнётесь с двумя сценариями:<!--EndFragment-->"
                    },
                    {
                        "type": "ul",
                        "style": "bullet",
                        "items": [
                            {
                                "text": "Браузеры. В Chrome и Edge работает V8. В Firefox - SpiderMonkey. В Safari - JavaScriptCore. Откройте любую страницу, нажмите F12, вставьте JavaScript во вкладку Console - и код тут же выполнится.",
                                "level": 0
                            },
                            {
                                "text": "Node.js. Вытаскивает V8 из браузера и даёт ему доступ к файловой системе, сети и операционной системе. Именно благодаря этому JavaScript работает и на сервере.",
                                "level": 0
                            }
                        ]
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->JavaScript в браузере умеет работать со страницей (DOM), но к файловой системе его не подпустят. А JavaScript в Node.js читает файлы и открывает сокеты, зато никакой страницы у него нет. Язык один и тот же - суперспособности разные.<!--EndFragment-->"
                    }
                ]
            },
            {
                "shortName": "Для чего нужен JavaScript",
                "title": "Для чего нужен JavaScript",
                "content": [
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Если коротко - почти для всего, что так или иначе связано с вебом. Если чуть подробнее, вот примерно в том порядке, в котором вы с этим столкнётесь:<!--EndFragment-->"
                    },
                    {
                        "type": "ul",
                        "style": "bullet",
                        "items": [
                            {
                                "text": "Интерактивные веб-страницы. Валидация форм, выпадающие меню, модальные окна, живой поиск, drag-and-drop.",
                                "level": 0
                            },
                            {
                                "text": "Одностраничные приложения (SPA). Gmail, Figma, Notion, Linear - целые приложения, которые рендерятся и обновляются средствами JavaScript, обычно через фреймворк вроде React, Vue или Svelte.",
                                "level": 0
                            },
                            {
                                "text": "Серверная разработка. REST API, GraphQL-эндпоинты и realtime-сервисы на Node.js, Express, Fastify или NestJS.",
                                "level": 0
                            },
                            {
                                "text": "Инструменты сборки и разработки. Бандлеры (Vite, esbuild, webpack), линтеры (ESLint), тест-раннеры (Vitest, Jest).",
                                "level": 0
                            },
                            {
                                "text": "Кроссплатформенные приложения. Десктоп через Electron (VS Code, Slack, Discord) и мобильные приложения через React Native.",
                                "level": 0
                            }
                        ]
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Всё это знать с первого дня не нужно. Но полезно держать в голове сам факт - тогда формулировка «это всего лишь JavaScript» перестаёт звучать как ограничение.<!--EndFragment-->"
                    },
                    {
                        "type": "h3",
                        "text": "Как работает JavaScript на самом деле"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>Упрощённая модель примерно такая: вы пишете исходный код, движок парсит его во внутреннее представление и выполняет. Современные движки используют JIT-компиляцию (just-in-time) - сначала они быстро интерпретируют код, а по ходу выполнения оптимизируют «горячие» участки, превращая их в машинный код.</p><p>JavaScript не компилируется в бинарник заранее. Вы просто отдаёте исходник браузеру (или Node), а всё остальное движок берёт на себя</p><!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/КакРаботаетJS.png",
                        "alt": ""
                    }
                ]
            },
            {
                "shortName": "JavaScript и Java: в чём разница",
                "title": "JavaScript и Java: в чём разница",
                "content": [
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Названия похожи, а языки - нет. Имя «JavaScript» появилось в 1995 году, чтобы поймать волну популярности Java - чисто маркетинговое решение, которое с тех пор регулярно сбивает с толку новичков.<!--EndFragment-->"
                    },
                    {
                        "type": "table",
                        "header": true,
                        "rows": [
                            [
                                "Заголовок 1",
                                "JavaScript",
                                "Java"
                            ],
                            [
                                "Типизация",
                                "Динамическая",
                                "Статическая"
                            ],
                            [
                                "Где выполняется",
                                "Браузеры, Node.js",
                                "JVM"
                            ],
                            [
                                "Парадигма",
                                "Мультипарадигменный, на основе прототипов",
                                "Классическое ООП на классах"
                            ],
                            [
                                "Компиляция",
                                "JIT, сборка не требуется",
                                "Сначала компиляция в байт-код"
                            ]
                        ]
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Если кто-то говорит «я выучил Java, значит, знаю JavaScript» - не верьте. Это два разных языка, у которых случайно совпали четыре буквы в названии.<!--EndFragment-->"
                    }
                ]
            },
            {
                "shortName": "JavaScript vs TypeScript",
                "title": "JavaScript vs TypeScript",
                "content": [
                    {
                        "type": "h3",
                        "text": "<!--StartFragment-->JavaScript vs TypeScript<!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->TypeScript - это JavaScript с прикрученной сверху системой типов. Вы пишете код с аннотациями типов, компилятор TypeScript их проверяет, а на выходе получается обычный JavaScript, который запустится везде, где работает JS.<!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Любой корректный JavaScript-файл - это одновременно и корректный TypeScript-файл. То есть TypeScript не конкурент JavaScript, а его надмножество. Большинство крупных кодовых баз сегодня написаны на TypeScript, но начинать всё равно стоит с JavaScript. Без понимания того, к <em>чему</em> именно TypeScript добавляет типы, разобраться в его смысле не получится.<!--EndFragment-->"
                    },
                    {
                        "type": "h3",
                        "text": "<!--StartFragment-->Немного истории - чтобы странности языка стали понятнее<!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>JavaScript был написан за десять дней в 1995 году Бренданом Айком в компании Netscape. Эта история важна: часть шероховатостей языка (нестрогое равенство, автоматическая вставка точек с запятой, typeof null === \"object\") - прямое следствие решений, принятых в жёстком цейтноте и затем навсегда зафиксированных ради обратной совместимости веба.</p><p>Стандарт языка называется <strong>ECMAScript</strong>, и новая версия выходит каждый год. Ключевой релиз - ES2015: он принёс let, const, стрелочные функции, классы и модули. Когда говорят «ES6» или «современный JavaScript», обычно имеют в виду именно набор возможностей от 2015 года и позже - сейчас он поддерживается повсеместно.</p><p>Писать на современном JavaScript - реально приятно. Старые странности никуда не делись, но их почти всегда можно обойти - привычкам для этого мы научимся по ходу курса.</p><!--EndFragment-->"
                    }
                ]
            },
            {
                "shortName": "Как запустить JavaScript",
                "title": "Как запустить JavaScript",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Вариант 1: консоль браузера</span></div><!--StartFragment--><!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Самый быстрый способ запустить строчку JavaScript - открыть консоль в DevTools браузера. Заходите на любую веб-страницу, жмёте F12 (или Cmd+Option+I на Mac), переходите на вкладку <strong>Console</strong> и пишете:<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/JSКонсоль.png",
                        "alt": ""
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>После каждой строки жмите Enter. Консоль выводит результат выражений и всё, что вы передаёте в console.log. Можно объявлять переменные, вызывать функции и копаться в текущей странице - например, document.title вернёт заголовок активной вкладки.</p><p>Консоль удобна, когда нужно:</p><!--EndFragment-->"
                    },
                    {
                        "type": "ul",
                        "style": "bullet",
                        "items": [
                            {
                                "text": "Быстро, за пару секунд, проверить небольшой фрагмент кода.",
                                "level": 0
                            },
                            {
                                "text": "Поковыряться в DOM реального сайта.",
                                "level": 0
                            },
                            {
                                "text": "Отладить код, который уже работает на странице.",
                                "level": 0
                            }
                        ]
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Всё, что вы набрали в консоли, исчезнет при закрытии вкладки. Если код нужно сохранить - заведите для него файл.<!--EndFragment-->"
                    },
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Вариант 2: тег &lt;script&gt; в HTML-файле</span></div><!--StartFragment--><!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Чтобы запустить JavaScript как часть веб-страницы, подключите его через HTML. Сохраните следующий код в файл index.html и откройте его двойным кликом в браузере или вставьте его в онлайн-редактор HTML:<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/JSВБраузере.png",
                        "alt": ""
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>Тег &lt;script&gt; говорит браузеру: «выполни это как JavaScript». У кода есть доступ к странице, в которую он встроен, поэтому document.getElementById(...) легко дотянется до &lt;h1&gt; выше. Чтобы увидеть вывод console.log, откройте DevTools.</p><p>Если кода больше пары строк, лучше вынести его в отдельный файл и подключить через тег &lt;script&gt;:</p><!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/paste_2026-10-09T08-28-13.png",
                        "alt": ""
                    },
                    {
                        "type": "quote",
                        "text": "<div style=\"text-align:center\"><span>Ставьте тег &lt;script&gt;</span><span> ближе к концу </span><span>&lt;body&gt;</span><span> или добавляйте к нему атрибут </span><span>defer</span><span> - тогда скрипт выполнится уже после того, как браузер разобрал HTML страницы.</span><span> </span></div><!--StartFragment--><!--EndFragment-->"
                    },
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Вариант 3: Node.js в терминале</span></div><!--StartFragment--><!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Когда JavaScript нужен без браузера - скрипт для переименования файлов, небольшой сервер, быстрая обработка данных - в ход идёт Node.js. Скачайте его с nodejs.org (берите LTS-версию) и проверьте, что всё встало:<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/paste_2026-10-09T08-29-40.png",
                        "alt": ""
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Сохраните файл как script.js:<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/paste_2026-10-09T08-30-22.png",
                        "alt": ""
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Затем из той же папки выполните:<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/paste_2026-10-09T08-30-43.png",
                        "alt": ""
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p>Результат сразу печатается в терминал. Никакого HTML, браузера и шагов сборки. Именно так выглядит большая часть «настоящей» разработки на JavaScript вне браузера - к тому же Node лежит в основе инструментов (сборщики, тест-раннеры, линтеры), которые крутятся вокруг браузерного проекта.</p><p>Можно запустить Node и вовсе без файла. Просто наберите node и нажмите Enter - откроется интерактивный режим (REPL), в котором каждая строка выполняется сразу, как только вы её введёте. Удобно что-нибудь быстро проверить - как консоль браузера, только прямо в терминале.</p><!--EndFragment-->"
                    }
                ]
            }
        ]
    }
};
