// ============================================================
// ДАННЫЕ КУРСА
// Редактируется через app.html (режим «Редактор»).
// courseKey — уникальный ключ курса, не менять!
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
        ],
        "__id": "new_lesson_1"
    },
    "new_lesson": {
        "type": "theory",
        "title": "Знакомство с клиентом",
        "slides": [
            {
                "shortName": "Настроить \"Окно клиента под себя\"",
                "title": "Окно \"Клиенты\"",
                "content": [
                    {
                        "type": "quote",
                        "text": "Здесь подробно расписать почему важно знать клиента",
                        "variant": "blue"
                    },
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Зайти в клиента</span></div>"
                    },
                    {
                        "type": "image",
                        "src": "images/стартовая панель.png",
                        "alt": "",
                        "markers": [],
                        "highlights": [
                            {
                                "x": 28.0042101010101,
                                "y": 16.657564786852422,
                                "w": 14.7312,
                                "h": 68.7744,
                                "color": "red"
                            }
                        ],
                        "align": "left"
                    },
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Основное окно</span></div>"
                    },
                    {
                        "type": "image",
                        "src": "images/Окно Клиенты.png",
                        "alt": "",
                        "markers": [
                            {
                                "x": 16.5,
                                "y": 15.8,
                                "text": "С помощью этой кнопки можно настроить колонки под себя."
                            }
                        ],
                        "highlights": []
                    },
                    {
                        "type": "h3",
                        "text": "<div style=\"text-align:center\"><span>Настройка под себя</span></div>"
                    },
                    {
                        "type": "h3",
                        "text": "Настройка колонок и вкладок"
                    },
                    {
                        "type": "p",
                        "text": "Первое, что мы можем сделать для нашего удобства - выбрать какие нам нужны колонки. Нажимаем на кнопку <b>\"Настройка колонок и вкладок\"</b>"
                    },
                    {
                        "type": "image",
                        "src": "images/Кнопка Настройка колонок и вкладок.png",
                        "alt": "",
                        "markers": [],
                        "align": "center",
                        "width": 15
                    },
                    {
                        "type": "image",
                        "src": "images/Настройка колонок.png",
                        "alt": "",
                        "markers": []
                    },
                    {
                        "type": "p",
                        "text": "Так же столбцы можно выставить в удобном нам порядке"
                    },
                    {
                        "type": "video",
                        "src": "videos/Настройка столбцов.mp4"
                    },
                    {
                        "type": "p",
                        "text": "Нужно обязательно настраивать фильтры. Как это делать смотри в [[new_lesson_1:2]]"
                    }
                ],
                "_editedAt": "2026-10-19T10:19:32.502Z"
            },
            {
                "shortName": "Фильтры",
                "title": "Новый слайд",
                "content": [
                    {
                        "type": "p",
                        "text": "Текст нового слайда."
                    }
                ]
            }
        ],
        "__id": "new_lesson",
        "coverImage": "images/Обложка Знакомство с клиентом.png"
    }
};
