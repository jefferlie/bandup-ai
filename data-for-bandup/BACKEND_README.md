# База данных BandUp — инструкция для бэкенда

## Файлы

```
data-for-bandup/
├── SAT/
│   └── sat.db          (2.8 MB) — все вопросы SAT
├── IELTS/
│   └── ielts.db        (52 MB)  — все материалы IELTS
├── build_db.py         — пересобрать базовые данные (Writing + Speaking)
├── parse_cambridge.py  — переобработать Cambridge PDF через OCR
├── fetch_audioscripts.py — скачать аудиоскрипты C14/C15 онлайн
└── load_speaking_hf.py — обновить Speaking из HuggingFace
```

---

## SAT/sat.db

### Таблица: `questions`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | TEXT PK | Уникальный идентификатор вопроса |
| `section` | TEXT | `math`, `english`, `practice_test` |
| `domain` | TEXT | Тематика: `Advanced Math`, `Algebra`, `Craft and Structure`, `Standard English Conventions`, и т.д. |
| `difficulty` | TEXT | `Easy`, `Medium`, `Hard` |
| `question_text` | TEXT | Текст вопроса (может содержать LaTeX: `\( ... \)`) |
| `paragraph` | TEXT | Контекстный отрывок (NULL если нет) |
| `choices` | TEXT | JSON-объект `{"A": "...", "B": "...", "C": "...", "D": "..."}` |
| `correct_answer` | TEXT | Правильный ответ: `A`, `B`, `C`, или `D` |
| `explanation` | TEXT | Объяснение ответа |
| `visual_type` | TEXT | Тип визуала (NULL если нет) |
| `visual_svg` | TEXT | SVG-содержимое графика/диаграммы (NULL если нет) |

**Итого: 2 588 вопросов**

### Примеры запросов

```sql
-- Все Math вопросы уровня Hard
SELECT * FROM questions
WHERE section = 'math' AND difficulty = 'Hard';

-- Random вопрос по домену
SELECT * FROM questions
WHERE domain = 'Algebra'
ORDER BY RANDOM() LIMIT 1;

-- Разбивка по доменам
SELECT section, domain, difficulty, COUNT(*) as cnt
FROM questions
GROUP BY section, domain, difficulty
ORDER BY section, domain;
```

---

## IELTS/ielts.db

### Структура таблиц

```
cambridge_books               — метаданные книг (18 штук)
cambridge_reading_passages    — тексты Reading (456 штук)
cambridge_reading_questions   — вопросы к Reading (571 штук)
cambridge_listening_scripts   — аудиоскрипты Listening (267 штук)
cambridge_listening_questions — вопросы Listening (340 штук)
cambridge_answers             — ключ ответов (3067 записей)
writing_tasks                 — эссе Writing Task 2 (10 324 штуки)
speaking_questions            — вопросы Speaking Part 1/2/3 (293 штуки)
reading_passages              — базовые sample пассажи (3 штуки)
reading_questions             — вопросы к ним (15 штук)
listening_tasks               — базовые sample Listening (4 штуки)
listening_questions           — вопросы к ним (16 штук)
```

---

### Таблица: `cambridge_books`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `book_label` | TEXT | `Cambridge IELTS 17` |
| `book_number` | INTEGER | `17` |
| `pdf_filename` | TEXT | Имя PDF-файла |

---

### Таблица: `cambridge_reading_passages`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `book_id` | INTEGER FK | → `cambridge_books.id` |
| `book_label` | TEXT | `Cambridge IELTS 17` |
| `book_number` | INTEGER | `17` |
| `test_number` | INTEGER | `1`–`4` |
| `passage_number` | INTEGER | `1`–`3` |
| `title` | TEXT | Заголовок пассажа |
| `passage_text` | TEXT | Полный текст |

