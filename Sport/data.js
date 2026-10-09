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
    "courseKey": "Sport",
    "pageTitle": "Sport",
    "courseTitle": "Sport"
};

const allLessons = {
    "new_memo": {
        "type": "memo",
        "title": "Chloe Ting",
        "cells": [
            {
                "title": "15 Min Toned Arms and Upper Body Workout",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>В ЗАЛЕ</span></div>"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Руки, плечи, спина (верхняя часть тела).</p><p><strong>Описание:</strong> Это часть челленджа \"Get Toned Challenge\". Видео создано специально для работы с гантелями, чтобы подтянуть руки и верх спины. Отлично подойдет для зала, если у тебя есть гантели разного веса. Если инвентаря нет, можно делать без него </p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "ВИДЕО",
                        "href": "https://vkvideo.ru/video-230650474_456239025"
                    }
                ]
            },
            {
                "title": "20 Min Booty Workout - Toned Legs & Glutes ",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\">В ЗАЛЕ</div><!--StartFragment--><!--EndFragment-->"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Ягодицы и мышцы ног (нижняя часть тела).</p><p><strong>Описание:</strong> Весовая тренировка на 20 минут для проработки ягодиц и ног. В описании сказано, что нужны гантели, но есть варианты выполнения без оборудования. Это часть челленджа \"Get Toned Challenge\"</p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "ВИДЕО",
                        "href": "https://vkvideo.ru/video-230650474_456239024"
                    }
                ]
            },
            {
                "title": "2024 Hourglass Challenge (любое видео из программы) ",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>В ЗАЛЕ</span></div>"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Ягодицы и кор (основной акцент), руки и спина (вспомогательный).</p><p><strong>Описание:</strong> Хлоя рекомендует проходить этот 4-недельный челлендж именно с гантелями для набора мышечной массы. Все эпизоды имеют взвешенные и невзвешенные альтернативы. Это самый тяжелый из ее \"Hourglass\" челленджей, так как он сильнее всего завязан на работу с весом .</p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "ВИДЕО",
                        "href": "https://vkvideo.ru/playlist/-230650474_13/season_undefined"
                    }
                ]
            },
            {
                "title": "Best Cooldown Stretches After Workout | Relaxation & Recovery",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>РАСТЯЖКА</span></div>"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Все тело (руки, спина, ноги, ягодицы).</p><p><strong>Описание:</strong> Очень популярная у пользователей рутина. Это расслабляющая растяжка всего тела на 10-15 минут. В отзыве подробно расписано, что там за позы: Cat-Cow, собака мордой вниз, выпады, растяжка подколенных сухожилий, поза голубя и поза ребенка. Все позиции держатся по 30 секунд. Это идеальный вариант для дома, чтобы снять напряжение после тяжелой тренировки</p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "Текст ссылки",
                        "href": "https://vkvideo.ru/video-230650474_456239196"
                    }
                ]
            },
            {
                "title": "Cooldown, Stretch and Relaxation Routine - After every workout",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>РАСТЯЖКА</span></div>"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Все тело.</p><p><strong>Описание:</strong> Еще одна 10-минутная заминка с растяжкой. Это часть челленджа \"2025 Summer Shred Challenge\". Видео подходит для выполнения после любой тренировки, чтобы помочь мышцам восстановиться и успокоить пульс </p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "Текст ссылки",
                        "href": "https://vkvideo.ru/video-230650474_456239017"
                    }
                ]
            },
            {
                "title": "5-минутная растяжка на все тело",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>РАСТЯЖКА</span></div>"
                    },
                    {
                        "type": "p",
                        "text": "<!--StartFragment--><p><strong>Группа мышц:</strong> Все тело.</p><p><strong>Описание:</strong> В подборке на Bilibili (и аналогичных видео на Rutube/VK) часто встречается короткая растяжка Хлои на 5-6 минут. Она начинается с позы ребенка и служит быстрым способом расслабить мышцы. Ищи по запросу \"Chloe Ting 5 min stretch\" или \"Chloe Ting растяжка\" </p><!--EndFragment-->"
                    },
                    {
                        "type": "link",
                        "text": "Текст ссылки",
                        "href": "https://vkvideo.ru/video-230650474_456239115"
                    }
                ]
            }
        ]
    }
};
