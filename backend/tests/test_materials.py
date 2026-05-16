"""
Tests for SAT and IELTS material endpoints.
These test against the real SQLite .db files — no mocking needed.
"""
import pytest
from pathlib import Path

SAT_DB = Path(__file__).parents[2] / "materials" / "sat.db"
IELTS_DB = Path(__file__).parents[2] / "materials" / "ielts.db"


# ── SAT ───────────────────────────────────────────────────────────────────────

@pytest.mark.skipif(not SAT_DB.exists(), reason="sat.db not present")
class TestSATEndpoints:
    def test_get_questions_returns_list(self, client):
        r = client.get("/api/sat/questions?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert "questions" in data
        assert len(data["questions"]) == 5
        assert "pagination" in data
        assert data["pagination"]["total"] > 0

    def test_get_questions_math_section(self, client):
        r = client.get("/api/sat/questions?section=math&limit=3")
        assert r.status_code == 200
        data = r.json()
        assert all(q["section"] == "math" for q in data["questions"])

    def test_get_questions_invalid_section_returns_400(self, client):
        r = client.get("/api/sat/questions?section=biology")
        assert r.status_code == 400

    def test_get_questions_invalid_difficulty_returns_400(self, client):
        r = client.get("/api/sat/questions?difficulty=Extreme")
        assert r.status_code == 400

    def test_get_questions_empty_result_returns_list(self, client):
        # A valid but unlikely combination
        r = client.get("/api/sat/questions?section=practice_test&difficulty=Hard&limit=100")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["questions"], list)  # empty or populated, never crash

    def test_get_random_questions(self, client):
        r = client.get("/api/sat/questions/random?section=math&count=5")
        assert r.status_code == 200
        data = r.json()
        assert len(data["questions"]) == 5

    def test_get_question_by_id_404_on_bad_id(self, client):
        r = client.get("/api/sat/questions/this-id-does-not-exist-xyz")
        assert r.status_code == 404

    def test_get_domains(self, client):
        r = client.get("/api/sat/domains")
        assert r.status_code == 200
        data = r.json()
        assert len(data["domains"]) > 0
        assert "domain" in data["domains"][0]

    def test_get_stats(self, client):
        r = client.get("/api/sat/stats")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 2588
        assert data["bySection"]["math"] > 0
        assert data["bySection"]["english"] > 0

    def test_pagination_offset(self, client):
        r1 = client.get("/api/sat/questions?limit=5&offset=0")
        r2 = client.get("/api/sat/questions?limit=5&offset=5")
        ids1 = [q["id"] for q in r1.json()["questions"]]
        ids2 = [q["id"] for q in r2.json()["questions"]]
        assert set(ids1).isdisjoint(set(ids2)), "pages must not overlap"


# ── IELTS ─────────────────────────────────────────────────────────────────────

@pytest.mark.skipif(not IELTS_DB.exists(), reason="ielts.db not present")
class TestIELTSMaterialEndpoints:
    def test_get_books(self, client):
        r = client.get("/api/ielts/materials/books")
        assert r.status_code == 200
        data = r.json()
        assert "books" in data
        assert len(data["books"]) > 0

    def test_get_reading_passages_returns_list(self, client):
        r = client.get("/api/ielts/materials/reading/passages?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["passages"], list)
        assert len(data["passages"]) == 5

    def test_get_reading_passage_404_on_bad_id(self, client):
        r = client.get("/api/ielts/materials/reading/passages/999999")
        assert r.status_code == 404

    def test_get_speaking_questions(self, client):
        r = client.get("/api/ielts/materials/speaking/questions?part=1&limit=5")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["questions"], list)
        assert all(q["part"] == 1 for q in data["questions"])

    def test_invalid_speaking_part_returns_400(self, client):
        r = client.get("/api/ielts/materials/speaking/questions?part=5")
        assert r.status_code == 400

    def test_get_writing_tasks(self, client):
        r = client.get("/api/ielts/materials/writing/tasks?limit=3")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["tasks"], list)

    def test_get_writing_task_404_on_bad_id(self, client):
        r = client.get("/api/ielts/materials/writing/tasks/999999")
        assert r.status_code == 404

    def test_db_missing_returns_empty_not_crash(self, client):
        """If .db path doesn't exist, queries should return [] not 500."""
        from db.materials_db import IELTSMaterialsDB
        bad_db = IELTSMaterialsDB(Path("/nonexistent/path.db"))
        result = bad_db.get_books()
        assert result == []  # graceful empty, no exception


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_ok(self, client):
        from unittest.mock import AsyncMock, patch
        with patch("db.db_functions.Users_DB.initialize", new_callable=AsyncMock, return_value=0):
            r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert "uptime" in data
        assert "sqlite" in data
        assert "db" in data
