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
    "courseKey": "Test",
    "pageTitle": "Тестирование",
    "courseTitle": "Тестирование"
};

const allLessons = {
    "new_lesson": {
        "type": "theory",
        "title": "Теория",
        "slides": [
            {
                "shortName": "Проверяем текст теории",
                "title": "Первый слайд",
                "content": [
                    {
                        "type": "p",
                        "text": "Проверяем текст теории"
                    },
                    {
                        "type": "h3",
                        "text": "<!--StartFragment-->Проверяем текст теории<!--EndFragment-->"
                    },
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Бваыва",
                                "level": 0
                            },
                            {
                                "text": "ЫВаыоаврпыорав",
                                "level": 1
                            },
                            {
                                "text": "Ага-ага",
                                "level": 2
                            },
                            {
                                "text": "Что-то",
                                "level": 0
                            }
                        ],
                        "style": "checkbox"
                    },
                    {
                        "type": "quote",
                        "text": "<!--StartFragment-->Проверяем текст теории<!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "На теорию",
                        "href": "#new_lesson:2"
                    }
                ]
            },
            {
                "shortName": "Проверяем медиа теории",
                "title": "Проверяем медиа теории",
                "content": [
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Проверяем медиа теории<!--EndFragment-->"
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    },
                    {
                        "type": "video",
                        "src": "videos/1.mp4"
                    },
                    {
                        "type": "link",
                        "text": "Текст ссылки",
                        "href": "#Проверяем текст теории"
                    },
                    {
                        "type": "table",
                        "header": true,
                        "rows": [
                            [
                                "Заголовок 1",
                                "Заголовок 2",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "Хоп",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ]
                        ]
                    }
                ]
            }
        ]
    },
    "new_quiz": {
        "type": "quiz",
        "title": "Тест",
        "randomizeQuestions": true,
        "randomizeOptions": true,
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
                "group": null
            },
            {
                "type": "multi",
                "text": "Новый вопрос?",
                "options": [
                    "Вариант A",
                    "Вариант B",
                    "Вариант C",
                    "Вариант D"
                ],
                "correct": [
                    "Вариант A",
                    "Вариант C"
                ],
                "explain": "",
                "group": "1"
            },
            {
                "type": "match",
                "text": "Соедини пары",
                "pairs": [
                    {
                        "left": "Слово 1",
                        "right": "Перевод 1"
                    },
                    {
                        "left": "Слово 2",
                        "right": "Перевод 2"
                    },
                    {
                        "left": "Слово 3",
                        "right": "Перевод 3"
                    },
                    {
                        "left": "4",
                        "right": "4"
                    },
                    {
                        "left": "5",
                        "right": "5"
                    },
                    {
                        "left": "6",
                        "right": "6"
                    },
                    {
                        "left": "7",
                        "right": "7"
                    },
                    {
                        "left": "8",
                        "right": "8"
                    },
                    {
                        "left": "9",
                        "right": "9"
                    },
                    {
                        "left": "10",
                        "right": "10"
                    },
                    {
                        "left": "11",
                        "right": "11"
                    },
                    {
                        "left": "12",
                        "right": "12"
                    },
                    {
                        "left": "13",
                        "right": "13"
                    },
                    {
                        "left": "14",
                        "right": "14"
                    },
                    {
                        "left": "15",
                        "right": "15"
                    }
                ],
                "explain": "",
                "group": "1"
            },
            {
                "type": "card",
                "front": "nature",
                "frontImage": "images/1.png",
                "back": "природа",
                "backImage": "",
                "group": "1"
            }
        ]
    },
    "new_memo": {
        "type": "memo",
        "title": "Памятка",
        "cells": [
            {
                "title": "Списки",
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
                                "level": 1
                            },
                            {
                                "text": "Второй пункт",
                                "level": 0
                            },
                            {
                                "text": "Третий пункт",
                                "level": 1
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
                "title": "Абзац и подзаголовок",
                "content": [
                    {
                        "type": "h3",
                        "text": "<!--StartFragment-->Проверяем текст. <!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment-->"
                    }
                ]
            },
            {
                "title": "ССЫЛКИ",
                "content": [
                    {
                        "type": "quote",
                        "text": "Выделенная мысль"
                    },
                    {
                        "type": "link",
                        "text": "На теорию",
                        "href": "#new_lesson"
                    },
                    {
                        "type": "link",
                        "text": "На меня",
                        "href": "https://vk.ru/jket7"
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "video",
                        "src": "videos/1.mp4"
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    }
                ]
            },
            {
                "title": "Таблица",
                "content": [
                    {
                        "type": "table",
                        "header": true,
                        "rows": [
                            [
                                "Заголовок 1",
                                "Заголовок 2",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "Татьяна Чернецкая",
                                "18.12.2024",
                                "не прошла обучение",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "Корсукова Надежда",
                                "03.02.2025",
                                "не прошла обучение",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "Зайцева Екатерина",
                                "10.02.2025",
                                "не прошла обучение",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "Недзвецкая Юлия",
                                "19.03.2025",
                                "не прошла обучение",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ]
                        ]
                    }
                ]
            },
            {
                "title": "Списки 2",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            {
                                "text": "Я на улице → I am on the street.",
                                "level": 0
                            },
                            {
                                "text": "Она в офисе → She is in the office.",
                                "level": 1
                            },
                            {
                                "text": "Они на улице → They are on the street.",
                                "level": 2
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
                    }
                ]
            }
        ]
    },
    "new_glossary": {
        "type": "glossary",
        "title": "Глоссарий",
        "terms": [
            {
                "name": "А",
                "content": [
                    {
                        "type": "p",
                        "text": "Определение термина."
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    }
                ]
            },
            {
                "name": "А",
                "content": [
                    {
                        "type": "p",
                        "text": "Определение термина."
                    },
                    {
                        "type": "video",
                        "src": "videos/1.mp4"
                    }
                ]
            },
            {
                "name": "D",
                "content": [
                    {
                        "type": "p",
                        "text": "<!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--StartFragment-->Проверяем текст. <!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment--><!--EndFragment-->"
                    }
                ]
            },
            {
                "name": "T",
                "content": [
                    {
                        "type": "p",
                        "text": "Определение термина."
                    },
                    {
                        "type": "table",
                        "header": true,
                        "rows": [
                            [
                                "Заголовок 1",
                                "Заголовок 2",
                                "ПАРАРАРАРАРААААААААААААААААААААА",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ],
                            [
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                ""
                            ]
                        ]
                    }
                ]
            }
        ]
    }
};
