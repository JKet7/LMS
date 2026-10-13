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
// В тексте можно использовать [[ключ_блока]] для внутренних ссылок.
// ============================================================

const courseSettings = {
    "courseKey": "VE",
    "pageTitle": "Восточный Экспресс ",
    "courseTitle": "Восточный Экспресс "
};

const allLessons = {
    "new_lesson_1": {
        "type": "theory",
        "title": "Настройка системы под себя",
        "slides": [
            {
                "shortName": "Новый слайд",
                "title": "Новый слайд",
                "content": [
                    {
                        "type": "quote",
                        "text": "ЗНАЙ КЛИЕНТА"
                    },
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    }
                ]
            },
            {
                "shortName": "Фильтры",
                "title": "Фильтры",
                "content": [
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    },
                    {
                        "type": "video",
                        "src": "videos/Фильтры_1.mp4",
                        "markers": []
                    }
                ]
            },
            {
                "shortName": "Новый слайд",
                "title": "Новый слайд",
                "content": [
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    }
                ]
            }
        ]
    },
    "new_lesson": {
        "type": "theory",
        "title": "Знакомство с клиентом",
        "slides": [
            {
                "shortName": "Найти клиента",
                "title": "Окно \"Клиенты\"",
                "content": [
                    {
                        "type": "h3",
                        "text": "Зайти в клиента"
                    },
                    {
                        "type": "image",
                        "src": "images/стартовая панель.png",
                        "alt": "",
                        "markers": []
                    },
                    {
                        "type": "h3",
                        "text": "Основное окно"
                    },
                    {
                        "type": "image",
                        "src": "images/Окно Клиенты.png",
                        "alt": "",
                        "markers": [
                            {
                                "x": 57.6,
                                "y": 15.1,
                                "text": "Это поле для поиска клиента. Вводим сюда номер клиента или название организации"
                            },
                            {
                                "x": 1.3,
                                "y": 30,
                                "text": "Отмечаем наших \"Любимых\" клиентов, чтобы мы могли их быстро найти"
                            }
                        ]
                    },
                    {
                        "type": "quote",
                        "text": "ЗНАЙ КЛИЕНТА"
                    },
                    {
                        "type": "p",
                        "text": "Нужно обязательно настраивать фильтры. Как это делать смотри в [[new_lesson_1:2]]"
                    }
                ]
            }
        ]
    }
};
