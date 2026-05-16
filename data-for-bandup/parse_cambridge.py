#!/usr/bin/env python3
"""
Cambridge IELTS PDF OCR Parser
Парсит все Cambridge IELTS книги → сохраняет в IELTS/ielts.db

Таблицы:
  cambridge_books          — метаданные книг
  cambridge_reading_passages — тексты Reading passages
  cambridge_reading_questions — вопросы к Reading
  cambridge_listening_scripts — аудиоскрипты Listening
  cambridge_listening_questions — вопросы Listening
  cambridge_answers        — ключи ответов
"""

import os
import re
import io
import json
import sqlite3
import sys
from pathlib import Path

import fitz          # pymupdf
import pytesseract
from PIL import Image

BASE = Path(__file__).parent
CAMBRIDGE_DIR = BASE / "IELTS" / "cambridge"
DB_PATH = BASE / "IELTS" / "ielts.db"
CACHE_DIR = BASE / "IELTS" / ".ocr_cache"
CACHE_DIR.mkdir(exist_ok=True)

# ─── OCR ────────────────────────────────────────────────────

def ocr_page(doc, page_num: int, book_stem: str) -> str:
    """Возвращает текст страницы (нативный или OCR). Кэшируется."""
    cache_file = CACHE_DIR / f"{book_stem}_p{page_num:04d}.txt"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8")

    page = doc[page_num]

    # Нативный текст (C20 и подобные)
    native = page.get_text().strip()
    if len(native.split()) > 30:
        # Убираем повторяющийся колонтитул Cambridge Press
        native = re.sub(r'CAMBRIDGE Cambridge University Press.*?(?=\n|$)', '', native, flags=re.IGNORECASE)
        cache_file.write_text(native.strip(), encoding="utf-8")
        return native.strip()

    # OCR: если несколько изображений — берём самое большое
    images = page.get_images(full=True)
    best_img = None
    best_px = 0
    for img_info in images:
        xref = img_info[0]
        base_image = doc.extract_image(xref)
        img = Image.open(io.BytesIO(base_image["image"]))
        px = img.size[0] * img.size[1]
        if px > best_px:
            best_px = px
            best_img = img

    if best_img is None:
        mat = fitz.Matrix(2.5, 2.5)
        pix = page.get_pixmap(matrix=mat)
        best_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    text = pytesseract.image_to_string(best_img, lang="eng", config="--psm 6 --dpi 200")
    cache_file.write_text(text, encoding="utf-8")
    return text


# ─── Паттерны ───────────────────────────────────────────────

RE_TEST_HEADER   = re.compile(r'\bTEST\s+(\d)\b', re.IGNORECASE)
RE_READING_PASS  = re.compile(r'READING\s+PASSAGE\s*(\d)', re.IGNORECASE)
RE_LISTENING_SEC = re.compile(r'\bSECTION\s+(\d)\b', re.IGNORECASE)
RE_AUDIOSCRIPT   = re.compile(r'\b(?:Audioscripts?|Tapescripts?|Tape\s+scripts?)\b', re.IGNORECASE)
RE_ANSWER_KEY    = re.compile(r'\bAnswer\s+Key\b|\bANSWERS\b', re.IGNORECASE)
RE_QUESTION_NUM  = re.compile(r'^\s*(\d{1,2})\s+', re.MULTILINE)
RE_ANSWERS_LINE  = re.compile(r'^(\d{1,2})\s+([A-Z][A-Z\s/]*|TRUE|FALSE|NOT\s*GIVEN|YES|NO)$', re.IGNORECASE | re.MULTILINE)
RE_TFNG          = re.compile(r'TRUE.*FALSE.*NOT\s*GIVEN|YES.*NO.*NOT\s*GIVEN', re.IGNORECASE | re.DOTALL)
RE_CHOICES       = re.compile(r'\b([A-D])\s+(.+?)(?=\n[A-D]\s|\n\n|$)', re.DOTALL)

NOISE_PAT = re.compile(r'[^\x20-\x7E\n]+')  # убираем мусор от OCR

def clean(text: str) -> str:
    text = NOISE_PAT.sub(' ', text)
    text = re.sub(r' {3,}', '  ', text)
    return text.strip()


# ─── Определение типа страницы ───────────────────────────────

