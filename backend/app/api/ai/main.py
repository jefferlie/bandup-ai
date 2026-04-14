import os
import shutil
import re
import nltk
import language_tool_python
from nltk import sent_tokenize
from fastapi import APIRouter, UploadFile, File, Form
from pydantic import BaseModel

import google.generativeai as genai

from dotenv import load_dotenv
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[4]  # root
load_dotenv(dotenv_path=PROJECT_ROOT / "band-buddy-connect/.env", override=False)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
nltk.download("punkt", quiet=True)
nltk.download("averaged_perceptron_tagger_eng", quiet=True)
nltk.download("averaged_perceptron_tagger", quiet=True)
ai_router = APIRouter()
class ChatRequest(BaseModel):
    message: str
    subject: str

class ChatResponse(BaseModel):
    reply: str

class EssayInput(BaseModel):
    text: str
try:
    tool = language_tool_python.LanguageToolPublicAPI('en-US')
except Exception as e:
    print(f"Warning: Failed to initialize LanguageTool: {e}")
    tool = None
@ai_router.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    subject_prompts = {
        "writing": "You are a Writing expert. Answer only IELTS Writing related questions.",
        "speaking": "You are a Speaking expert. Answer only IELTS Speaking related questions.",
        "math": "You are a SAT Math expert. Answer only SAT Math related questions.",
    }

    system_prompt = subject_prompts.get(request.subject, "You are an expert. Answer on-topic.")
    
    try:
        model = genai.GenerativeModel(
            model_name="gemini-3-flash-preview",
            system_instruction=system_prompt
        )
        config = genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=1000,
        )
        
        response = model.generate_content(request.message, generation_config=config)
        return ChatResponse(reply=response.text)

    except Exception as e:
        return ChatResponse(reply=f"Error: {str(e)}")
@ai_router.post("/api/speaking/audio", response_model=ChatResponse)
async def speaking_audio_endpoint(
    file: UploadFile = File(...),
    subject: str = Form("speaking")
):
    subject_prompts = {
        "speaking": "You are a Speaking expert. Answer only IELTS Speaking related questions.",
    }
    system_prompt = subject_prompts.get(subject, "You are a Speaking expert. Answer on-topic.")

    try:
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        audio_file = genai.upload_file(path=temp_filename)
        model = genai.GenerativeModel(
            model_name="gemini-3-flash-preview",
            system_instruction=system_prompt
        )
        
        config = genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=1000,
        )
        response = model.generate_content(
            [audio_file, "Listen to this audio and respond appropriately as the expert."],
            generation_config=config
        )
        audio_file.delete()
        os.remove(temp_filename)

        return ChatResponse(reply=response.text)

    except Exception as e:
        return ChatResponse(reply=f"Audio processing error: {str(e)}")
@ai_router.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        audio_file = genai.upload_file(path=temp_filename)
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content([audio_file, "Please transcribe this audio exactly as spoken. Return only the transcription."])
        audio_file.delete()
        os.remove(temp_filename)
        
        return {"text": response.text.strip()}
    except Exception as e:
        return {"error": str(e)}
@ai_router.post("/api/evaluate")
async def evaluate_pronunciation(text: str = Form(...)):
    try:
        prompt = f"""
        You are an IELTS examiner. 
        A student answered with the following text: "{text}".
        1. Give feedback on pronunciation, fluency, coherence, lexical resource, and grammar.
        2. Provide an estimated IELTS Speaking band score (0-9).
        Answer shortly in bullet points + band score.
        """
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        
        return {"feedback": response.text}
    except Exception as e:
        return {"error": str(e)}
@ai_router.get("/api/questions")
async def generate_questions():
    try:
        prompt = """
        Generate 3 IELTS Speaking questions:
        - Part 1 (personal, simple)
        - Part 2 (long turn, cue card style)
        - Part 3 (discussion, abstract) 
        """
        model = genai.GenerativeModel("gemini-3-flash-preview")
        response = model.generate_content(prompt)
        
        return {"questions": response.text}
    except Exception as e:
        return {"error": str(e)}
def evaluate_structure(text: str):
    lower = text.lower()
    has_intro = bool(re.search(r"(in this essay|this essay will|to begin|first of all|introduction)", lower))
    has_body = len(sent_tokenize(text)) >= 5
    has_conclusion = bool(re.search(r"(in conclusion|to sum up|overall|finally|lastly)", lower))

    return {
        "has_introduction": has_intro,
        "has_body": has_body,
        "has_conclusion": has_conclusion
    }

def generate_recommendations(matches, structure_eval):
    recs = []
    if len(matches) > 10:
        recs.append("Too many grammar or spelling mistakes. Review your essay carefully.")
    if not structure_eval["has_introduction"]:
        recs.append("Add a clear introduction to present the topic.")
    if not structure_eval["has_conclusion"]:
        recs.append("Write a conclusion that summarizes key ideas.")
    if not structure_eval["has_body"]:
        recs.append("Develop arguments in more detail and include examples.")
    return recs

