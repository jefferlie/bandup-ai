#!/usr/bin/env python3
"""
Скачивает данные из открытых источников и создаёт SQLite базы данных:
  SAT/sat.db    — вопросы SAT (math + reading/writing)
  IELTS/ielts.db — Writing tasks, Speaking questions, Reading/Listening samples
"""

import json
import sqlite3
import csv
import io
import urllib.request
import urllib.error
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
SAT_DIR = os.path.join(BASE, "SAT")
IELTS_DIR = os.path.join(BASE, "IELTS")
os.makedirs(SAT_DIR, exist_ok=True)
os.makedirs(IELTS_DIR, exist_ok=True)

def fetch(url, label=""):
    print(f"  → Загружаю {label or url} ...")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

# ─────────────────────────────────────────────
# SAT
# ─────────────────────────────────────────────

def build_sat():
    db_path = os.path.join(SAT_DIR, "sat.db")
    raw = fetch(
        "https://api.jsonsilo.com/public/942c3c3b-3a0c-4be3-81c2-12029def19f5",
        "OpenSAT JSON"
    )
    data = json.loads(raw)

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS questions (
            id             TEXT PRIMARY KEY,
            section        TEXT NOT NULL,
            domain         TEXT,
            difficulty     TEXT,
            question_text  TEXT NOT NULL,
            paragraph      TEXT,
            choices        TEXT,
            correct_answer TEXT,
            explanation    TEXT,
            visual_type    TEXT,
            visual_svg     TEXT
        );
    """)

    inserted = 0
    for section, items in data.items():
        if not isinstance(items, list):
            continue
        for item in items:
            q = item.get("question", {})
            vis = item.get("visuals", {})
            choices = q.get("choices")
            qid = item.get("id", "")
            # дедупликация: добавим суффикс если id повторяется
            base_id = qid
            suffix = 0
            while True:
                cur.execute("SELECT 1 FROM questions WHERE id=?", (qid,))
                if not cur.fetchone():
                    break
                suffix += 1
                qid = f"{base_id}_{suffix}"
            cur.execute(
                """INSERT INTO questions
                   (id, section, domain, difficulty, question_text, paragraph,
                    choices, correct_answer, explanation, visual_type, visual_svg)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    qid,
                    section,
                    item.get("domain"),
                    item.get("difficulty"),
                    q.get("question", ""),
                    q.get("paragraph") if q.get("paragraph") != "null" else None,
                    json.dumps(choices, ensure_ascii=False) if choices else None,
                    q.get("correct_answer"),
                    q.get("explanation"),
                    vis.get("type") if vis.get("type") != "null" else None,
                    vis.get("svg_content") if vis.get("svg_content") != "null" else None,
                )
            )
            inserted += 1

    con.commit()
    cur.execute("SELECT section, COUNT(*) FROM questions GROUP BY section")
    rows = cur.fetchall()
    con.close()
    print(f"  ✓ SAT/sat.db создан. Всего вопросов: {inserted}")
    for section, cnt in rows:
        print(f"      {section}: {cnt}")

# ─────────────────────────────────────────────
# IELTS Writing
# ─────────────────────────────────────────────

