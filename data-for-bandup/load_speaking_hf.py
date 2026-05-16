#!/usr/bin/env python3
"""
Загружает IELTS Speaking датасет с HuggingFace и добавляет в ielts.db.
Датасет: qwertyuiopasdfg/IELTs-Speaking-answer
Содержит: Part 1/2/3 вопросы + примеры ответов
"""

import sqlite3
import json
import urllib.request
import urllib.error
from pathlib import Path

BASE = Path(__file__).parent
DB_PATH = BASE / "IELTS" / "ielts.db"

HF_BASE = "https://huggingface.co/datasets/qwertyuiopasdfg/IELTs-Speaking-answer/resolve/main"

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def load_speaking():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    # Расширяем таблицу speaking_questions — добавляем поле answer если нет
    cur.execute("PRAGMA table_info(speaking_questions)")
    cols = {row[1] for row in cur.fetchall()}
    if "answer" not in cols:
        cur.execute("ALTER TABLE speaking_questions ADD COLUMN answer TEXT")
        con.commit()
        print("  Добавлена колонка answer в speaking_questions")

    inserted = 0

    for fname in ("ielts_new.json", "ielts_old.json"):
        url = f"{HF_BASE}/{fname}"
        print(f"  → Загружаю {fname} ...")
        try:
            raw = fetch(url)
        except Exception as e:
            print(f"    ✗ Ошибка: {e}")
            continue

        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            print(f"    ✗ Не JSON, пробую построчно...")
            # Попробуем как JSONL
            lines = raw.decode("utf-8", errors="replace").strip().split("\n")
            data = []
            for line in lines:
                line = line.strip()
                if line:
                    try:
                        data.append(json.loads(line))
                    except Exception:
                        pass

        if not data:
            print(f"    ✗ Пусто")
            continue

        # Определяем структуру
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            # Может быть {"part1": [...], "part2": [...]}
            items = []
            for k, v in data.items():
                if isinstance(v, list):
                    for item in v:
                        if isinstance(item, dict):
                            item["_source_key"] = k
                        items.append(item)
                else:
                    items.append({"_source_key": k, "data": v})
        else:
            items = []

        print(f"    Записей: {len(items)}")

        for item in items:
            if not isinstance(item, dict):
                continue

            # Извлекаем поля (датасет может иметь разную структуру)
            question = (
                item.get("instruction") or
                item.get("question") or
                item.get("Question") or
                item.get("q") or
                item.get("prompt") or ""
            ).strip()

            answer = (
                item.get("response") or
                item.get("answer") or
                item.get("Answer") or
                item.get("a") or
                item.get("sample_answer") or ""
            ).strip()

            topic = (
                item.get("topic") or
                item.get("Topic") or
                item.get("category") or
                item.get("_source_key") or ""
            ).strip()

            # Определяем часть (Part 1/2/3)
            part_raw = (
                item.get("part") or
                item.get("Part") or
                item.get("section") or ""
            )
            try:
                part = int(str(part_raw).strip())
            except (ValueError, TypeError):
                # Пробуем вывести из ключа
                if "part1" in str(part_raw).lower() or "part_1" in str(part_raw).lower():
                    part = 1
                elif "part2" in str(part_raw).lower() or "cue" in str(part_raw).lower():
                    part = 2
                elif "part3" in str(part_raw).lower():
                    part = 3
                else:
                    part = 1  # по умолчанию

            # Cue card для Part 2
            cue_card = item.get("cue_card") or item.get("cue card") or item.get("card") or None
            if cue_card:
                cue_card = str(cue_card).strip()

            if not question:
                continue

            cur.execute(
                """INSERT INTO speaking_questions (part, topic, question, cue_card, answer)
                   VALUES (?,?,?,?,?)""",
                (part, topic[:100] if topic else None, question[:500],
                 cue_card, answer[:3000] if answer else None)
            )
            inserted += 1

        print(f"    ✓ {fname}: добавлено {inserted} записей")
        inserted = 0

    con.commit()
    con.execute("SELECT part, COUNT(*) FROM speaking_questions GROUP BY part")
    # Правильно — через cur
    cur.execute("SELECT part, COUNT(*) FROM speaking_questions GROUP BY part ORDER BY part")
    rows = cur.fetchall()
    con.close()

    print("\n  Итог Speaking questions:")
    for part, cnt in rows:
        print(f"    Part {part}: {cnt} вопросов")

if __name__ == "__main__":
    load_speaking()
