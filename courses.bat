@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Конструктор курсов

REM Переходим в папку, где лежит батник
cd /d "%~dp0"

set "SOURCE=_source"
set "COURSE_FILES=admin.html admin.css admin.js index.html index.css index.js"

:menu
cls
echo.
echo  ========================================================
echo    КОНСТРУКТОР КУРСОВ
echo  ========================================================
echo    Папка: %CD%
echo  ========================================================
echo.
echo   [1] Создать новый курс
echo   [2] Обновить ВСЕ курсы из _source
echo   [3] Запустить сервер (для правок с телефона и сохранения в один клик)
echo   [4] Выход
echo.
set /p choice="  Твой выбор: "

if "%choice%"=="1" goto createCourse
if "%choice%"=="2" goto updateAll
if "%choice%"=="3" goto runServer
if "%choice%"=="4" goto end
goto menu

REM ============================================================
REM СОЗДАНИЕ НОВОГО КУРСА
REM ============================================================
:createCourse
cls
echo.
echo  ========================================================
echo    СОЗДАНИЕ НОВОГО КУРСА
echo  ========================================================
echo.
if not exist "%SOURCE%\" (
    echo  [ОШИБКА] Папка "%SOURCE%" не найдена.
    echo  Создай её и положи туда admin.html, admin.js, index.html, index.js и т.д.
    echo.
    pause
    goto menu
)
echo  Введи имя папки курса (латиница, без пробелов).
echo  Пример: english, history, law
echo.
set /p foldername="  Имя папки: "
if "%foldername%"=="" (
    echo  [ОШИБКА] Имя не введено.
    pause
    goto menu
)
if exist "%foldername%\" (
    echo  [ОШИБКА] Папка "%foldername%" уже существует.
    pause
    goto menu
)
echo.
echo  Введи красивое название курса (можно по-русски, с пробелами).
echo  Пример: Английский: Артикли
echo.
set /p coursename="  Название: "
if "%coursename%"=="" set "coursename=%foldername%"

echo.
echo  Создаю папку "%foldername%"...
mkdir "%foldername%" 2>nul
if errorlevel 1 (
    echo  [ОШИБКА] Не удалось создать папку.
    pause
    goto menu
)

echo  Копирую файлы...
for %%f in (%COURSE_FILES%) do (
    if exist "%SOURCE%\%%f" (
        copy /Y "%SOURCE%\%%f" "%foldername%\%%f" >nul
        echo    + %%f
    ) else (
        echo    - %%f (нет в %SOURCE%)
    )
)

echo  Копирую папку fonts...
if exist "%SOURCE%\fonts\" (
    xcopy /E /I /Y /Q "%SOURCE%\fonts" "%foldername%\fonts" >nul
    echo    + fonts/
) else (
    echo    - fonts/ (нет в %SOURCE%)
)

echo  Создаю папки images и videos...
if not exist "%foldername%\images\" mkdir "%foldername%\images"
if not exist "%foldername%\videos\" mkdir "%foldername%\videos"
echo    + images/
echo    + videos/

echo  Создаю пустой data.js...

set "NEW_FILE=%foldername%\data.js"
set "NEW_NAME=%coursename%"
set "NEW_KEY=%foldername%"
call :makeEmptyData

echo.
echo  ========================================================
echo   ГОТОВО! Курс "%coursename%" создан в папке "%foldername%".
echo  ========================================================
echo.
echo  Что делать дальше:
echo    1. Открой %foldername%\admin.html двойным кликом
echo    2. Наполни курс
echo    3. Нажми "Сохранить" — обновится data.js
echo.
echo  И не забудь добавить курс в courses.js!
echo.
pause
goto menu

REM ============================================================
REM ОБНОВЛЕНИЕ ВСЕХ КУРСОВ
REM ============================================================
:updateAll
cls
echo.
echo  ========================================================
echo    ОБНОВЛЕНИЕ ВСЕХ КУРСОВ
echo  ========================================================
echo.
if not exist "%SOURCE%\" (
    echo  [ОШИБКА] Папка "%SOURCE%" не найдена.
    echo.
    pause
    goto menu
)
echo  Будут перезаписаны файлы:
echo    %COURSE_FILES%
echo.
echo  во ВСЕХ папках курсов.
echo.
echo  Файл data.js НЕ тронется.
echo  Папки images/, videos/ и fonts/ НЕ тронутся.
echo.
set /p confirm="  Продолжить? (y/n): "
if /i not "%confirm%"=="y" goto menu

echo.
set count=0
for /d %%d in (*) do (
    if /i not "%%d"=="%SOURCE%" (
        if exist "%%d\data.js" (
            call :updateCourse "%%d"
            set /a count+=1
        )
    )
)

echo.
echo  ========================================================
echo   Обновлено курсов: !count!
echo  ========================================================
echo.
pause
goto menu

:updateCourse
set "target=%~1"
echo  Обновляю %target%...
for %%f in (%COURSE_FILES%) do (
    if exist "%SOURCE%\%%f" (
        copy /Y "%SOURCE%\%%f" "%target%\%%f" >nul
    )
)
goto :eof

REM ============================================================
REM СОЗДАНИЕ ПУСТОГО data.js
REM ============================================================
:makeEmptyData
(
echo // ============================================================
echo // ДАННЫЕ КУРСА
echo // Редактируется через admin.html.
echo // courseKey — уникальный ключ курса, не менять!
echo // ============================================================
echo.
echo const courseSettings = {
echo     "courseKey": "%NEW_KEY%",
echo     "pageTitle": "%NEW_NAME%",
echo     "courseTitle": "%NEW_NAME%"
echo };
echo.
echo const allLessons = {
echo     "new_lesson": {
echo         "type": "theory",
echo         "title": "Первый блок",
echo         "slides": [
echo             {
echo                 "shortName": "Слайд 1",
echo                 "title": "Первый слайд",
echo                 "content": [
echo                     { "type": "p", "text": "Это первый слайд нового курса." }
echo                 ]
echo             }
echo         ]
echo     }
echo };
) > "%NEW_FILE%"
goto :eof

REM ============================================================
REM ЗАПУСК СЕРВЕРА
REM ============================================================
:runServer
cls
echo.
echo  ========================================================
echo    ЗАПУСК ЛОКАЛЬНОГО СЕРВЕРА
echo  ========================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo  [ОШИБКА] Node.js не установлен.
    echo  Скачай с https://nodejs.org/ и установи.
    echo.
    pause
    goto menu
)
if not exist "server.js" (
    echo  [ОШИБКА] Файл server.js не найден в папке %CD%.
    echo  Положи server.js рядом с courses.bat.
    echo.
    pause
    goto menu
)
echo  Запускаю сервер...
echo  Закрой это окно или нажми Ctrl+C, чтобы остановить.
echo.
start "" http://localhost:3000/courses.html
node server.js
pause
goto menu
:end
endlocal
exit /b 0