def build_ielts_writing(cur):
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS writing_tasks (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type  INTEGER NOT NULL DEFAULT 2,
            prompt     TEXT NOT NULL,
            essay      TEXT,
            evaluation TEXT,
            band_score REAL
        );
    """)

    for split in ("train", "test"):
        url = f"https://huggingface.co/datasets/chillies/IELTS-writing-task-2-evaluation/resolve/main/{split}.csv"
        try:
            raw = fetch(url, f"IELTS Writing {split}.csv")
        except Exception as e:
            print(f"  ⚠ Не удалось загрузить {split}.csv: {e}")
            continue
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        count = 0
        for row in reader:
            band_raw = row.get("band", "").strip()
            try:
                band = float(band_raw)
            except ValueError:
                band = None
            cur.execute(
                """INSERT INTO writing_tasks (task_type, prompt, essay, evaluation, band_score)
                   VALUES (2,?,?,?,?)""",
                (
                    row.get("prompt", "").strip(),
                    row.get("essay", "").strip(),
                    row.get("evaluation", "").strip(),
                    band,
                )
            )
            count += 1
        print(f"  ✓ Writing {split}: {count} строк загружено")

# ─────────────────────────────────────────────
# IELTS Speaking
# ─────────────────────────────────────────────

SPEAKING_DATA = [
    # Part 1 — general questions
    (1, "Work & Study", "Do you work or are you a student?", None),
    (1, "Work & Study", "What do you do for work?", None),
    (1, "Work & Study", "Do you enjoy your job? Why or why not?", None),
    (1, "Work & Study", "What subject do you study?", None),
    (1, "Work & Study", "Why did you choose that subject?", None),
    (1, "Hometown", "Where are you from?", None),
    (1, "Hometown", "What is your hometown like?", None),
    (1, "Hometown", "What do you like most about your hometown?", None),
    (1, "Hometown", "Has your hometown changed much in recent years?", None),
    (1, "Family", "Do you have a large or small family?", None),
    (1, "Family", "How much time do you spend with your family?", None),
    (1, "Family", "What do you like to do together as a family?", None),
    (1, "Hobbies", "What do you like to do in your free time?", None),
    (1, "Hobbies", "Have your hobbies changed since you were a child?", None),
    (1, "Hobbies", "Is it important to have hobbies? Why?", None),
    (1, "Travel", "Do you like travelling?", None),
    (1, "Travel", "Where have you travelled to recently?", None),
    (1, "Travel", "Do you prefer travelling alone or with others?", None),
    (1, "Food", "What kind of food do you like?", None),
    (1, "Food", "Do you prefer eating at home or in a restaurant?", None),
    (1, "Food", "Is there any food you dislike?", None),
    (1, "Music", "Do you like music?", None),
    (1, "Music", "What kind of music do you listen to?", None),
    (1, "Music", "Did you learn a musical instrument when you were young?", None),
    (1, "Reading", "Do you like reading?", None),
    (1, "Reading", "What kind of books do you read?", None),
    (1, "Reading", "Do you prefer physical books or e-books?", None),
    (1, "Technology", "How often do you use the internet?", None),
    (1, "Technology", "What do you mainly use your smartphone for?", None),
    (1, "Technology", "Has technology changed the way people communicate?", None),
    (1, "Weather", "What is the weather like in your country?", None),
    (1, "Weather", "What kind of weather do you prefer?", None),
    (1, "Sports", "Do you do any sports?", None),
    (1, "Sports", "What sports are popular in your country?", None),
    (1, "Sports", "Did you play sports when you were a child?", None),
    (1, "Environment", "Is protecting the environment important to you?", None),
    (1, "Environment", "What do people in your country do to protect the environment?", None),
    (1, "Shopping", "Do you like shopping?", None),
    (1, "Shopping", "Do you prefer shopping online or in a store?", None),
    (1, "Art", "Are you interested in art?", None),
    (1, "Art", "What kind of art do you like?", None),
    (1, "Health", "What do you do to keep healthy?", None),
    (1, "Health", "Is health education important in schools?", None),
    # Part 2 — cue cards
    (2, "People", "Describe a person who has had a big influence on your life.",
     "You should say:\n- who this person is\n- how you know them\n- what they have done for you\n- and explain why they have had such an influence on you."),
    (2, "Places", "Describe a place you have visited that you particularly enjoyed.",
     "You should say:\n- where the place is\n- why you went there\n- what you did there\n- and explain why you enjoyed it so much."),
    (2, "Objects", "Describe an object that is important to you.",
     "You should say:\n- what the object is\n- how long you have had it\n- what you use it for\n- and explain why it is important to you."),
    (2, "Events", "Describe a memorable event from your childhood.",
     "You should say:\n- what the event was\n- when it happened\n- who was there\n- and explain why it was memorable."),
    (2, "Technology", "Describe a piece of technology you use every day.",
     "You should say:\n- what it is\n- when you started using it\n- how you use it\n- and explain why you find it useful."),
    (2, "Books & Media", "Describe a book or film that made a strong impression on you.",
     "You should say:\n- what it was about\n- when you read/watched it\n- who recommended it to you or how you found it\n- and explain why it made such a strong impression."),
    (2, "Travel", "Describe a journey or trip that was particularly memorable.",
     "You should say:\n- where you went\n- who you went with\n- what you did\n- and explain why it was so memorable."),
    (2, "Work & Skills", "Describe a skill you would like to learn in the future.",
     "You should say:\n- what the skill is\n- why you want to learn it\n- how you would go about learning it\n- and explain how this skill would benefit your life."),
    (2, "Society", "Describe a time when you helped someone.",
     "You should say:\n- who you helped\n- why they needed help\n- how you helped them\n- and explain how you felt about helping them."),
    (2, "Education", "Describe a class or lesson that you particularly enjoyed.",
     "You should say:\n- what the class was\n- who taught it\n- what you learned\n- and explain why you enjoyed it."),
    (2, "Environment", "Describe a beautiful natural place you have visited.",
     "You should say:\n- where it is\n- when you went there\n- what it looked like\n- and explain why you found it beautiful."),
    (2, "Food", "Describe a special meal you have had.",
     "You should say:\n- what you ate\n- where and when you had this meal\n- who you were with\n- and explain why it was special."),
    # Part 3 — abstract discussion
    (3, "Work & Careers", "What factors do people consider when choosing a career?", None),
    (3, "Work & Careers", "How has the nature of work changed in recent decades?", None),
    (3, "Work & Careers", "Do you think job satisfaction is more important than salary?", None),
    (3, "Education", "Should education be free for everyone?", None),
    (3, "Education", "How important is university education nowadays?", None),
    (3, "Education", "How can technology improve the quality of education?", None),
    (3, "Technology & Society", "What are the advantages and disadvantages of social media?", None),
    (3, "Technology & Society", "How has technology changed family life?", None),
    (3, "Technology & Society", "Do you think artificial intelligence will change the job market?", None),
    (3, "Environment", "What can governments do to reduce pollution?", None),
    (3, "Environment", "Is it the responsibility of individuals or governments to protect the environment?", None),
    (3, "Environment", "How does climate change affect people in developing countries?", None),
    (3, "Globalisation", "What are the positive effects of globalisation?", None),
    (3, "Globalisation", "Is cultural identity threatened by globalisation?", None),
    (3, "Health", "Why do many people in cities have unhealthy lifestyles?", None),
    (3, "Health", "What can governments do to encourage healthier living?", None),
    (3, "Media", "Do you think the media has too much influence on society?", None),
    (3, "Media", "How has the way people consume news changed in recent years?", None),
    (3, "Crime & Justice", "What are the main causes of crime in society?", None),
    (3, "Crime & Justice", "Should young offenders be treated differently from adults?", None),
    (3, "Travel & Tourism", "What are the benefits of international travel?", None),
    (3, "Travel & Tourism", "How does tourism affect local cultures?", None),
]

def build_ielts_speaking(cur):
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS speaking_questions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            part         INTEGER NOT NULL,
            topic        TEXT,
            question     TEXT NOT NULL,
            cue_card     TEXT
        );
    """)
    cur.executemany(
        "INSERT INTO speaking_questions (part, topic, question, cue_card) VALUES (?,?,?,?)",
        SPEAKING_DATA
    )
    print(f"  ✓ Speaking: {len(SPEAKING_DATA)} вопросов добавлено")