```sql
-- Все пассажи из Cambridge 17 Test 1
SELECT passage_number, title, SUBSTR(passage_text, 1, 200)
FROM cambridge_reading_passages
WHERE book_label = 'Cambridge IELTS 17' AND test_number = 1;

-- Random Academic Reading пассаж
SELECT * FROM cambridge_reading_passages
ORDER BY RANDOM() LIMIT 1;
```

---

### Таблица: `cambridge_reading_questions`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `book_id` | INTEGER FK | |
| `book_label` | TEXT | |
| `test_number` | INTEGER | |
| `passage_number` | INTEGER | |
| `question_number` | INTEGER | Номер вопроса (1–40) |
| `question_text` | TEXT | Текст вопроса |
| `question_type` | TEXT | `true_false_not_given`, `multiple_choice`, `completion`, `matching_headings`, `short_answer` |
| `choices` | TEXT | JSON `{"A": "...", "B": "..."}` (для multiple_choice) |
| `correct_answer` | TEXT | Правильный ответ (если найден в ключе) |

```sql
-- Вопросы к конкретному пассажу с ответами
SELECT q.question_number, q.question_text, q.question_type, q.correct_answer
FROM cambridge_reading_questions q
WHERE q.book_label = 'Cambridge IELTS 11'
  AND q.test_number = 1
  AND q.passage_number = 1
ORDER BY q.question_number;
```

---

### Таблица: `cambridge_listening_scripts`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `book_id` | INTEGER FK | |
| `book_label` | TEXT | |
| `test_number` | INTEGER | `1`–`4` |
| `section_number` | INTEGER | `1`–`4` |
| `title` | TEXT | Описание сценария (первая строка скрипта) |
| `script_text` | TEXT | Полный текст аудиоскрипта |

```sql
-- Аудиоскрипт конкретной секции
SELECT title, script_text
FROM cambridge_listening_scripts
WHERE book_label = 'Cambridge IELTS 14'
  AND test_number = 1
  AND section_number = 1;

-- Все секции одного теста
SELECT section_number, title, LENGTH(script_text) as chars
FROM cambridge_listening_scripts
WHERE book_label = 'Cambridge IELTS 15' AND test_number = 2
ORDER BY section_number;
```

---

### Таблица: `cambridge_answers`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `book_id` | INTEGER FK | |
| `book_label` | TEXT | |
| `test_number` | INTEGER | |
| `question_number` | INTEGER | |
| `answer` | TEXT | Правильный ответ |

```sql
-- Все ответы Cambridge 11 Test 1
SELECT question_number, answer
FROM cambridge_answers
WHERE book_label = 'Cambridge IELTS 11' AND test_number = 1
ORDER BY question_number;
```

---

### Таблица: `writing_tasks`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `task_type` | INTEGER | `2` (Task 2) |
| `prompt` | TEXT | Тема / вопрос эссе |
| `essay` | TEXT | Полный текст эссе |
| `evaluation` | TEXT | Детальный разбор по критериям (GPT-generated) |
| `band_score` | REAL | Оценка: 4.0–9.0 |

**10 324 эссе, средний band = 6.29**

```sql
-- Эссе с высоким band score
SELECT prompt, SUBSTR(essay, 1, 200), band_score
FROM writing_tasks
WHERE band_score >= 8.0
ORDER BY RANDOM() LIMIT 5;

-- Примеры эссе по теме (полнотекстовый поиск)
SELECT prompt, band_score
FROM writing_tasks
WHERE prompt LIKE '%technology%'
ORDER BY band_score DESC LIMIT 10;

-- Распределение по band score
SELECT band_score, COUNT(*) as cnt
FROM writing_tasks
GROUP BY band_score ORDER BY band_score;
```

---

### Таблица: `speaking_questions`

| Колонка | Тип | Описание |
|---|---|---|
| `id` | INTEGER PK | |
| `part` | INTEGER | `1`, `2`, или `3` |
| `topic` | TEXT | Тема (Work, Family, Technology, и т.д.) |
| `question` | TEXT | Текст вопроса |
| `cue_card` | TEXT | Текст cue card (только для Part 2) |
| `answer` | TEXT | Пример ответа band 7–8 |

