#!/usr/bin/env python3
"""
Скачивает аудиоскрипты Cambridge IELTS 14 и 15 с ieltstrainingonline.com
и добавляет в IELTS/ielts.db → cambridge_listening_scripts
"""

import sqlite3
import re
import time
import urllib.request
from pathlib import Path
from html.parser import HTMLParser

BASE = Path(__file__).parent
DB_PATH = BASE / "IELTS" / "ielts.db"

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}

URLS = {
    14: [
        "https://ieltstrainingonline.com/transcript-cambridge-ielts-14-listening-test-01/",
        "https://ieltstrainingonline.com/transcript-cambridge-ielts-14-listening-test-02/",
        "https://ieltstrainingonline.com/practice-cam-14-listening-test-03-with-answer-and-transcript/",
        "https://ieltstrainingonline.com/transcript-cambridge-ielts-14-listening-test-04/",
    ],
    15: [
        "https://ieltstrainingonline.com/audio-script-cambridge-ielts-15-listening-test-01/",
        "https://ieltstrainingonline.com/audio-script-cambridge-ielts-15-listening-test-02/",
        "https://ieltstrainingonline.com/audio-script-cambridge-ielts-15-listening-test-03/",
        "https://ieltstrainingonline.com/audio-script-cambridge-ielts-15-listening-test-04/",
    ],
}

# ─── Парсер HTML → чистый текст ─────────────────────────────

class ArticleExtractor(HTMLParser):
    """Извлекает текст из основного контентного блока страницы."""
    def __init__(self):
        super().__init__()
        self.result = []
        self._in_content = False
        self._depth = 0
        self._skip_tags = {"script", "style", "nav", "footer", "header", "aside"}
        self._current_skip = 0

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        classes = attr_dict.get("class", "")
        # Входим в основной контент
        if tag in ("article", "div") and any(k in classes for k in
                   ("entry-content", "post-content", "article-content", "content-area", "single-content")):
            self._in_content = True
            self._depth = 1
            return
        if self._in_content:
            self._depth += 1
        if tag in self._skip_tags:
            self._current_skip += 1

    def handle_endtag(self, tag):
        if tag in self._skip_tags and self._current_skip > 0:
            self._current_skip -= 1
        if self._in_content:
            self._depth -= 1
            if self._depth <= 0:
                self._in_content = False

    def handle_data(self, data):
        if self._in_content and self._current_skip == 0:
            text = data.strip()
            if text:
                self.result.append(text)

    def get_text(self):
        return "\n".join(self.result)