def classify_page(text: str) -> str:
    t = text.upper()
    if RE_AUDIOSCRIPT.search(text): return "audioscript_header"
    if RE_ANSWER_KEY.search(text):   return "answer_key"
    if RE_READING_PASS.search(text): return "reading"
    if "SECTION" in t and ("CONVERSATION" in t or "TALK" in t or "INTERVIEW" in t):
        return "listening"
    if RE_LISTENING_SEC.search(text) and "Questions" in text: return "listening_questions"
    if "Questions" in text and ("TRUE" in t or "FALSE" in t or
       re.search(r'\b[A-D]\s', text) or re.search(r'^\s*\d+\s+\w', text, re.M)):
        return "questions"
    return "other"


# ─── Парсинг вопросов ────────────────────────────────────────

def parse_questions_block(text: str, test_num: int, passage_num: int,
                           section: str, book_label: str) -> list[dict]:
    questions = []

    # Определяем тип вопросов
    is_tfng = bool(RE_TFNG.search(text[:500]))

    # Ищем блоки "Questions X-Y" для диапазонов
    q_range_match = re.search(r'Questions\s+(\d+)[\s–-]+(\d+)', text)
    q_range = (int(q_range_match.group(1)), int(q_range_match.group(2))) if q_range_match else None

    # Разбиваем на отдельные вопросы
    # Паттерн: число в начале строки
    parts = re.split(r'\n(?=\s*\d{1,2}\s+[A-Z])', text)

    for part in parts:
        m = re.match(r'\s*(\d{1,2})\s+(.*)', part.strip(), re.DOTALL)
        if not m:
            continue

        qnum = int(m.group(1))
        qtext = clean(m.group(2).strip())

        if len(qtext) < 3:
            continue

        # Определяем тип
        if is_tfng:
            if "YES" in text.upper()[:300] and "NO " in text.upper()[:300]:
                qtype = "yes_no_not_given"
            else:
                qtype = "true_false_not_given"
        elif re.search(r'\b[A-D]\s+\w', qtext[:100]):
            qtype = "multiple_choice"
        elif "___" in qtext or "........." in qtext or re.search(r'_{3,}', qtext):
            qtype = "completion"
        elif re.search(r'^[ivxIVX]+\b', qtext):
            qtype = "matching_headings"
        else:
            qtype = "short_answer"

        # Варианты ответов для multiple choice
        choices = {}
        if qtype == "multiple_choice":
            for cm in RE_CHOICES.finditer(qtext):
                choices[cm.group(1)] = cm.group(2).strip()

        questions.append({
            "question_number": qnum,
            "question_text": qtext[:1000],
            "question_type": qtype,
            "choices": json.dumps(choices) if choices else None,
            "test_number": test_num,
            "passage_number": passage_num,
            "section": section,
            "book": book_label,
        })

    return questions


# ─── Парсинг ключа ответов ───────────────────────────────────

def parse_answer_key(text: str, book_label: str) -> list[dict]:
    answers = []

    # Ищем блоки "Test X"
    test_blocks = re.split(r'(?i)\bTest\s+(\d)\b', text)
    current_test = 1

    for i, block in enumerate(test_blocks):
        if re.match(r'^\d$', block.strip()):
            current_test = int(block.strip())
            continue

        # Ищем строки вида "1 B", "2 TRUE", "3 NOT GIVEN" и т.д.
        for m in RE_ANSWERS_LINE.finditer(block):
            answers.append({
                "book": book_label,
                "test_number": current_test,
                "question_number": int(m.group(1)),
                "answer": m.group(2).strip().upper(),
            })

    return answers


# ─── Основной парсер одной книги ─────────────────────────────