# ─────────────────────────────────────────────
# IELTS Reading — sample passages
# ─────────────────────────────────────────────

READING_DATA = [
    (
        "Academic",
        "The History of the Internet",
        """The Internet as we know it today grew out of research funded by the United States Department of Defense in the 1960s. The project, called ARPANET, was designed to allow computers at different universities to communicate with each other. By the early 1970s, ARPANET had expanded to include dozens of computers across the country.

The development of the World Wide Web in 1989 by British scientist Tim Berners-Lee transformed the Internet from a tool used mainly by academics and government agencies into a global platform for communication, commerce, and entertainment. Berners-Lee's invention allowed information to be presented as interlinked pages, making it far easier for ordinary people to navigate the Internet.

Since the mid-1990s, the Internet has grown at a remarkable pace. The number of websites has grown from a few thousand in 1993 to over 1.7 billion today. Social media platforms, streaming services, and e-commerce have fundamentally changed the way people interact, consume information, and spend money.

Despite its many benefits, the Internet has also brought new challenges. Issues such as privacy, cybercrime, misinformation, and the digital divide remain pressing concerns. Governments and international organisations are still debating how best to regulate the Internet while preserving its open and innovative character.""",
        [
            {"q": "Who funded the early research that led to the Internet?", "a": "The United States Department of Defense", "type": "short_answer"},
            {"q": "What was the original purpose of ARPANET?", "a": "To allow computers at different universities to communicate with each other", "type": "short_answer"},
            {"q": "Tim Berners-Lee invented the Internet.", "a": "FALSE", "type": "true_false_ng"},
            {"q": "The World Wide Web made it easier for ordinary people to use the Internet.", "a": "TRUE", "type": "true_false_ng"},
            {"q": "The Internet has had no negative effects on society.", "a": "FALSE", "type": "true_false_ng"},
        ]
    ),
    (
        "Academic",
        "Coral Reefs and Climate Change",
        """Coral reefs are among the most biologically diverse ecosystems on the planet. They occupy less than 1% of the ocean floor yet support approximately 25% of all marine species. Beyond their ecological importance, coral reefs provide food and livelihoods for hundreds of millions of people worldwide and generate billions of dollars annually through tourism and fisheries.

Climate change poses the most serious threat to coral reefs globally. Rising ocean temperatures cause a phenomenon known as coral bleaching, in which corals expel the algae (zooxanthellae) living in their tissues. Without these algae, corals lose their primary food source and their vibrant colours, turning white. While corals can recover if temperatures return to normal quickly, prolonged bleaching leads to mass coral death.

Ocean acidification, a direct consequence of increased carbon dioxide absorption by seawater, further weakens coral reefs by reducing the availability of carbonate ions that corals need to build their skeletons. Scientists estimate that if current emissions trends continue, most coral reefs could be severely degraded by 2050.

Conservation efforts include establishing marine protected areas, reducing local stressors such as overfishing and pollution, and developing heat-resistant coral strains through selective breeding. However, experts warn that without significant reductions in greenhouse gas emissions, these measures alone will not be sufficient to save coral reefs in the long term.""",
        [
            {"q": "What percentage of marine species do coral reefs support?", "a": "25%", "type": "short_answer"},
            {"q": "What is coral bleaching?", "a": "A phenomenon in which corals expel the algae living in their tissues due to rising ocean temperatures", "type": "short_answer"},
            {"q": "Coral reefs cover more than 10% of the ocean floor.", "a": "FALSE", "type": "true_false_ng"},
            {"q": "Ocean acidification helps corals build stronger skeletons.", "a": "FALSE", "type": "true_false_ng"},
            {"q": "Marine protected areas alone are enough to save coral reefs.", "a": "FALSE", "type": "true_false_ng"},
        ]
    ),
    (
        "General Training",
        "Tips for a Successful Job Interview",
        """Preparing for a job interview can feel daunting, but with the right approach you can walk into the room feeling confident and ready to impress. Here are some practical tips to help you succeed.

Research the company thoroughly before the interview. Read their website, recent news, and mission statement. Understanding the company's values and goals shows that you are genuinely interested in working there and gives you material to draw on when answering questions.

Practise answering common interview questions out loud. Questions such as "Tell me about yourself", "What are your greatest strengths and weaknesses?", and "Why do you want to work here?" are almost always asked. Having prepared, thoughtful answers will help you feel less nervous on the day.

Dress appropriately for the role and company culture. When in doubt, it is better to be slightly overdressed than underdressed. Your appearance is the first impression you make, so make sure it is a positive one.

Arrive on time — or, ideally, a few minutes early. Plan your route in advance and allow extra time for delays. Being late creates a very poor first impression that is hard to recover from.

Finally, remember that an interview is a two-way conversation. Come prepared with questions to ask the interviewer about the role and the company. This demonstrates initiative and genuine interest.""",
        [
            {"q": "Why should you research the company before an interview?", "a": "To show genuine interest and gain material for answering questions", "type": "short_answer"},
            {"q": "What does the author suggest if you are unsure about what to wear?", "a": "Be slightly overdressed rather than underdressed", "type": "short_answer"},
            {"q": "It is acceptable to arrive at an interview a few minutes late.", "a": "FALSE", "type": "true_false_ng"},
            {"q": "Preparing answers to common questions can reduce nervousness.", "a": "TRUE", "type": "true_false_ng"},
            {"q": "An interview is described as a two-way conversation.", "a": "TRUE", "type": "true_false_ng"},
        ]
    ),
]