def predict_ielts_score(matches, structure_eval, text):
    base_score = 7.0
    if len(matches) > 15:
        base_score -= 1.5
    elif len(matches) > 10:
        base_score -= 1.0
    elif len(matches) > 5:
        base_score -= 0.5
    if not structure_eval["has_introduction"]:
        base_score -= 0.5
    if not structure_eval["has_conclusion"]:
        base_score -= 0.5
    word_count = len(text.split())
    if word_count < 250:
        base_score -= 0.5
    elif word_count > 400:
        base_score -= 0.2
    return max(0, min(9, round(base_score, 1))) 

@ai_router.post("/api/essay/check")
def check_essay(data: EssayInput):
    text = data.text
    matches = tool.check(text) if tool else []
    structure_eval = evaluate_structure(text)
    recommendations = generate_recommendations(matches, structure_eval)
    ielts_score = predict_ielts_score(matches, structure_eval, text)

    suggestions = []
    for match in matches:
        suggestions.append({
            "message": match.message,
            "error": text[match.offset:match.offset + match.errorLength],
            "suggestions": match.replacements,
            "context": match.context.text,
            "rule": match.ruleId
        })

    return {
        "original_text": text,
        "grammar_issues": len(matches),
        "grammar_suggestions": suggestions,
        "structure_evaluation": structure_eval,
        "recommendations": recommendations,
        "predicted_ielts_score": ielts_score
    }
async def evaluate_writing_with_gemini(answers: dict, test_data: dict) -> dict:
    import json
    
    prompt = f"You are a strict and professional IELTS examiner. Evaluate the student's writing response(s).\n\n"
    prompt += f"Test Instructions Context:\n{test_data.get('instruction', '')}\n\n"
    prompt += "Student's Answers:\n"
    
    for task_id, text in answers.items():
        task_info = next((t for t in test_data.get('tasks', []) if t['id'] == task_id), None)
        prompt += f"\n--- Task: {task_info.get('title', task_id) if task_info else task_id} ---\n"
        if task_info:
            prompt += f"Prompt: {task_info.get('question', '')}\n"
        prompt += f"Student's text:\n{text}\n"

    prompt += """
    Based on the official IELTS writing rubrics, evaluate the text and provide a score from 0 to 9 (in 0.5 increments).
    Provide the output STRICTLY in JSON format without any markdown wrappers (no ```json).
    Use this exact JSON structure:
    {
      "overall_score": 6.5,
      "task_response": {"score": 6.0, "feedback": "Detailed feedback here..."},
      "coherence": {"score": 7.0, "feedback": "Detailed feedback here..."},
      "lexical_resource": {"score": 6.5, "feedback": "Detailed feedback here..."},
      "grammar": {"score": 6.0, "feedback": "Detailed feedback here..."}
    }
    """

    try:
        model = genai.GenerativeModel(
            model_name="gemini-3-flash-preview",
            system_instruction="You are an IELTS Writing examiner. Evaluate strictly but fairly."
        )
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                response_mime_type="application/json"
            )
        )
        
        result_text = response.text.strip()
        return json.loads(result_text)
    except Exception as e:
        print(f"Error evaluating essay with Gemini: {e}")
        return None
async def evaluate_speaking_with_gemini(answers: dict, test_data: dict) -> dict:
    import json
    
    prompt = f"You are a strict and professional IELTS Speaking examiner. Evaluate the student's speaking response transcripts.\n\n"
    prompt += f"Test Instructions Context:\n{test_data.get('instruction', '')}\n\n"
    prompt += "Student's Transcripts:\n"
    
    for task_id, text in answers.items():
        task_info = next((t for t in test_data.get('tasks', []) if t['id'] == task_id), None)
        prompt += f"\n--- Task: {task_info.get('title', task_id) if task_info else task_id} ---\n"
        if task_info:
            prompt += f"Prompt: {task_info.get('question', '')}\n"
        prompt += f"Student's text:\n{text}\n"

    prompt += """
    Based on the official IELTS speaking rubrics (focusing on Fluency and Coherence, Lexical Resource, and Grammatical Range and Accuracy based on the transcript), evaluate the response and provide an estimated score from 0 to 9 (in 0.5 increments).
    Provide the output STRICTLY in JSON format without any markdown wrappers (no ```json).
    Use this exact JSON structure:
    {
      "overall_score": 6.5,
      "fluency_and_coherence": {"score": 6.0, "feedback": "Detailed feedback here..."},
      "lexical_resource": {"score": 6.5, "feedback": "Detailed feedback here..."},
      "grammar": {"score": 6.0, "feedback": "Detailed feedback here..."}
    }
    """

    try:
        model = genai.GenerativeModel(
            model_name="gemini-3-flash-preview",
            system_instruction="You are an IELTS Speaking examiner. Evaluate strictly but fairly based on the provided transcripts."
        )
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,
                response_mime_type="application/json"
            )
        )
        
        result_text = response.text.strip()
        return json.loads(result_text)
    except Exception as e:
        print(f"Error evaluating speaking with Gemini: {e}")
        return None