def parse_book(pdf_path: Path) -> dict:
    """
    Возвращает {
      'book_label': str,
      'book_number': int,
      'reading_passages': [...],
      'reading_questions': [...],
      'listening_scripts': [...],
      'listening_questions': [...],
      'answers': [...],
    }
    """
    book_stem = pdf_path.stem  # e.g. "Cambridge IELTS 17" / "IELTS-Cambridge-13" / "cambridge_ielts_20_..."

    # Извлекаем номер книги из любого формата имени
    num_match = re.search(r'(?<!\d)(\d{1,2})(?!\d)', book_stem)
    book_number = int(num_match.group(1)) if num_match else 0
    book_label = f"Cambridge IELTS {book_number}"

    # Нормализуем stem для кэша (убираем пробелы и спецсимволы)
    book_stem = re.sub(r'[^A-Za-z0-9]', '_', book_stem).strip('_')

    print(f"\n{'='*55}")
    print(f"  Книга: {book_label}")
    print(f"{'='*55}")

    result = {
        "book_label": book_label,
        "book_number": book_number,
        "reading_passages": [],
        "reading_questions": [],
        "listening_scripts": [],
        "listening_questions": [],
        "answers": [],
    }

    doc = fitz.open(str(pdf_path))
    total = len(doc)
    print(f"  Страниц: {total}")

    # Собираем весь текст постранично
    pages_text = []
    for i in range(total):
        if (i + 1) % 20 == 0:
            print(f"    OCR: {i+1}/{total}...", end="\r", flush=True)
        pages_text.append(ocr_page(doc, i, book_stem.replace(" ", "_")))
    doc.close()
    print(f"    OCR: {total}/{total} завершён   ")

    # Склеиваем весь текст с метками страниц
    full_text = ""
    for i, t in enumerate(pages_text):
        full_text += f"\n<<<PAGE_{i+1}>>>\n{t}\n"

    # ── Определяем номера тестов и разрезаем ──
    # Ищем "Test 1", "Test 2" etc.
    test_splits = []
    for m in RE_TEST_HEADER.finditer(full_text):
        test_splits.append((m.start(), int(m.group(1))))

    if not test_splits:
        # Если нет явных маркеров тестов, считаем всё одним тестом
        test_splits = [(0, 1)]

    # Добавляем конец
    test_splits.append((len(full_text), 0))

    # ── Ищем секцию ответов ──
    answer_key_match = RE_ANSWER_KEY.search(full_text)
    answer_key_text = full_text[answer_key_match.start():] if answer_key_match else ""
    if answer_key_text:
        result["answers"] = parse_answer_key(answer_key_text, book_label)
        print(f"  Ответы: {len(result['answers'])} найдено")

    # ── Обрабатываем каждый тест ──
    for idx in range(len(test_splits) - 1):
        test_start, test_num = test_splits[idx]
        test_end = test_splits[idx + 1][0]

        if test_num == 0:
            continue

        test_text = full_text[test_start:test_end]

        # ── Reading passages ──
        reading_matches = list(RE_READING_PASS.finditer(test_text))
        for ri, rm in enumerate(reading_matches):
            pass_num = int(rm.group(1))

            # Текст пассажа — от заголовка до следующего passage или конца Reading
            pass_start = rm.start()
            pass_end = reading_matches[ri + 1].start() if ri + 1 < len(reading_matches) else len(test_text)

            passage_raw = test_text[pass_start:pass_end]
            passage_clean = clean(passage_raw)

            # Заголовок — первая значимая строка после "READING PASSAGE N"
            lines = [l.strip() for l in passage_clean.split('\n') if l.strip()]
            title = ""
            body_start = 0
            for li, line in enumerate(lines):
                if RE_READING_PASS.match(line):
                    continue
                if len(line) > 10 and not re.match(r'^Questions?\s+\d', line, re.I):
                    title = line
                    body_start = li + 1
                    break

            passage_body = '\n'.join(lines[body_start:])

            # Убираем блоки вопросов из тела пассажа
            # (вопросы начинаются с "Questions X-Y")
            q_start = re.search(r'Questions?\s+\d+', passage_body)
            if q_start:
                questions_text = passage_body[q_start.start():]
                passage_body = passage_body[:q_start.start()].strip()

                # Парсим вопросы
                qs = parse_questions_block(
                    questions_text, test_num, pass_num,
                    f"Reading Passage {pass_num}", book_label
                )
                result["reading_questions"].extend(qs)

            if passage_body and len(passage_body.split()) > 30:
                result["reading_passages"].append({
                    "book": book_label,
                    "book_number": book_number,
                    "test_number": test_num,
                    "passage_number": pass_num,
                    "title": title[:200],
                    "passage_text": passage_body[:15000],
                })

        # ── Listening audioscripts ──
        audio_match = RE_AUDIOSCRIPT.search(test_text)
        if audio_match:
            audio_text = test_text[audio_match.start():]

            # Делим на секции (Part 1–4 или Section 1–4)
            section_splits_ls = []
            for sm in re.finditer(r'\b(?:PART|SECTION)\s+(\d)\b', audio_text, re.IGNORECASE):
                section_splits_ls.append((sm.start(), int(sm.group(1))))

            if not section_splits_ls:
                # Весь текст как одна секция
                section_splits_ls = [(0, 1)]

            section_splits_ls.append((len(audio_text), 0))

            for si in range(len(section_splits_ls) - 1):
                sec_start, sec_num = section_splits_ls[si]
                sec_end = section_splits_ls[si + 1][0]

                if sec_num == 0:
                    continue

                sec_text = clean(audio_text[sec_start:sec_end])

                # Заголовок секции
                lines_s = [l.strip() for l in sec_text.split('\n') if l.strip()]
                title_s = lines_s[1] if len(lines_s) > 1 else f"Section {sec_num}"

                result["listening_scripts"].append({
                    "book": book_label,
                    "book_number": book_number,
                    "test_number": test_num,
                    "section_number": sec_num,
                    "title": title_s[:200],
                    "script_text": sec_text[:12000],
                })

        # ── Listening questions ──
        # Ищем блоки вопросов до audioscripts
        listening_qs_text = test_text[:audio_match.start()] if audio_match else ""
        if listening_qs_text:
            for sm in re.finditer(r'\b(?:SECTION|PART)\s+(\d)\b', listening_qs_text, re.IGNORECASE):
                sec_num = int(sm.group(1))
                # Находим следующий Section или конец
                next_sm = re.search(r'\b(?:SECTION|PART)\s+\d\b',
                                     listening_qs_text[sm.end():], re.IGNORECASE)
                end_pos = sm.end() + next_sm.start() if next_sm else len(listening_qs_text)

                qs_block = listening_qs_text[sm.start():sm.start() + end_pos - sm.start()]
                qs = parse_questions_block(
                    qs_block, test_num, sec_num,
                    f"Listening Section {sec_num}", book_label
                )
                result["listening_questions"].extend(qs)

    r_count = len(result["reading_passages"])
    q_count = len(result["reading_questions"]) + len(result["listening_questions"])
    l_count = len(result["listening_scripts"])
    a_count = len(result["answers"])
    print(f"  → Reading: {r_count} пассажа, {len(result['reading_questions'])} вопросов")
    print(f"  → Listening: {l_count} скриптов, {len(result['listening_questions'])} вопросов")
    print(f"  → Ответы: {a_count}")

    return result


