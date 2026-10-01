// ============================================================
// ДАННЫЕ КУРСА
// Редактируется через admin.html.
// Типы блоков: lesson.type = "theory" | "quiz" | "memo".
// Тип вопроса: q.type = "single" | "multi" | "match" | "card".
// single/multi: { text, options, correct: [массив], explain, group }
// match:        { text, pairs: [{left, right}], explain?, group }
// card:         { front, frontImage, back, backImage, group }
// memo:         { title, cells: [{ title, content: [...] }] }
// randomizeQuestions / randomizeOptions — перемешивание.
// Контент слайдов/ячеек: блоки p, h3, ul, quote, link, image, video.
// ============================================================

const courseSettings = {
    "pageTitle": "Артикли Тест",
    "courseTitle": "Артикли Тест"
};

const allLessons = {
    "new_lesson": {
        "type": "theory",
        "title": "Тест Теории",
        "slides": [
            {
                "shortName": "Тест",
                "title": "Тест",
                "content": [
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    },
                    {
                        "type": "p",
                        "text": "ААААААААААААААААААА"
                    },
                    {
                        "type": "h3",
                        "text": "АБОБА"
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    },
                    {
                        "type": "h3",
                        "text": "Новый подзаголовок"
                    },
                    {
                        "type": "p",
                        "text": "Новый абзац"
                    }
                ]
            }
        ]
    },
    "new_quiz_1": {
        "type": "quiz",
        "title": "Новый тест",
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
                "type": "match",
                "text": "Соедини пары",
                "pairs": [
                    {
                        "left": "Ы",
                        "right": "Ы"
                    },
                    {
                        "left": "А",
                        "right": "А"
                    },
                    {
                        "left": "Б",
                        "right": "Б"
                    },
                    {
                        "left": "В",
                        "right": "В"
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
        ],
        "randomizeQuestions": false,
        "randomizeOptions": false
    },
    "new_quiz": {
        "type": "quiz",
        "title": "ТЕСТ",
        "randomizeQuestions": true,
        "randomizeOptions": true,
        "groups": [],
        "questions": [
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
            },
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
            },
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
            },
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
            },
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
            },
            {
                "type": "card",
                "front": "Да",
                "frontImage": "",
                "back": "Нет",
                "backImage": "",
                "group": null
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
                            "Первый пункт",
                            "Второй пункт",
                            "Новый пункт",
                            "Новый пункт"
                        ]
                    },
                    {
                        "type": "image",
                        "src": "images/1.png",
                        "alt": ""
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            "Первый пункт",
                            "Второй пункт"
                        ]
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Первый пункт",
                            "Второй пункт",
                            "Третий пункт"
                        ]
                    }
                ]
            },
            {
                "title": "НОВАЯ ЯЧЕЙКА",
                "content": [
                    {
                        "type": "ul",
                        "items": [
                            "Первый пункт",
                            "Второй пункт"
                        ]
                    },
                    {
                        "type": "p",
                        "text": "Новый dkhfskdjfhskjdfhkdjs"
                    }
                ]
            }
        ]
    }
};
