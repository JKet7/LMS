// ============================================================
// ДАННЫЕ КУРСА
// Редактируется через admin.html.
// Типы блоков: lesson.type = "theory" | "quiz" | "memo".
// Тип вопроса: q.type = "single" | "multi" | "match" | "card".
// single/multi: { text, options, correct: [массив], explain, group }
// match:        { text, pairs: [{left, right}], explain?, group }
// card:         { front, frontImage, back, backImage, group }
// memo:         { title, cells: [{ title, content: [...] }] }
// table:        { type: "table", header: bool, rows: [[...], [...]] }
// randomizeQuestions / randomizeOptions — перемешивание.
// Контент слайдов/ячеек: блоки p, h3, ul, quote, link, image, video, table.
// ============================================================

const courseSettings = {
    "pageTitle": "Артикли Тест",
    "courseTitle": "Артикли Тест"
};

const allLessons = {
    "new_lesson": {
        "type": "theory",
        "title": "Артикли",
        "slides": [
            {
                "shortName": "A",
                "title": "A",
                "image": "",
                "video": "",
                "content": [
                    {
                        "type": "h3",
                        "text": "Когда используем?"
                    },
                    {
                        "type": "p",
                        "text": "Перед исчисляемыми сущ. в ед.ч., начинающимися с согласного звука (не буквы!): a user, a prompt, a URL (звук [juː])"
                    },
                    {
                        "type": "h3",
                        "text": "Примеры"
                    },
                    {
                        "type": "p",
                        "text": "I need a new prompt."
                    }
                ]
            },
            {
                "shortName": "An",
                "title": "An",
                "image": "",
                "video": "",
                "content": [
                    {
                        "type": "h3",
                        "text": "<div><span style=\"white-space: pre; white-space: normal;\">\t</span></div><div>Когда используется</div>"
                    },
                    {
                        "type": "p",
                        "text": "Перед исчисляемыми сущ. в ед.ч., начинающимися с гласного звука: an AI, an image, an error, an hour"
                    },
                    {
                        "type": "h3",
                        "text": "<div><span style=\"white-space: pre; white-space: normal;\">\t</span></div><div>Примеры</div>"
                    },
                    {
                        "type": "p",
                        "text": "She wrote an excellent prompt."
                    }
                ]
            },
            {
                "shortName": "The",
                "title": "The",
                "image": "",
                "video": "",
                "content": [
                    {
                        "type": "h3",
                        "text": "Когда используется"
                    },
                    {
                        "type": "p",
                        "text": "Когда предмет конкретный, уже известный собеседнику, уникальный или упомянут ранее"
                    },
                    {
                        "type": "h3",
                        "text": "Все случаи"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Объект уже упоминался в разговоре (I saw a cat. The cat was black.)",
                            "Собеседники понимают, о чём речь из контекста (Close the door. — дверь в этой комнате)",
                            "Есть уточняющая фраза после существительного (The book on the table; The model we trained)",
                            "Уникальные объекты (The sun, the moon, the earth, the sky, the universe)<br>",
                            "Порядковые числительные (The first, the second, the last)<br>",
                            "Превосходная степень (The best, the most important, the fastest)",
                            "Океаны, моря, реки, каналы: The Pacific, The Black Sea, The Nile, The Suez Canal",
                            "Горные цепи (массивы), но НЕ отдельные горы: The Alps, The Himalayas, The Andes (но: Mount Everest)",
                            "Архипелаги (группы островов), но НЕ одиночные острова: The Philippines, The Canary Islands (но: Madagascar, Bali)",
                            "Стороны света: The North, The South, The East, The West",
                            "Пустыни: The Sahara, The Gobi",
                            "Страны и регионы&nbsp;НО: France, Germany, Japan, China, Russia (без артикля)",
                            "Семьи и группы людей (The Smiths (семья Смитов), The Russians (русские как нация))&nbsp;",
                            "Музыкальные инструменты (когда говорим об умении играть)&nbsp;Play the piano, play the guitar",
                            "Прилагательные в значении существительных (группы людей) (The rich (богатые), the poor (бедные), the elderly (пожилые), the young (молодёжь))",
                            "Названия газет, отелей, музеев, театров, кораблей The New York Times, The Hilton, The Louvre, The Titanic",
                            "Десятилетия и века: The 1990s, the 21st century"
                        ]
                    },
                    {
                        "type": "h3",
                        "text": "Примеры"
                    },
                    {
                        "type": "p",
                        "text": "The model we tested; the Internet; the first step"
                    }
                ]
            },
            {
                "shortName": "-",
                "title": "-",
                "image": "",
                "video": "",
                "content": [
                    {
                        "type": "h3",
                        "text": "Когда используется"
                    },
                    {
                        "type": "ul",
                        "items": [
                            "Неисчисляемые сущ.",
                            "Множественное число",
                            "Имена собственные, языки, города",
                            "Абстрактные понятия"
                        ]
                    },
                    {
                        "type": "h3",
                        "text": "Примеры"
                    },
                    {
                        "type": "p",
                        "text": "AI is powerful; I speak English; Prompts matter"
                    }
                ]
            }
        ]
    },
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
    "new_quiz": {
        "type": "quiz",
        "title": "Артикли",
        "questions": [
            {
                "type": "single",
                "text": "I saw ___ cat in the garden.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "cat — исчисляемое существительное в единственном числе, упоминается впервые, перед согласным звуком /k/ → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "She bought ___ umbrella yesterday.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "umbrella начинается с гласного звука /ʌ/ → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ sun rises in the east.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Солнце — уникальный объект, единственное в своём роде → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "He is ___ honest man.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "В honest буква h не читается, первый звук гласный /ɒ/ → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "We went to ___ school by bus.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "go to school — устойчивое выражение в значении «ходить в школу/учиться», артикль не нужен.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "Can you close ___ door, please?",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Речь о конкретной двери в комнате → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "I need ___ new phone.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "phone — исчисляемое, единственное число, первое упоминание, согласный звук → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "She has ___ orange in her bag.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "orange начинается с гласного звука → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ Amazon is the longest river in South America.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Названия рек употребляются с the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "He plays ___ piano very well.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "После play с музыкальными инструментами обычно ставится the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "They have ___ dog and two cats.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "dog — исчисляемое, единственное число, первое упоминание → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ Mount Everest is the highest mountain.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Названия отдельных горных вершин обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "I usually have ___ breakfast at 7.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Названия приёмов пищи обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "This is ___ best day of my life.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Перед превосходной степенью best → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "She is ___ teacher.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "Профессия в единственном числе, согласный звук → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "We need ___ hour to finish.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "hour начинается с гласного звука, h не читается → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ water is important for life.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "water — неисчисляемое, речь о воде вообще → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "Please pass me ___ salt.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Конкретная соль на столе → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "I saw ___ elephant at the zoo.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "elephant начинается с гласного звука → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "He goes to ___ bed at 10.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "go to bed — устойчивое выражение, артикль не нужен.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "___ Netherlands is a country in Europe.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Название страны The Netherlands употребляется с the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "She wants to be ___ engineer.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "engineer начинается с гласного звука, профессия → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "We visited ___ Louvre in Paris.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Названия музеев обычно употребляются с the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "I have ___ idea!",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "idea начинается с гласного звука, единственное число → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ happiness cannot be bought.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Абстрактное неисчисляемое существительное в общем смысле → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "He is ___ tallest boy in class.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Превосходная степень tallest → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "My father is ___ doctor.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "Профессия в единственном числе, согласный звук → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "They live in ___ old house.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "old начинается с гласного звука → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ Europe is a continent.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Названия континентов обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "I will meet you at ___ airport.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Конкретный аэропорт, о котором договорились или который имеется в виду → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "She bought ___ dress.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "dress — исчисляемое, единственное число, первое упоминание → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "We saw ___ film last night.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "film — исчисляемое, единственное число, первое упоминание → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "We saw a film last night. ___ film was very boring.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Повторное упоминание того же фильма → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "He is learning ___ English.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Названия языков обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "I like ___ music.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "music — неисчисляемое, речь о музыке вообще → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "She played ___ violin at the concert.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Музыкальный инструмент после play → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "___ Alps are in Europe.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Названия горных цепей/систем употребляются с the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "He goes to work by ___ car.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "by car — устойчивое выражение, артикль не нужен.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "There is ___ apple on the table.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "apple начинается с гласного звука, единственное число → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ apple on the table is red.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Конкретное яблоко, уточнённое оборотом on the table → the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "I need ___ information.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "information — неисчисляемое существительное → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "She gave me ___ advice.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "advice — неисчисляемое существительное → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "He is ___ university student.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "A"
                ],
                "explain": "university начинается с согласного звука /juː/ → a.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "It took ___ hour and a half.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "hour начинается с гласного звука, h не читается → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ Pacific Ocean is the largest.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Названия океанов употребляются с the.",
                "group": "The"
            },
            {
                "type": "single",
                "text": "We had ___ lunch at noon.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Название приёма пищи lunch обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "She is ___ only child.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "An"
                ],
                "explain": "only начинается с гласного звука /oʊ/; выражение an only child означает «единственный ребёнок в семье» → an.",
                "group": "AN/A"
            },
            {
                "type": "single",
                "text": "___ Russia is the largest country.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "Названия стран в единственном числе обычно без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "I bought ___ bread.",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "-"
                ],
                "explain": "bread — неисчисляемое существительное → без артикля.",
                "group": "Без артикля"
            },
            {
                "type": "single",
                "text": "He is ___ best student in our group.\n",
                "options": [
                    "The",
                    "A",
                    "An",
                    "-"
                ],
                "correct": [
                    "The"
                ],
                "explain": "Превосходная степень best → the.",
                "group": "The"
            }
        ],
        "groups": [
            "AN/A",
            "The",
            "Без артикля"
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
                                "FFFFFFFF",
                                "DSFDFS",
                                "dsfgsdfg"
                            ],
                            [
                                "SDFSDFSDf",
                                "fgdfshdfghadgfgd",
                                "dfsgsdf"
                            ],
                            [
                                "dfgadfgadfg",
                                "",
                                "gdsfgdsfgdsf"
                            ]
                        ]
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
                            "Первый пункт",
                            "Второй пункт"
                        ]
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
    }
};