# ─── База данных ─────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS cambridge_books (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    book_label   TEXT NOT NULL UNIQUE,
    book_number  INTEGER NOT NULL,
    pdf_filename TEXT
);

CREATE TABLE IF NOT EXISTS cambridge_reading_passages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id       INTEGER REFERENCES cambridge_books(id),
    book_label    TEXT NOT NULL,
    book_number   INTEGER NOT NULL,
    test_number   INTEGER NOT NULL,
    passage_number INTEGER NOT NULL,
    title         TEXT,
    passage_text  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cambridge_reading_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id         INTEGER REFERENCES cambridge_books(id),
    book_label      TEXT NOT NULL,
    book_number     INTEGER NOT NULL,
    test_number     INTEGER NOT NULL,
    passage_number  INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    question_text   TEXT NOT NULL,
    question_type   TEXT,
    choices         TEXT,
    correct_answer  TEXT
);

CREATE TABLE IF NOT EXISTS cambridge_listening_scripts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id        INTEGER REFERENCES cambridge_books(id),
    book_label     TEXT NOT NULL,
    book_number    INTEGER NOT NULL,
    test_number    INTEGER NOT NULL,
    section_number INTEGER NOT NULL,
    title          TEXT,
    script_text    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cambridge_listening_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id         INTEGER REFERENCES cambridge_books(id),
    book_label      TEXT NOT NULL,
    book_number     INTEGER NOT NULL,
    test_number     INTEGER NOT NULL,
    section_number  INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    question_text   TEXT NOT NULL,
    question_type   TEXT,
    choices         TEXT,
    correct_answer  TEXT
);