```sql
-- Все Part 1 вопросы по теме Technology
SELECT question, answer
FROM speaking_questions
WHERE part = 1 AND topic LIKE '%Technology%';

-- Random cue card (Part 2) с примером ответа
SELECT topic, question, cue_card, answer
FROM speaking_questions
WHERE part = 2 AND answer IS NOT NULL
ORDER BY RANDOM() LIMIT 1;

-- Part 3 дискуссионные вопросы
SELECT topic, question FROM speaking_questions
WHERE part = 3 ORDER BY topic;
```

---

## Подключение к базе

### Python (sqlite3)
```python
import sqlite3, json

con = sqlite3.connect("IELTS/ielts.db")
con.row_factory = sqlite3.Row  # доступ по имени колонки

cur = con.cursor()
cur.execute("SELECT * FROM cambridge_reading_passages WHERE book_number = 17 LIMIT 1")
row = cur.fetchone()
print(row["title"], row["passage_text"][:100])
con.close()
```

### Node.js (better-sqlite3)
```js
const Database = require('better-sqlite3');
const db = new Database('IELTS/ielts.db');

// Синхронный API — удобно для Next.js
const passages = db.prepare(`
  SELECT * FROM cambridge_reading_passages
  WHERE book_number = ? AND test_number = ?
`).all(17, 1);

// choices — это JSON-строка, парсим
const questions = db.prepare(
  "SELECT * FROM questions WHERE section = 'math' AND difficulty = 'Hard' ORDER BY RANDOM() LIMIT 10"
).all();
questions.forEach(q => {
  q.choices = q.choices ? JSON.parse(q.choices) : {};
});
```

### Django ORM (если решите перейти на PostgreSQL)
```python
# Для импорта в PostgreSQL:
# python manage.py shell
import sqlite3, django
# Читаем из SQLite и вставляем через ORM
con = sqlite3.connect('IELTS/ielts.db')
rows = con.execute("SELECT * FROM writing_tasks LIMIT 100").fetchall()
# ... bulk_create(...)
```

---

## Обновление данных

```bash
# Обновить Writing + базовые Speaking данные
python3 build_db.py

# Переобработать Cambridge PDF (новая книга → положи в IELTS/cambridge/)
python3 parse_cambridge.py

# Обновить аудиоскрипты C14/C15 из интернета
python3 fetch_audioscripts.py

# Обновить Speaking вопросы из HuggingFace
python3 load_speaking_hf.py
```

---

## Известные ограничения

| Книга | Проблема |
|---|---|
| Cambridge IELTS 20 | Нет аудиоскриптов (PDF только с вопросами) |
| Cambridge IELTS 4  | Только 1 Listening секция (PDF обрезан) |
| Cambridge IELTS 15 | Только 2 Reading пассажа из PDF (но все 16 Listening секций есть) |
| cambridge_answers  | Ответы для C12, C18, C20 неполные (PDF-артефакты) |

---

## Советы по архитектуре

1. **Для продакшена** скопируй `.db` файлы на сервер и используй read-only подключение — SQLite отлично справляется с read-heavy нагрузкой (тысячи запросов/сек).

2. **Если нужны миграции** в PostgreSQL/MySQL — используй `sqlite3` → `pandas` → `to_sql()` или просто скрипт с bulk insert. Схема выше переносится 1-в-1.

3. **Full-text search** по Writing эссе и Reading passages — добавь FTS5 индекс:
   ```sql
   CREATE VIRTUAL TABLE writing_fts USING fts5(prompt, essay, content=writing_tasks);
   INSERT INTO writing_fts(writing_fts) VALUES('rebuild');
   -- Поиск: SELECT * FROM writing_fts WHERE writing_fts MATCH 'climate change';
   ```

4. **LaTeX в SAT вопросах** — рендери через MathJax или KaTeX на фронтенде. Паттерн: `\( ... \)` и `$ ... $`.