def build_ielts_reading(cur):
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS reading_passages (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            passage_type TEXT NOT NULL,
            title        TEXT NOT NULL,
            passage_text TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reading_questions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            passage_id   INTEGER NOT NULL REFERENCES reading_passages(id),
            question     TEXT NOT NULL,
            answer       TEXT,
            question_type TEXT
        );
    """)
    for ptype, title, text, questions in READING_DATA:
        cur.execute(
            "INSERT INTO reading_passages (passage_type, title, passage_text) VALUES (?,?,?)",
            (ptype, title, text)
        )
        pid = cur.lastrowid
        for q in questions:
            cur.execute(
                "INSERT INTO reading_questions (passage_id, question, answer, question_type) VALUES (?,?,?,?)",
                (pid, q["q"], q["a"], q["type"])
            )
    print(f"  ✓ Reading: {len(READING_DATA)} текста + вопросы добавлены")

# ─────────────────────────────────────────────
# IELTS Listening — sample tasks
# ─────────────────────────────────────────────

LISTENING_DATA = [
    (
        1,
        "Phone call to a rental agency",
        "A student calls a letting agency to enquire about renting a flat near the university.",
        [
            {"q": "What is the name of the letting agency?", "a": "Sunrise Properties", "type": "form_completion"},
            {"q": "The flat is located on __________ Street.", "a": "Maple", "type": "form_completion"},
            {"q": "How many bedrooms does the flat have?", "a": "2", "type": "form_completion"},
            {"q": "What is the monthly rent?", "a": "£750", "type": "form_completion"},
            {"q": "Bills __________ included in the rent.", "a": "are not", "type": "form_completion"},
        ]
    ),
    (
        2,
        "Community centre announcement",
        "A manager gives a talk about the facilities and upcoming events at the Greenfield Community Centre.",
        [
            {"q": "The community centre is open seven days a week.", "a": "TRUE", "type": "true_false"},
            {"q": "The swimming pool is closed on Sunday mornings.", "a": "TRUE", "type": "true_false"},
            {"q": "The cooking class is free for members.", "a": "FALSE", "type": "true_false"},
            {"q": "The charity fundraiser will take place on Saturday 14th.", "a": "TRUE", "type": "true_false"},
        ]
    ),
    (
        3,
        "University tutorial discussion",
        "Two students, Emma and James, discuss their group project on renewable energy with their tutor.",
        [
            {"q": "What is the main topic of Emma and James's project?", "a": "Renewable energy / solar power adoption", "type": "short_answer"},
            {"q": "Why does the tutor suggest they narrow the focus of their research?", "a": "The topic is too broad to cover well in the time available", "type": "short_answer"},
            {"q": "Which source does the tutor recommend for statistics?", "a": "The International Energy Agency (IEA)", "type": "short_answer"},
        ]
    ),
    (
        4,
        "Lecture on urban farming",
        "A professor gives a lecture to undergraduate students about the growth of urban farming around the world.",
        [
            {"q": "According to the lecturer, what is the main driver of urban farming growth?", "a": "Rising food prices and concerns about food security", "type": "short_answer"},
            {"q": "Name TWO crops commonly grown in urban farms.", "a": "Lettuce and tomatoes (also acceptable: herbs, kale)", "type": "short_answer"},
            {"q": "What percentage of the world's food could urban farms supply by 2050, according to the lecturer?", "a": "10%", "type": "short_answer"},
            {"q": "Urban farming can help reduce carbon emissions from food transportation.", "a": "TRUE", "type": "true_false"},
        ]
    ),
]

def build_ielts_listening(cur):
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS listening_tasks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            section      INTEGER NOT NULL,
            title        TEXT NOT NULL,
            context      TEXT
        );
        CREATE TABLE IF NOT EXISTS listening_questions (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id      INTEGER NOT NULL REFERENCES listening_tasks(id),
            question     TEXT NOT NULL,
            answer       TEXT,
            question_type TEXT
        );
    """)
    for section, title, context, questions in LISTENING_DATA:
        cur.execute(
            "INSERT INTO listening_tasks (section, title, context) VALUES (?,?,?)",
            (section, title, context)
        )
        tid = cur.lastrowid
        for q in questions:
            cur.execute(
                "INSERT INTO listening_questions (task_id, question, answer, question_type) VALUES (?,?,?,?)",
                (tid, q["q"], q["a"], q["type"])
            )
    print(f"  ✓ Listening: {len(LISTENING_DATA)} задания + вопросы добавлены")

# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main():
    print("\n=== SAT ===")
    build_sat()

    print("\n=== IELTS ===")
    db_path = os.path.join(IELTS_DIR, "ielts.db")
    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("PRAGMA foreign_keys = ON")

    build_ielts_writing(cur)
    build_ielts_speaking(cur)
    build_ielts_reading(cur)
    build_ielts_listening(cur)

    con.commit()
    con.close()
    print(f"\n✓ IELTS/ielts.db создан")
    print("\nВсё готово!")

if __name__ == "__main__":
    main()
