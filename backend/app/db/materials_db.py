import sqlite3
import json
from pathlib import Path
from typing import Any
from loguru import logger


class MaterialsDB:
    def __init__(self, db_path: Path):
        self._path = db_path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(f"file:{self._path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def _row_to_dict(self, row: sqlite3.Row) -> dict:
        d = dict(row)
        for key, value in d.items():
            if isinstance(value, str):
                stripped = value.strip()
                if stripped.startswith("{") or stripped.startswith("["):
                    try:
                        d[key] = json.loads(stripped)
                    except json.JSONDecodeError:
                        pass
        return d

    def query(self, sql: str, params: tuple = ()) -> list[dict]:
        try:
            with self._connect() as conn:
                cur = conn.execute(sql, params)
                return [self._row_to_dict(row) for row in cur.fetchall()]
        except Exception as ex:
            logger.error(f"MaterialsDB query error ({self._path.name}): {ex}")
            return []

    def query_one(self, sql: str, params: tuple = ()) -> dict | None:
        try:
            with self._connect() as conn:
                cur = conn.execute(sql, params)
                row = cur.fetchone()
                return self._row_to_dict(row) if row else None
        except Exception as ex:
            logger.error(f"MaterialsDB query_one error ({self._path.name}): {ex}")
            return None

    def count(self, sql: str, params: tuple = ()) -> int:
        try:
            with self._connect() as conn:
                cur = conn.execute(sql, params)
                row = cur.fetchone()
                return row[0] if row else 0
        except Exception as ex:
            logger.error(f"MaterialsDB count error ({self._path.name}): {ex}")
            return 0


class SATMaterialsDB(MaterialsDB):
    def get_questions(
        self,
        section: str | None = None,
        domain: str | None = None,
        difficulty: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if section:
            conditions.append("section = ?")
            params.append(section)
        if domain:
            conditions.append("domain = ?")
            params.append(domain)
        if difficulty:
            conditions.append("difficulty = ?")
            params.append(difficulty)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT * FROM questions {where} LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self.query(sql, tuple(params))

    def get_question_by_id(self, question_id: str) -> dict | None:
        return self.query_one("SELECT * FROM questions WHERE id = ?", (question_id,))

    def get_random_questions(
        self,
        section: str | None = None,
        difficulty: str | None = None,
        count: int = 10,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if section:
            conditions.append("section = ?")
            params.append(section)
        if difficulty:
            conditions.append("difficulty = ?")
            params.append(difficulty)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT * FROM questions {where} ORDER BY RANDOM() LIMIT ?"
        params.append(count)
        return self.query(sql, tuple(params))

    def get_total_count(
        self,
        section: str | None = None,
        difficulty: str | None = None,
    ) -> int:
        conditions = []
        params: list[Any] = []
        if section:
            conditions.append("section = ?")
            params.append(section)
        if difficulty:
            conditions.append("difficulty = ?")
            params.append(difficulty)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self.count(f"SELECT COUNT(*) FROM questions {where}", tuple(params))

    def get_domains(self) -> list[dict]:
        return self.query(
            "SELECT section, domain, COUNT(*) as count FROM questions WHERE domain IS NOT NULL GROUP BY section, domain ORDER BY section, domain"
        )


class IELTSMaterialsDB(MaterialsDB):
    def get_books(self) -> list[dict]:
        return self.query("SELECT * FROM cambridge_books ORDER BY book_number")

    def get_reading_passages(
        self,
        book_label: str | None = None,
        book_number: int | None = None,
        test_number: int | None = None,
        passage_number: int | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if book_label:
            conditions.append("book_label = ?")
            params.append(book_label)
        if book_number is not None:
            conditions.append("book_number = ?")
            params.append(book_number)
        if test_number is not None:
            conditions.append("test_number = ?")
            params.append(test_number)
        if passage_number is not None:
            conditions.append("passage_number = ?")
            params.append(passage_number)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT id, book_label, book_number, test_number, passage_number, title FROM cambridge_reading_passages {where} ORDER BY book_number, test_number, passage_number LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self.query(sql, tuple(params))

    def get_reading_passage_full(self, passage_id: int) -> dict | None:
        return self.query_one(
            "SELECT * FROM cambridge_reading_passages WHERE id = ?", (passage_id,)
        )

    def get_reading_questions(
        self,
        book_label: str | None = None,
        test_number: int | None = None,
        passage_number: int | None = None,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if book_label:
            conditions.append("book_label = ?")
            params.append(book_label)
        if test_number is not None:
            conditions.append("test_number = ?")
            params.append(test_number)
        if passage_number is not None:
            conditions.append("passage_number = ?")
            params.append(passage_number)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT * FROM cambridge_reading_questions {where} ORDER BY question_number"
        return self.query(sql, tuple(params))

    def get_listening_scripts(
        self,
        book_label: str | None = None,
        test_number: int | None = None,
        section_number: int | None = None,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if book_label:
            conditions.append("book_label = ?")
            params.append(book_label)
        if test_number is not None:
            conditions.append("test_number = ?")
            params.append(test_number)
        if section_number is not None:
            conditions.append("section_number = ?")
            params.append(section_number)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT * FROM cambridge_listening_scripts {where} ORDER BY section_number"
        return self.query(sql, tuple(params))

    def get_listening_questions(
        self,
        book_label: str | None = None,
        test_number: int | None = None,
        section_number: int | None = None,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if book_label:
            conditions.append("book_label = ?")
            params.append(book_label)
        if test_number is not None:
            conditions.append("test_number = ?")
            params.append(test_number)
        if section_number is not None:
            conditions.append("section_number = ?")
            params.append(section_number)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        sql = f"SELECT * FROM cambridge_listening_questions {where} ORDER BY question_number"
        return self.query(sql, tuple(params))

    def get_writing_tasks(
        self,
        task_type: int | None = None,
        min_band: float | None = None,
        limit: int = 20,
        offset: int = 0,
        random_order: bool = False,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if task_type is not None:
            conditions.append("task_type = ?")
            params.append(task_type)
        if min_band is not None:
            conditions.append("band_score >= ?")
            params.append(min_band)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        order = "ORDER BY RANDOM()" if random_order else "ORDER BY id"
        sql = f"SELECT id, task_type, prompt, band_score FROM writing_tasks {where} {order} LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self.query(sql, tuple(params))

    def get_writing_tasks_count(
        self,
        task_type: int | None = None,
        min_band: float | None = None,
    ) -> int:
        conditions = []
        params: list[Any] = []
        if task_type is not None:
            conditions.append("task_type = ?")
            params.append(task_type)
        if min_band is not None:
            conditions.append("band_score >= ?")
            params.append(min_band)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self.count(f"SELECT COUNT(*) FROM writing_tasks {where}", tuple(params))

    def get_writing_task_full(self, task_id: int) -> dict | None:
        return self.query_one("SELECT * FROM writing_tasks WHERE id = ?", (task_id,))

    def get_speaking_questions(
        self,
        part: int | None = None,
        topic: str | None = None,
        limit: int = 20,
        offset: int = 0,
        random_order: bool = False,
    ) -> list[dict]:
        conditions = []
        params: list[Any] = []
        if part is not None:
            conditions.append("part = ?")
            params.append(part)
        if topic:
            conditions.append("topic LIKE ?")
            params.append(f"%{topic}%")

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        order = "ORDER BY RANDOM()" if random_order else "ORDER BY part, id"
        sql = f"SELECT * FROM speaking_questions {where} {order} LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return self.query(sql, tuple(params))

    def get_speaking_questions_count(
        self,
        part: int | None = None,
        topic: str | None = None,
    ) -> int:
        conditions = []
        params: list[Any] = []
        if part is not None:
            conditions.append("part = ?")
            params.append(part)
        if topic:
            conditions.append("topic LIKE ?")
            params.append(f"%{topic}%")
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self.count(f"SELECT COUNT(*) FROM speaking_questions {where}", tuple(params))

    def get_reading_passages_count(
        self,
        book_label: str | None = None,
        book_number: int | None = None,
        test_number: int | None = None,
        passage_number: int | None = None,
    ) -> int:
        conditions = []
        params: list[Any] = []
        if book_label:
            conditions.append("book_label = ?")
            params.append(book_label)
        if book_number is not None:
            conditions.append("book_number = ?")
            params.append(book_number)
        if test_number is not None:
            conditions.append("test_number = ?")
            params.append(test_number)
        if passage_number is not None:
            conditions.append("passage_number = ?")
            params.append(passage_number)
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        return self.count(f"SELECT COUNT(*) FROM cambridge_reading_passages {where}", tuple(params))

    def get_answers(
        self,
        book_label: str,
        test_number: int,
    ) -> list[dict]:
        return self.query(
            "SELECT question_number, answer FROM cambridge_answers WHERE book_label=? AND test_number=? ORDER BY question_number",
            (book_label, test_number),
        )