CREATE TABLE IF NOT EXISTS cambridge_answers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id         INTEGER REFERENCES cambridge_books(id),
    book_label      TEXT NOT NULL,
    book_number     INTEGER NOT NULL,
    test_number     INTEGER NOT NULL,
    question_number INTEGER NOT NULL,
    answer          TEXT NOT NULL
);
"""

def init_db(con: sqlite3.Connection):
    con.executescript(SCHEMA)
    con.commit()


def save_book(con: sqlite3.Connection, data: dict):
    cur = con.cursor()

    # Книга
    cur.execute(
        "INSERT OR IGNORE INTO cambridge_books (book_label, book_number, pdf_filename) VALUES (?,?,?)",
        (data["book_label"], data["book_number"], f"{data['book_label']}.pdf")
    )
    cur.execute("SELECT id FROM cambridge_books WHERE book_label=?", (data["book_label"],))
    book_id = cur.fetchone()[0]

    # Reading passages
    for p in data["reading_passages"]:
        cur.execute(
            """INSERT INTO cambridge_reading_passages
               (book_id, book_label, book_number, test_number, passage_number, title, passage_text)
               VALUES (?,?,?,?,?,?,?)""",
            (book_id, p["book"], p["book_number"], p["test_number"],
             p["passage_number"], p["title"], p["passage_text"])
        )

    # Reading questions
    for q in data["reading_questions"]:
        cur.execute(
            """INSERT INTO cambridge_reading_questions
               (book_id, book_label, book_number, test_number, passage_number,
                question_number, question_text, question_type, choices)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (book_id, q["book"], book_number_from_label(q["book"]),
             q["test_number"], q["passage_number"],
             q["question_number"], q["question_text"],
             q["question_type"], q["choices"])
        )

    # Listening scripts
    for s in data["listening_scripts"]:
        cur.execute(
            """INSERT INTO cambridge_listening_scripts
               (book_id, book_label, book_number, test_number, section_number, title, script_text)
               VALUES (?,?,?,?,?,?,?)""",
            (book_id, s["book"], s["book_number"], s["test_number"],
             s["section_number"], s["title"], s["script_text"])
        )

    # Listening questions
    for q in data["listening_questions"]:
        cur.execute(
            """INSERT INTO cambridge_listening_questions
               (book_id, book_label, book_number, test_number, section_number,
                question_number, question_text, question_type, choices)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (book_id, q["book"], book_number_from_label(q["book"]),
             q["test_number"], q["section"],
             q["question_number"], q["question_text"],
             q["question_type"], q["choices"])
        )

    # Answers — заполняем correct_answer обратно в questions
    answer_map = {}
    for a in data["answers"]:
        cur.execute(
            """INSERT INTO cambridge_answers
               (book_id, book_label, book_number, test_number, question_number, answer)
               VALUES (?,?,?,?,?,?)""",
            (book_id, a["book"], data["book_number"],
             a["test_number"], a["question_number"], a["answer"])
        )
        answer_map[(a["test_number"], a["question_number"])] = a["answer"]

    # Обновляем correct_answer в вопросах
    for tbl in ("cambridge_reading_questions", "cambridge_listening_questions"):
        cur.execute(f"SELECT id, test_number, question_number FROM {tbl} WHERE book_id=?", (book_id,))
        for row_id, t, qn in cur.fetchall():
            ans = answer_map.get((t, qn))
            if ans:
                cur.execute(f"UPDATE {tbl} SET correct_answer=? WHERE id=?", (ans, row_id))

    con.commit()


def book_number_from_label(label: str) -> int:
    m = re.search(r'(\d+)', label)
    return int(m.group(1)) if m else 0


# ─── Запуск ──────────────────────────────────────────────────

def main():
    pdfs = sorted(CAMBRIDGE_DIR.glob("*.pdf"))
    if not pdfs:
        print("Нет PDF файлов в", CAMBRIDGE_DIR)
        sys.exit(1)

    print(f"Найдено книг: {len(pdfs)}")

    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA foreign_keys = ON")
    init_db(con)

    # Проверяем какие книги уже обработаны
    processed = set()
    cur = con.cursor()
    cur.execute("SELECT book_label FROM cambridge_books")
    for row in cur.fetchall():
        processed.add(row[0])

    total_reading = 0
    total_listening = 0
    total_answers = 0

    for pdf_path in pdfs:
        num_m = re.search(r'(\d+)', pdf_path.stem)
        book_num = int(num_m.group(1)) if num_m else 0
        book_label = f"Cambridge IELTS {book_num}"

        if book_label in processed:
            print(f"\n  {book_label}: уже в базе, пропускаю")
            continue

        try:
            data = parse_book(pdf_path)
            save_book(con, data)
            total_reading  += len(data["reading_passages"])
            total_listening += len(data["listening_scripts"])
            total_answers  += len(data["answers"])
        except Exception as e:
            print(f"\n  ОШИБКА при обработке {pdf_path.name}: {e}")
            import traceback; traceback.print_exc()

    # Итог
    cur.execute("SELECT COUNT(*) FROM cambridge_books")
    nb = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cambridge_reading_passages")
    nrp = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cambridge_reading_questions")
    nrq = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cambridge_listening_scripts")
    nls = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cambridge_listening_questions")
    nlq = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM cambridge_answers")
    na = cur.fetchone()[0]

    con.close()

    print(f"\n{'='*55}")
    print(f"  ИТОГ — IELTS/ielts.db")
    print(f"{'='*55}")
    print(f"  Книг Cambridge:             {nb}")
    print(f"  Reading passages:           {nrp}")
    print(f"  Reading questions:          {nrq}")
    print(f"  Listening audioscripts:     {nls}")
    print(f"  Listening questions:        {nlq}")
    print(f"  Ответы (answer key):        {na}")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