def fetch_page(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8", errors="replace")


def extract_content(html: str) -> str:
    """
    Извлекает текст аудиоскрипта.
    Поддерживает страницы на Divi builder (et_pb_text_inner) и обычные (entry-content).
    """
    # Убираем скрипты, стили, аудио
    html = re.sub(r'<(script|style|noscript|audio)[^>]*>.*?</\1>', '', html,
                  flags=re.DOTALL | re.IGNORECASE)

    # Приоритет 1: Divi builder блоки (ieltstrainingonline.com)
    divi_blocks = re.findall(r'et_pb_text_inner[^>]*>(.*?)</div>', html, re.DOTALL | re.IGNORECASE)
    if divi_blocks:
        # Берём только блоки с реальным контентом (> 50 слов), пропускаем CSS/навигацию
        good = []
        for b in divi_blocks:
            clean = re.sub(r'<[^>]+>', ' ', b).strip()
            clean = re.sub(r'/\*.*?\*/', '', clean, flags=re.DOTALL)  # убираем CSS
            clean = re.sub(r'https?://\S+', '', clean)
            clean = re.sub(r'\s+', ' ', clean).strip()
            if len(clean.split()) > 50:
                good.append(clean)
        if good:
            return '\n\n'.join(good)

    # Приоритет 2: entry-content (стандартный WordPress)
    m = re.search(r'class="entry-content[^"]*">(.*?)(?=<div\s+id="|<footer|</article)',
                  html, re.DOTALL | re.IGNORECASE)
    chunk = m.group(1) if m else html

    text = re.sub(r'<br\s*/?>', '\n', chunk, flags=re.IGNORECASE)
    text = re.sub(r'</(p|div|h[1-6]|li)>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def extract_sections(text: str) -> dict[int, str]:
    """
    Делит текст транскрипта на секции.
    Поддерживает: SECTION N, PART N (C15 использует PART).
    Возвращает {1: text, 2: text, 3: text, 4: text}
    """
    sections = {}
    # Ищем "SECTION N" или "PART N" (только в начале строки или после пустой)
    pattern = re.compile(r'(?:^|\n)\s*(?:SECTION|PART)\s+(\d)\b', re.IGNORECASE)
    splits = [(m.start(), int(m.group(1))) for m in pattern.finditer(text)]

    # Убираем дубликаты (второй заголовок той же секции подряд)
    deduped = []
    for pos, num in splits:
        if deduped and deduped[-1][1] == num:
            continue
        deduped.append((pos, num))
    splits = deduped

    if not splits:
        return {1: text.strip()}

    splits.append((len(text), 0))
    for i in range(len(splits) - 1):
        start, sec_num = splits[i]
        end = splits[i + 1][0]
        sec_text = text[start:end].strip()
        if sec_text and sec_num > 0 and len(sec_text.split()) > 10:
            sections[sec_num] = sec_text

    return sections


def scrape_and_save():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # Удаляем старые неполные записи C14 и C15
    for book_num in (14, 15):
        label = f"Cambridge IELTS {book_num}"
        cur.execute("SELECT id FROM cambridge_books WHERE book_label=?", (label,))
        row = cur.fetchone()
        if row:
            cur.execute("DELETE FROM cambridge_listening_scripts WHERE book_id=?", (row[0],))
            print(f"  Очищены старые скрипты: {label}")
    con.commit()

    for book_num, urls in URLS.items():
        book_label = f"Cambridge IELTS {book_num}"

        cur.execute("SELECT id FROM cambridge_books WHERE book_label=?", (book_label,))
        row = cur.fetchone()
        if row:
            book_id = row[0]
        else:
            cur.execute(
                "INSERT INTO cambridge_books (book_label, book_number, pdf_filename) VALUES (?,?,?)",
                (book_label, book_num, f"{book_label}.pdf")
            )
            book_id = cur.lastrowid
            con.commit()

        print(f"\n=== {book_label} ===")

        for test_num, url in enumerate(urls, start=1):
            print(f"  Test {test_num}: {url}")
            try:
                html = fetch_page(url)
            except Exception as e:
                print(f"    ✗ Ошибка: {e}")
                continue

            raw_text = extract_content(html)

            # Убираем рекламный мусор
            raw_text = re.sub(
                r'(?i)(advertisements?|share this|follow us|subscribe|related posts?|you may also like|adsbygoogle).*',
                '', raw_text)
            raw_text = raw_text.strip()

            sections = extract_sections(raw_text)

            if not sections:
                print(f"    ✗ Не удалось разбить на секции ({len(raw_text.split())} слов)")
                continue

            for sec_num, sec_text in sections.items():
                word_count = len(sec_text.split())
                # Получаем первую строку как заголовок
                first_line = sec_text.split('\n')[0][:150]

                # Проверяем дубликаты
                cur.execute(
                    """SELECT id FROM cambridge_listening_scripts
                       WHERE book_id=? AND test_number=? AND section_number=?""",
                    (book_id, test_num, sec_num)
                )
                if cur.fetchone():
                    print(f"    ⚠ T{test_num}/S{sec_num}: уже есть, пропускаю")
                    continue

                cur.execute(
                    """INSERT INTO cambridge_listening_scripts
                       (book_id, book_label, book_number, test_number, section_number, title, script_text)
                       VALUES (?,?,?,?,?,?,?)""",
                    (book_id, book_label, book_num, test_num, sec_num,
                     first_line, sec_text[:15000])
                )
                print(f"    ✓ T{test_num}/S{sec_num}: {word_count} слов")

            con.commit()
            time.sleep(1)  # вежливая пауза между запросами

    # Итог
    print("\n=== Итог ===")
    for book_num in (14, 15):
        label = f"Cambridge IELTS {book_num}"
        cur.execute(
            "SELECT COUNT(*), SUM(LENGTH(script_text)) FROM cambridge_listening_scripts WHERE book_label=?",
            (label,)
        )
        cnt, chars = cur.fetchone()
        print(f"  {label}: {cnt} секций, ~{(chars or 0)//1000}k символов")

    con.close()


if __name__ == "__main__":
    scrape_and_save()
