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
    "pageTitle": "Артикли Тест",
    "courseTitle": "Артикли Тест"
};

const allLessons = {
    "new_quiz_1": {
        "type": "quiz",
        "title": "Тест тестов",
        "groups": [
            "1",
            "2",
            "3"
        ],
        "questions": [
            {
                "type": "single",
                "text": "Первый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": "1"
            },
            {
                "type": "single",
                "text": "Новый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": "2"
            },
            {
                "type": "single",
                "text": "Новый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": "3"
            },
            {
                "type": "single",
                "text": "Новый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": "3"
            },
            {
                "type": "single",
                "text": "Новый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": "2"
            }
        ],
        "randomizeQuestions": false,
        "randomizeOptions": false
    },
    "new_lesson_1": {
        "type": "theory",
        "title": "Тест теории",
        "slides": [
            {
                "shortName": "Новый слайд",
                "title": "Новый слайд",
                "content": [
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    },
                    {
                        "type": "table",
                        "header": true,
                        "rows": [
                            [
                                "Заголовок 1",
                                "Заголовок 2",
                                "dfgdsfgsdfg"
                            ],
                            [
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                ""
                            ]
                        ]
                    },
                    {
                        "type": "p",
                        "text": "sdmnfajfbgasljdfajsfajsdhfgjdsgfjkasdaf<br><br>"
                    }
                ]
            }
        ]
    },
    "new_memo": {
        "type": "memo",
        "title": "Новая памятка",
        "cells": [
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Первый пункт",
                                "level": 0
                            },
                            {
                                "text": "Второй пункт",
                                "level": 0
                            }
                        ],
                        "style": "bullet"
                    },
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Первый пункт",
                                "level": 0
                            },
                            {
                                "text": "Второй пункт",
                                "level": 0
                            },
                            {
                                "text": "Третий пункт",
                                "level": 0
                            }
                        ],
                        "style": "bullet"
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Первый пункт",
                                "level": 0
                            },
                            {
                                "text": "Второй пункт",
                                "level": 0
                            }
                        ],
                        "style": "bullet"
                    },
                    {
                        "type": "quote",
                        "text": "Выделенная мысль"
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Первый пункт",
                                "level": 0
                            },
                            {
                                "text": "Второй пункт",
                                "level": 0
                            }
                        ],
                        "style": "bullet"
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    }
                ]
            }
        ]
    },
    "new_quiz_2": {
        "type": "quiz",
        "title": "Новый тест",
        "randomizeQuestions": false,
        "randomizeOptions": false,
        "groups": [
            "Артикли",
            "Буквы",
            "Слова"
        ],
        "questions": [
            {
                "type": "single",
                "text": "Первый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A"
                ],
                "explain": "Объяснение правильного ответа.",
                "group": null
            },
            {
                "type": "single",
                "text": "Какой артикль перед cat?",
                "options": [
                    "A",
                    "An",
                    "The",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "Перед согласными — A",
                "group": "Артикли"
            },
            {
                "type": "multi",
                "text": "Выберите гласные",
                "options": [
                    "A",
                    "E",
                    "F",
                    "G"
                ],
                "correct": [
                    "A",
                    "E"
                ],
                "explain": "A и E — гласные",
                "group": "Буквы"
            },
            {
                "type": "single",
                "text": "Пример без объяснения",
                "options": [
                    "Да",
                    "Нет"
                ],
                "correct": [
                    "Да"
                ],
                "explain": "",
                "group": null
            },
            {
                "type": "match",
                "text": "Соедини слово и перевод",
                "pairs": [
                    {
                        "left": "nature",
                        "right": "природа"
                    },
                    {
                        "left": "wool",
                        "right": "шерсть"
                    },
                    {
                        "left": "fault",
                        "right": "вина"
                    },
                    {
                        "left": "version",
                        "right": "версия"
                    },
                    {
                        "left": "create",
                        "right": "создать"
                    }
                ],
                "explain": "",
                "group": "Слова"
            },
            {
                "type": "match",
                "text": "Меньше пар — ок",
                "pairs": [
                    {
                        "left": "cat",
                        "right": "кот"
                    },
                    {
                        "left": "dog",
                        "right": "собака"
                    }
                ],
                "explain": "",
                "group": null
            },
            {
                "type": "card",
                "front": "nature",
                "frontImage": "images/nature.png",
                "back": "природа",
                "backImage": "",
                "group": "Слова"
            },
            {
                "type": "card",
                "front": "wool",
                "frontImage": "",
                "back": "шерсть",
                "backImage": "",
                "group": "Слова"
            },
            {
                "type": "card",
                "front": "fault",
                "frontImage": "",
                "back": "вина",
                "backImage": "",
                "group": "Слова"
            }
        ]
    },
    "new_glossary": {
        "type": "glossary",
        "title": "Новый глоссарий",
        "terms": [
            {
                "name": "AA",
                "content": [
                    {
                        "type": "p",
                        "text": "МЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯУ"
                    }
                ]
            },
            {
                "name": "А",
                "content": [
                    {
                        "type": "p",
                        "text": "МЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯЯУ"
                    }
                ]
            },
            {
                "name": "Новый термин",
                "content": [
                    {
                        "type": "p",
                        "text": "Определение термина."
                    },
                    {
                        "type": "link",
                        "text": "ВИДЕО",
                        "href": "https://vkvideo.ru/video-230650474_456239024"
                    }
                ]
            },
            {
                "name": "Новый термин",
                "content": [
                    {
                        "type": "p",
                        "text": "Определение термина."
                    }
                ]
            }
        ]
    }
};
