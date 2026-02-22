import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import logo from "../assets/logo.png";
import { TextHighlighter } from "../components/TextHighlighter";
import { ModeToggle } from "../components/mode-toggle";
import ApiErrorState from "../components/ApiErrorState";
import { practiceService, SubmitAttemptResult } from "../services/practiceService";

const WAVEFORM_BARS = 48;

const formatAudioTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainSeconds = rounded % 60;
  return `${minutes}:${String(remainSeconds).padStart(2, "0")}`;
};

const createFallbackWaveform = (seed: string) => {
  const bars = Array.from({ length: WAVEFORM_BARS }, (_, index) => {
    const char = seed.charCodeAt(index % Math.max(seed.length, 1)) || 97;
    const value = Math.abs(Math.sin((char + index) * 0.31));
    return Math.max(15, Math.round(value * 100));
  });
  return bars;
};

const buildWaveformFromAudio = async (audioUrl: string) => {
  if (!audioUrl) {
    return createFallbackWaveform("no-audio");
  }

  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Audio fetch failed with ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return createFallbackWaveform(audioUrl);
  }

  const audioContext = new AudioContextCtor();

  try {
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const channelData = decodedBuffer.getChannelData(0);
    const chunkSize = Math.max(1, Math.floor(channelData.length / WAVEFORM_BARS));
    const rawBars: number[] = [];

    for (let barIndex = 0; barIndex < WAVEFORM_BARS; barIndex += 1) {
      const start = barIndex * chunkSize;
      const end = Math.min(start + chunkSize, channelData.length);

      let sum = 0;
      for (let index = start; index < end; index += 1) {
        const sample = channelData[index] || 0;
        sum += sample * sample;
      }

      const average = end > start ? Math.sqrt(sum / (end - start)) : 0;
      rawBars.push(average);
    }

    const max = Math.max(...rawBars, 0.0001);
    return rawBars.map((bar) => Math.max(15, Math.min(100, Math.round((bar / max) * 100))));
  } finally {
    void audioContext.close();
  }
};

const CustomInput = ({
  qId,
  num,
  answers,
  handleInput,
  isReviewMode,
  result,
}: {
  qId: string;
  num: number;
  answers: Record<string, string>;
  handleInput: (id: string, val: string) => void;
  isReviewMode?: boolean;
  result?: { isCorrect: boolean; correctAnswer: string };
}) => (
  <span className="inline-flex items-center gap-2 mx-1 relative align-middle">
    <span className={`font-bold border rounded px-1.5 py-0.5 text-xs shadow-sm leading-none shrink-0 ${isReviewMode
      ? result?.isCorrect
        ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400'
        : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
      : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
      }`}>
      {num}
    </span>
    <div className="relative inline-block mt-4 mb-1">
      <input
        type="text"
        value={answers[qId] || ""}
        onChange={(e) => handleInput(qId, e.target.value)}
        disabled={isReviewMode}
        className={`w-36 py-1 px-2 border-b-2 bg-transparent text-sm transition-colors text-slate-900 dark:text-white focus:outline-none ${isReviewMode
          ? result?.isCorrect
            ? "border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-t-sm opacity-100 tracking-wide text-center"
            : "border-red-500 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-t-sm opacity-100 tracking-wide line-through decoration-red-500 decoration-2 text-center text-slate-400"
          : "border-slate-300 dark:border-slate-600 focus:border-primary text-center"
          }`}
      />
      {isReviewMode && result && (
        <span className="absolute bottom-[110%] left-0 right-0 flex justify-center pointer-events-none z-10 w-full mb-1">
          {result.isCorrect ? (
            <span className="material-symbols-outlined text-green-500 text-[18px] drop-shadow-sm bg-white dark:bg-slate-900 rounded-full">check_circle</span>
          ) : (
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
              {result.correctAnswer}
            </span>
          )}
        </span>
      )}
    </div>
  </span>
);

const Part1Cam20Test4 = ({
  answers,
  handleInput,
  isReviewMode,
  results,
}: {
  answers: Record<string, string>;
  handleInput: (id: string, val: string) => void;
  isReviewMode?: boolean;
  results?: Record<string, { isCorrect: boolean; correctAnswer: string }>;
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 sm:p-10 mb-6 font-serif max-w-4xl mx-auto shadow-sm">
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">Complete the notes below.</h3>
        <p className="text-slate-700 dark:text-slate-300 uppercase tracking-wide text-sm font-semibold">
          Write <span className="font-bold border-b-2 border-slate-900 dark:border-white">ONE WORD AND/OR A NUMBER</span> for each answer.
        </p>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-white">Advice on Family Visit</h2>
      </div>

      <div className="space-y-6 text-slate-800 dark:text-slate-200 leading-relaxed text-[15px]">
        
        <div>
          <h4 className="font-bold text-lg mb-2">Accommodation</h4>
          <div className="pl-4 sm:pl-8 space-y-3">
            <p>
              <CustomInput qId="q1" num={1} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q1']} /> Hotel on George Street
            </p>
            <p>
              Cost of family room per night: £ <CustomInput qId="q2" num={2} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q2']} /> (approx.)
            </p>
          </div>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Recommended Trips</h4>
          <div className="pl-4 sm:pl-8 space-y-3">
            <p>
              A <CustomInput qId="q3" num={3} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q3']} /> tour of the city centre (starts in Carlton Square)
            </p>
            <p>
              A trip by <CustomInput qId="q4" num={4} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q4']} /> to the old fort
            </p>
          </div>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Science Museum</h4>
          <div className="pl-4 sm:pl-8 space-y-3">
            <p>
              Best day to visit: <CustomInput qId="q5" num={5} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q5']} />
            </p>
            <p>
              See the exhibition about <CustomInput qId="q6" num={6} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q6']} /> which opens soon
            </p>
          </div>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Food</h4>
          <div className="pl-4 sm:pl-8 space-y-2">
            <p>Clacton Market:</p>
            <ul className="list-disc pl-6 space-y-2 overflow-visible">
              <li>Good for <CustomInput qId="q7" num={7} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q7']} /> food</li>
              <li>Need to have lunch before <CustomInput qId="q8" num={8} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q8']} /> p.m.</li>
            </ul>
          </div>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Theatre Tickets</h4>
          <div className="pl-4 sm:pl-8 space-y-3">
            <p>
              Save up to <CustomInput qId="q9" num={9} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q9']} /> % on ticket prices at bargaintickets.com
            </p>
          </div>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Free Activities</h4>
          <div className="pl-4 sm:pl-8 space-y-2">
            <p>Blakewell Gardens:</p>
            <ul className="list-disc pl-6 space-y-2 overflow-visible">
              <li>Roots Music Festival</li>
              <li>Climb Telegraph Hill to see a view of the <CustomInput qId="q10" num={10} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q10']} /></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const Part2Cam20Test4 = ({
  answers,
  handleInput,
  isReviewMode,
  results,
}: {
  answers: Record<string, string>;
  handleInput: (id: string, val: string) => void;
  isReviewMode?: boolean;
  results?: Record<string, { isCorrect: boolean; correctAnswer: string }>;
}) => {
  const toggleCheckbox = (qIds: string[], letter: string) => {
    const allSelected: string[] = [];
    qIds.forEach(qId => {
      if (answers[qId]) allSelected.push(answers[qId]);
    });

    if (allSelected.includes(letter)) {
      const idx = allSelected.indexOf(letter);
      allSelected.splice(idx, 1);
    } else {
      if (allSelected.length < 2) {
        allSelected.push(letter);
      } else {
        return; // Already picked 2
      }
    }
    allSelected.sort();
    qIds.forEach((qId, i) => {
      handleInput(qId, allSelected[i] || '');
    });
  };

  const isChecked = (qIds: string[], letter: string) => {
    return qIds.some(qId => answers[qId] === letter);
  };

  const historyEvents = [
    { value: 'A', label: 'A the introduction of pay for the players' },
    { value: 'B', label: 'B a change to the design of the goal' },
    { value: 'C', label: 'C the first use of lights for matches' },
    { value: 'D', label: 'D the introduction of goalkeepers' },
    { value: 'E', label: 'E the first international match' },
    { value: 'F', label: 'F two changes to the rules of the game' },
    { value: 'G', label: 'G the introduction of a fee for spectators' },
    { value: 'H', label: 'H an agreement on the length of a game' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 sm:p-10 mb-6 font-serif max-w-4xl mx-auto">
      
      <div className="mb-10">
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 11-12</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
          Choose <span className="font-bold">TWO</span> letters, <span className="font-bold">A-E</span>
        </p>
        <div className="mb-4">
          <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed">
            <span className="inline-flex items-center gap-1 mr-1">
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q11']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>11</span>
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q12']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>12</span>
            </span>
            Which TWO things does the speaker say about visiting the football stadium with children?
          </p>
        </div>
        <div className="space-y-3 pl-4 sm:pl-8">
          {[
            { letter: 'A', text: 'Children can get their photo taken with a football player' },
            { letter: 'B', text: 'There is a competition for children today' },
            { letter: 'C', text: 'Parents must stay with their children at all times' },
            { letter: 'D', text: 'Children will need sunhats and drinks' },
            { letter: 'E', text: 'The café has a special offer on meals for children' },
          ].map(({ letter, text }) => {
            const isSelected = isChecked(['q11', 'q12'], letter);
            const isCorrectAnswer = isReviewMode && (results?.['q11']?.correctAnswer === letter || results?.['q12']?.correctAnswer === letter);
            const isUserWrong = isReviewMode && isSelected && !isCorrectAnswer;

            return (
              <label key={letter} className={`flex items-start gap-3 group ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${isCorrectAnswer ? 'bg-green-50 dark:bg-green-900/20 p-2 rounded -ml-2' : isUserWrong ? 'bg-red-50 dark:bg-red-900/20 p-2 rounded -ml-2' : 'p-2 -ml-2'}`}>
                <span className={`font-bold text-sm w-5 shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-600' : isUserWrong ? 'text-red-500' : 'text-primary'}`}>{letter}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCheckbox(['q11', 'q12'], letter)}
                  disabled={isReviewMode}
                  className={`mt-1 w-4 h-4 rounded shrink-0 ${isCorrectAnswer ? 'accent-green-500' : isUserWrong ? 'accent-red-500' : 'accent-primary border-slate-300 dark:border-slate-600'}`}
                />
                <span className={`text-sm transition-colors ${isCorrectAnswer ? 'text-green-700 dark:text-green-400 font-semibold' : isUserWrong ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  {text}
                  {isCorrectAnswer && <span className="ml-2 inline-flex items-center text-green-600"><span className="material-symbols-outlined text-[16px] leading-none">check_circle</span></span>}
                  {isUserWrong && <span className="ml-2 inline-flex items-center text-red-500"><span className="material-symbols-outlined text-[16px] leading-none">cancel</span></span>}
                </span>
              </label>
            );
          })}
          {isReviewMode && ['q11', 'q12'].filter(q => answers[q]).length < 2 && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 w-fit">
              <span className="material-symbols-outlined text-[18px]">error</span>
              You missed {2 - ['q11', 'q12'].filter(q => answers[q]).length} answer(s).
            </div>
          )}
        </div>
      </div>

      
      <div className="mb-10">
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 13-14</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
          Choose <span className="font-bold">TWO</span> letters, <span className="font-bold">A-E</span>
        </p>
        <div className="mb-4">
          <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed">
            <span className="inline-flex items-center gap-1 mr-1">
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q13']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>13</span>
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q14']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>14</span>
            </span>
            Which TWO features of the stadium tour are new this year?
          </p>
        </div>
        <div className="space-y-3 pl-4 sm:pl-8">
          {[
            { letter: 'A', text: 'VIP tour' },
            { letter: 'B', text: '360 cinema experience' },
            { letter: 'C', text: 'audio guide' },
            { letter: 'D', text: 'dressing room tour' },
            { letter: 'E', text: 'tours in other languages' },
          ].map(({ letter, text }) => {
            const isSelected = isChecked(['q13', 'q14'], letter);
            const isCorrectAnswer = isReviewMode && (results?.['q13']?.correctAnswer === letter || results?.['q14']?.correctAnswer === letter);
            const isUserWrong = isReviewMode && isSelected && !isCorrectAnswer;

            return (
              <label key={letter} className={`flex items-start gap-3 group ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${isCorrectAnswer ? 'bg-green-50 dark:bg-green-900/20 p-2 rounded -ml-2' : isUserWrong ? 'bg-red-50 dark:bg-red-900/20 p-2 rounded -ml-2' : 'p-2 -ml-2'}`}>
                <span className={`font-bold text-sm w-5 shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-600' : isUserWrong ? 'text-red-500' : 'text-primary'}`}>{letter}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCheckbox(['q13', 'q14'], letter)}
                  disabled={isReviewMode}
                  className={`mt-1 w-4 h-4 rounded shrink-0 ${isCorrectAnswer ? 'accent-green-500' : isUserWrong ? 'accent-red-500' : 'accent-primary border-slate-300 dark:border-slate-600'}`}
                />
                <span className={`text-sm transition-colors ${isCorrectAnswer ? 'text-green-700 dark:text-green-400 font-semibold' : isUserWrong ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  {text}
                  {isCorrectAnswer && <span className="ml-2 inline-flex items-center text-green-600"><span className="material-symbols-outlined text-[16px] leading-none">check_circle</span></span>}
                  {isUserWrong && <span className="ml-2 inline-flex items-center text-red-500"><span className="material-symbols-outlined text-[16px] leading-none">cancel</span></span>}
                </span>
              </label>
            );
          })}
          {isReviewMode && ['q13', 'q14'].filter(q => answers[q]).length < 2 && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 w-fit">
              <span className="material-symbols-outlined text-[18px]">error</span>
              You missed {2 - ['q13', 'q14'].filter(q => answers[q]).length} answer(s).
            </div>
          )}
        </div>
      </div>

      
      <div>
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 15-20</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          Which event in the history of football in the UK took place in each of the following years?
        </p>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-4">
          Choose <span className="font-bold">SIX</span> answers from the box and write the correct letter, <span className="font-bold">A-H</span>, next to Questions
        </p>

        <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h4 className="font-bold text-sm mb-3 text-slate-900 dark:text-white">Events in the history of football</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            {historyEvents.map(({ value, label }) => (
              <p key={value}><span className="font-bold">{value}</span> {label.slice(2)}</p>
            ))}
          </div>
        </div>

        <div className="space-y-4 pl-4 sm:pl-8">
          {[
            { qId: 'q15', year: '1870' },
            { qId: 'q16', year: '1874' },
            { qId: 'q17', year: '1875' },
            { qId: 'q18', year: '1877' },
            { qId: 'q19', year: '1878' },
            { qId: 'q20', year: '1880' },
          ].map(({ qId, year }) => {
            const num = parseInt(qId.replace('q', ''));
            const res = results?.[qId];
            return (
              <div key={qId} className="flex items-center gap-3 relative">
                <span className={`font-bold border rounded px-1.5 py-0.5 text-xs shadow-sm ${isReviewMode
                  ? res?.isCorrect
                    ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                    : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                  : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                  }`}>{num}</span>
                <span className="font-medium text-sm text-slate-800 dark:text-slate-200 w-12">{year}</span>
                <div className="relative">
                  <select
                    value={answers[qId] || ''}
                    onChange={(e) => handleInput(qId, e.target.value)}
                    disabled={isReviewMode}
                    className={`w-32 sm:w-44 rounded-md px-3 py-2 text-sm focus:outline-none appearance-none ${isReviewMode
                      ? res?.isCorrect
                        ? "border border-green-500 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                        : "border border-red-500 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
                      : "border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary"
                      }`}
                  >
                    <option value="" disabled>Select...</option>
                    {historyEvents.map(({ value }) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                  {isReviewMode && res && (
                    <span className="absolute -right-6 top-1/2 -translate-y-1/2 flex items-center">
                      {res.isCorrect ? (
                        <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-red-500 text-[18px]">cancel</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 shadow-sm whitespace-nowrap">
                            {res.correctAnswer}
                          </span>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Part3Cam20Test4 = ({
  answers,
  handleInput,
  isReviewMode,
  results,
}: {
  answers: Record<string, string>;
  handleInput: (id: string, val: string) => void;
  isReviewMode?: boolean;
  results?: Record<string, { isCorrect: boolean; correctAnswer: string }>;
}) => {
  const toggleCheckbox = (qIds: string[], letter: string) => {
    const allSelected: string[] = [];
    qIds.forEach(qId => {
      if (answers[qId]) allSelected.push(answers[qId]);
    });
    if (allSelected.includes(letter)) {
      const idx = allSelected.indexOf(letter);
      allSelected.splice(idx, 1);
    } else {
      if (allSelected.length < 2) {
        allSelected.push(letter);
      } else {
        return;
      }
    }
    allSelected.sort();
    qIds.forEach((qId, i) => {
      handleInput(qId, allSelected[i] || '');
    });
  };

  const isChecked = (qIds: string[], letter: string) => {
    return qIds.some(qId => answers[qId] === letter);
  };

  const RadioQuestion = ({ qId, num, prompt, options }: {
    qId: string; num: number; prompt: string;
    options: { letter: string; text: string }[];
  }) => {
    const res = results?.[qId];
    return (
      <div className="mb-8">
        <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed mb-4 relative">
          <span className={`font-bold border rounded px-1.5 py-0.5 text-xs mr-2 ${isReviewMode
            ? res?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
            : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
            }`}>{num}</span>
          {prompt}
        </p>
        <div className="space-y-3 pl-4 sm:pl-8">
          {options.map(({ letter, text }) => {
            const isSelected = answers[qId] === letter;
            const isCorrectAnswer = isReviewMode && res?.correctAnswer === letter;
            const isUserWrong = isReviewMode && isSelected && !isCorrectAnswer;

            return (
              <label key={letter} className={`flex items-start gap-3 group ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${isCorrectAnswer ? 'bg-green-50 dark:bg-green-900/20 p-2 rounded -ml-2' : isUserWrong ? 'bg-red-50 dark:bg-red-900/20 p-2 rounded -ml-2' : 'p-2 -ml-2'}`}>
                <span className={`font-bold text-sm w-5 shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-600' : isUserWrong ? 'text-red-500' : 'text-primary'}`}>{letter}</span>
                <input
                  type="radio"
                  name={qId}
                  checked={isSelected}
                  onChange={() => handleInput(qId, letter)}
                  disabled={isReviewMode}
                  className={`mt-1 w-4 h-4 shrink-0 ${isCorrectAnswer ? 'accent-green-500' : isUserWrong ? 'accent-red-500' : 'accent-primary'}`}
                />
                <span className={`text-sm transition-colors ${isCorrectAnswer ? 'text-green-700 dark:text-green-400 font-semibold' : isUserWrong ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  {text}
                  {isCorrectAnswer && <span className="ml-2 inline-flex items-center text-green-600"><span className="material-symbols-outlined text-[16px] leading-none">check_circle</span></span>}
                  {isUserWrong && <span className="ml-2 inline-flex items-center text-red-500"><span className="material-symbols-outlined text-[16px] leading-none">cancel</span></span>}
                </span>
              </label>
            );
          })}
          {isReviewMode && !answers[qId] && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 w-fit">
              <span className="material-symbols-outlined text-[18px]">error</span>
              You missed this question.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 sm:p-10 mb-6 font-serif max-w-4xl mx-auto">
      
      <div className="mb-10">
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 21-22</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
          Choose <span className="font-bold">TWO</span> letters, <span className="font-bold">A-E</span>
        </p>
        <div className="mb-4">
          <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed">
            <span className="inline-flex items-center gap-1 mr-1">
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q21']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>21</span>
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q22']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>22</span>
            </span>
            Which TWO benefits for children of learning to write did both students find surprising?
          </p>
        </div>
        <div className="space-y-3 pl-4 sm:pl-8">
          {[
            { letter: 'A', text: 'improved fine motor skills' },
            { letter: 'B', text: 'improved memory' },
            { letter: 'C', text: 'improved concentration' },
            { letter: 'D', text: 'improved imagination' },
            { letter: 'E', text: 'improved spatial awareness' },
          ].map(({ letter, text }) => {
            const isSelected = isChecked(['q21', 'q22'], letter);
            const isCorrectAnswer = isReviewMode && (results?.['q21']?.correctAnswer === letter || results?.['q22']?.correctAnswer === letter);
            const isUserWrong = isReviewMode && isSelected && !isCorrectAnswer;

            return (
              <label key={letter} className={`flex items-start gap-3 group ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${isCorrectAnswer ? 'bg-green-50 dark:bg-green-900/20 p-2 rounded -ml-2' : isUserWrong ? 'bg-red-50 dark:bg-red-900/20 p-2 rounded -ml-2' : 'p-2 -ml-2'}`}>
                <span className={`font-bold text-sm w-5 shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-600' : isUserWrong ? 'text-red-500' : 'text-primary'}`}>{letter}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCheckbox(['q21', 'q22'], letter)}
                  disabled={isReviewMode}
                  className={`mt-1 w-4 h-4 rounded shrink-0 ${isCorrectAnswer ? 'accent-green-500' : isUserWrong ? 'accent-red-500' : 'accent-primary border-slate-300 dark:border-slate-600'}`}
                />
                <span className={`text-sm transition-colors ${isCorrectAnswer ? 'text-green-700 dark:text-green-400 font-semibold' : isUserWrong ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  {text}
                  {isCorrectAnswer && <span className="ml-2 inline-flex items-center text-green-600"><span className="material-symbols-outlined text-[16px] leading-none">check_circle</span></span>}
                  {isUserWrong && <span className="ml-2 inline-flex items-center text-red-500"><span className="material-symbols-outlined text-[16px] leading-none">cancel</span></span>}
                </span>
              </label>
            );
          })}
          {isReviewMode && ['q21', 'q22'].filter(q => answers[q]).length < 2 && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 w-fit">
              <span className="material-symbols-outlined text-[18px]">error</span>
              You missed {2 - ['q21', 'q22'].filter(q => answers[q]).length} answer(s).
            </div>
          )}
        </div>
      </div>

      
      <div className="mb-10">
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 23-24</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
          Choose <span className="font-bold">TWO</span> letters, <span className="font-bold">A-E</span>
        </p>
        <div className="mb-4">
          <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed">
            <span className="inline-flex items-center gap-1 mr-1">
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q23']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>23</span>
              <span className={`font-bold border rounded px-1.5 py-0.5 text-xs ${isReviewMode
                ? results?.['q24']?.isCorrect ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-400' : 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                : 'bg-slate-100 border-slate-400 text-slate-700 dark:bg-slate-800 dark:border-slate-500 dark:text-slate-300'
                }`}>24</span>
            </span>
            For children with dyspraxia, which TWO problems with handwriting do the students think are easiest to correct?
          </p>
        </div>
        <div className="space-y-3 pl-4 sm:pl-8">
          {[
            { letter: 'A', text: 'not spacing letters correctly' },
            { letter: 'B', text: 'not writing in a straight line' },
            { letter: 'C', text: 'applying too much pressure when writing' },
            { letter: 'D', text: 'confusing letter shapes' },
            { letter: 'E', text: 'writing very slowly' },
          ].map(({ letter, text }) => {
            const isSelected = isChecked(['q23', 'q24'], letter);
            const isCorrectAnswer = isReviewMode && (results?.['q23']?.correctAnswer === letter || results?.['q24']?.correctAnswer === letter);
            const isUserWrong = isReviewMode && isSelected && !isCorrectAnswer;

            return (
              <label key={letter} className={`flex items-start gap-3 group ${isReviewMode ? 'cursor-default' : 'cursor-pointer'} ${isCorrectAnswer ? 'bg-green-50 dark:bg-green-900/20 p-2 rounded -ml-2' : isUserWrong ? 'bg-red-50 dark:bg-red-900/20 p-2 rounded -ml-2' : 'p-2 -ml-2'}`}>
                <span className={`font-bold text-sm w-5 shrink-0 mt-0.5 ${isCorrectAnswer ? 'text-green-600' : isUserWrong ? 'text-red-500' : 'text-primary'}`}>{letter}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCheckbox(['q23', 'q24'], letter)}
                  disabled={isReviewMode}
                  className={`mt-1 w-4 h-4 rounded shrink-0 ${isCorrectAnswer ? 'accent-green-500' : isUserWrong ? 'accent-red-500' : 'accent-primary border-slate-300 dark:border-slate-600'}`}
                />
                <span className={`text-sm transition-colors ${isCorrectAnswer ? 'text-green-700 dark:text-green-400 font-semibold' : isUserWrong ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                  {text}
                  {isCorrectAnswer && <span className="ml-2 inline-flex items-center text-green-600"><span className="material-symbols-outlined text-[16px] leading-none">check_circle</span></span>}
                  {isUserWrong && <span className="ml-2 inline-flex items-center text-red-500"><span className="material-symbols-outlined text-[16px] leading-none">cancel</span></span>}
                </span>
              </label>
            );
          })}
          {isReviewMode && ['q23', 'q24'].filter(q => answers[q]).length < 2 && (
            <div className="mt-4 text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 w-fit">
              <span className="material-symbols-outlined text-[18px]">error</span>
              You missed {2 - ['q23', 'q24'].filter(q => answers[q]).length} answer(s).
            </div>
          )}
        </div>
      </div>

      
      <div>
        <h3 className="font-bold text-base mb-1 text-slate-900 dark:text-white">Questions 25-30</h3>
        <p className="text-slate-700 dark:text-slate-300 text-sm mb-6">
          Choose the correct letter, <span className="font-bold">A, B or C</span>
        </p>

        <RadioQuestion qId="q25" num={25}
          prompt="What does the woman say about using laptops to teach writing to children with dyslexia?"
          options={[
            { letter: 'A', text: 'Children often lack motivation to learn that way' },
            { letter: 'B', text: 'Children become fluent relatively quickly' },
            { letter: 'C', text: 'Children react more positively if they make a mistake' },
          ]}
        />

        <RadioQuestion qId="q26" num={26}
          prompt="When discussing whether to teach cursive or print writing, the woman thinks that"
          options={[
            { letter: 'A', text: 'cursive writing disadvantages a certain group of children' },
            { letter: 'B', text: 'print writing is associated with lower academic performance' },
            { letter: 'C', text: 'most teachers in the UK prefer a traditional approach to handwriting' },
          ]}
        />

        <RadioQuestion qId="q27" num={27}
          prompt="According to the students, what impact does poor handwriting have on exam performance?"
          options={[
            { letter: 'A', text: 'There is evidence to suggest grades are affected by poor handwriting' },
            { letter: 'B', text: 'Neat handwriting is less important now than it used to be' },
            { letter: 'C', text: 'Candidates write more slowly and produce shorter answers' },
          ]}
        />

        <RadioQuestion qId="q28" num={28}
          prompt="What prediction does the man make about the future of handwriting?"
          options={[
            { letter: 'A', text: 'Touch typing will be taught before writing by hand' },
            { letter: 'B', text: 'Children will continue to learn to write by hand' },
            { letter: 'C', text: 'People will dislike handwriting on digital devices' },
          ]}
        />

        <RadioQuestion qId="q29" num={29}
          prompt="The woman is concerned that relying on digital devices has made it difficult for her to"
          options={[
            { letter: 'A', text: 'take detailed notes' },
            { letter: 'B', text: 'spell and punctuate' },
            { letter: 'C', text: 'read old documents' },
          ]}
        />

        <RadioQuestion qId="q30" num={30}
          prompt="How do the students feel about their own handwriting?"
          options={[
            { letter: 'A', text: 'concerned they are unable to write quickly' },
            { letter: 'B', text: 'embarrassed by comments made about it' },
            { letter: 'C', text: 'regretful that they have lost the habit' },
          ]}
        />
      </div>
    </div>
  );
};

const Part4Cam20Test4 = ({
  answers,
  handleInput,
  isReviewMode,
  results,
}: {
  answers: Record<string, string>;
  handleInput: (id: string, val: string) => void;
  isReviewMode?: boolean;
  results?: Record<string, { isCorrect: boolean; correctAnswer: string }>;
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 sm:p-10 mb-6 font-serif max-w-4xl mx-auto">
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">Complete the notes below.</h3>
        <p className="text-slate-700 dark:text-slate-300 uppercase tracking-wide text-sm font-semibold">
          Write <span className="font-bold border-b-2 border-slate-900 dark:border-white">ONE WORD ONLY</span> for each answer.
        </p>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 dark:text-white">Research in the Area Around the Chem be Bird Sanctuary</h2>
      </div>

      <div className="space-y-6 text-slate-800 dark:text-slate-200 leading-relaxed text-[15px]">
        
        <div>
          <h4 className="font-bold text-lg mb-2">The importance of birds of prey to local communities</h4>
          <ul className="list-disc pl-6 space-y-3 overflow-visible">
            <li>They destroy <CustomInput qId="q31" num={31} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q31']} /> and other rodents.</li>
            <li>They help prevent farmers from being bitten by <CustomInput qId="q32" num={32} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q32']} />.</li>
            <li>They have been an important part of local culture for many years.</li>
            <li>They now support the economy by encouraging <CustomInput qId="q33" num={33} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q33']} /> in the area.</li>
          </ul>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Falling numbers of birds of prey</h4>
          <p className="mb-2">– The birds may be accidentally killed:</p>
          <ul className="list-disc pl-10 space-y-3 overflow-visible mb-3">
            <li>By <CustomInput qId="q34" num={34} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q34']} /> when hunting or sleeping.</li>
            <li>By electrocution from power lines, especially during times of high <CustomInput qId="q35" num={35} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q35']} />.</li>
          </ul>
          <p>– Local farmers may illegally shoot them or <CustomInput qId="q36" num={36} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q36']} /> them.</p>
        </div>

        
        <div>
          <h4 className="font-bold text-lg mb-2">Ways of protecting chickens from birds of prey</h4>
          <div className="space-y-3">
            <p>– Clearing away vegetation (unhelpful).</p>
            <p>– Providing a <CustomInput qId="q37" num={37} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q37']} /> for chickens (expensive).</p>
            <p>– Frightening birds of prey by:</p>
            <ul className="list-disc pl-10 space-y-3 overflow-visible">
              <li>Keeping a <CustomInput qId="q38" num={38} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q38']} />.</li>
              <li>Making a <CustomInput qId="q39" num={39} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q39']} /> (e.g., with metal objects).</li>
            </ul>
            <p>– A <CustomInput qId="q40" num={40} answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} result={results?.['q40']} /> of methods is usually most effective.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const PracticeListening = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const testId = searchParams.get("testId") || "listening-default";

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(createFallbackWaveform(testId));
  const [isWaveformLoading, setIsWaveformLoading] = useState(false);
  const [audioMessage, setAudioMessage] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submissionResult, setSubmissionResult] = useState<SubmitAttemptResult | null>(null);
  const [testMode, setTestMode] = useState<"practice" | "timed" | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const isTestInProgress = hasStarted && !submissionResult;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const pendingLeaveAction = useRef<(() => void) | null>(null);
  const autoSaveKey = `bandup_listening_partial_${testId}`;
  const [savedSession, setSavedSession] = useState<{ answers: Record<string, string>, elapsedSeconds: number, testMode: "practice" | "timed" } | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  useEffect(() => {
    if (!testId || hasStarted) return;
    const rawSaved = localStorage.getItem(autoSaveKey);
    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (parsed && typeof parsed.elapsedSeconds === 'number') {
          setSavedSession(parsed);
          setShowRestorePrompt(true);
        }
      } catch (e) {
        console.error("Failed to parse saved listening session", e);
      }
    }
  }, [testId, autoSaveKey, hasStarted]);
  useEffect(() => {
    if (isTestInProgress && !showRestorePrompt) {
      const dataToSave = {
        answers,
        elapsedSeconds,
        testMode
      };
      localStorage.setItem(autoSaveKey, JSON.stringify(dataToSave));
    }
  }, [answers, elapsedSeconds, isTestInProgress, testMode, autoSaveKey, showRestorePrompt]);

  const handleRestore = () => {
    if (savedSession) {
      setAnswers(savedSession.answers || {});
      setElapsedSeconds(savedSession.elapsedSeconds || 0);
      setTestMode(savedSession.testMode || "practice");
      setHasStarted(true);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscard = () => {
    localStorage.removeItem(autoSaveKey);
    setSavedSession(null);
    setShowRestorePrompt(false);
  };

  const requestLeave = useCallback((action: () => void) => {
    if (isTestInProgress) {
      pendingLeaveAction.current = action;
      setShowExitConfirm(true);
    } else {
      action();
    }
  }, [isTestInProgress]);

  const confirmLeave = useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current?.();
    pendingLeaveAction.current = null;
  }, []);

  const cancelLeave = useCallback(() => {
    setShowExitConfirm(false);
    pendingLeaveAction.current = null;
    window.history.pushState(null, "", window.location.href);
  }, []);

  useEffect(() => {
    if (!isTestInProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isTestInProgress]);
  useEffect(() => {
    if (!isTestInProgress) return;
    const onPopState = () => {
      requestLeave(() => window.history.back());
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isTestInProgress, requestLeave]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    data: test,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["practiceListeningTest", testId],
    queryFn: () => practiceService.fetchListeningTest(testId),
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["practiceHistory", "listening"],
    queryFn: () => practiceService.fetchAttemptHistory("listening", 5),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!test) {
        throw new Error("Test is not loaded");
      }
      return practiceService.submitListeningAttempt(test.attemptId, test.testId, test.title, {
        answers,
      });
    },
    onSuccess: async (result) => {
      setSubmissionMessage(`Submitted: ${result.scoreLabel}`);
      setSubmissionResult(result);
      localStorage.removeItem(autoSaveKey); // Clear autosave on submit
      await refetchHistory();
    },
    onError: (submitError) => {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit answers.";
      setSubmissionMessage(message);
    },
  });
  const submitRef = useRef(submitMutation);
  submitRef.current = submitMutation;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (hasStarted && !submissionResult && !showRestorePrompt) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (testMode === "timed" && test?.durationSeconds) {
            if (prev + 1 >= test.durationSeconds) {
              void submitRef.current.mutate();
              return test.durationSeconds;
            }
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasStarted, submissionResult, testMode, test?.durationSeconds, showRestorePrompt]);

  const isFullTest = (test?.questions?.length || 0) > 20;
  const [currentPart, setCurrentPart] = useState(1);
  const currentAudioUrl = useMemo(() => {
    if (!test) return '';
    if (isFullTest && test.partAudios) {
      return test.partAudios[String(currentPart)] || test.audioUrl || '';
    }
    return test.audioUrl || '';
  }, [test, isFullTest, currentPart]);
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    const audio = audioRef.current;
    if (audio && currentAudioUrl) {
      audio.src = currentAudioUrl;
      audio.load();
    }
  }, [currentAudioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const syncProgress = () => {
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", syncProgress);
    audio.addEventListener("loadedmetadata", syncProgress);
    audio.addEventListener("durationchange", syncProgress);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    if (audio.readyState >= 1) {
      syncProgress();
    }

    return () => {
      audio.removeEventListener("timeupdate", syncProgress);
      audio.removeEventListener("loadedmetadata", syncProgress);
      audio.removeEventListener("durationchange", syncProgress);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentAudioUrl]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.trim().length > 0).length,
    [answers]
  );

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const currentLabel = formatAudioTime(currentTime);
  const totalLabel = duration > 0 ? formatAudioTime(duration) : test?.audioDurationLabel || "0:00";

  const handleInput = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) {
      return;
    }

    try {
      setAudioMessage("");
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setAudioMessage("Could not play audio. Check file format and CORS.");
    }
  };

  const handleSeek = (value: string) => {
    const audio = audioRef.current;
    if (!audio || !duration) {
      return;
    }

    const nextProgress = Number.parseFloat(value);
    if (!Number.isFinite(nextProgress)) {
      return;
    }

    const nextTime = (nextProgress / 100) * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };



  const displayedQuestions = useMemo(() => {
    if (!test) return [];
    if (!isFullTest) return test.questions;
    const startIdx = (currentPart - 1) * 10;
    return test.questions.slice(startIdx, startIdx + 10);
  }, [test, isFullTest, currentPart]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading listening test...</p>
        </div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ApiErrorState
          title="Failed to load listening test"
          message="Check endpoint `/api/practice/listening/:testId` or enable local fallback."
          onRetry={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  const renderQuestions = () => {
    const resultsMap = submissionResult?.detailedResults?.reduce((acc, curr) => {
      acc[curr.questionId] = { isCorrect: curr.isCorrect, correctAnswer: curr.correctAnswer };
      return acc;
    }, {} as Record<string, { isCorrect: boolean; correctAnswer: string }>);

    if ((test.testId === "l1" && currentPart === 1) || test.testId === "l1-part1") return <Part1Cam20Test4 answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} results={resultsMap} />;
    if ((test.testId === "l1" && currentPart === 2) || test.testId === "l1-part2") return <Part2Cam20Test4 answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} results={resultsMap} />;
    if ((test.testId === "l1" && currentPart === 3) || test.testId === "l1-part3") return <Part3Cam20Test4 answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} results={resultsMap} />;
    if ((test.testId === "l1" && currentPart === 4) || test.testId === "l1-part4") return <Part4Cam20Test4 answers={answers} handleInput={handleInput} isReviewMode={isReviewMode} results={resultsMap} />;

    return displayedQuestions.map((question, index) => (
      <div
        key={question.id}
        className="bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
      >
        <label className="block text-sm font-medium mb-2">
          {question.prompt}
        </label>
        {question.type === "single-choice" ? (
          <select
            value={answers[question.id] || ""}
            onChange={(event) => handleInput(question.id, event.target.value)}
            disabled={isReviewMode}
            className="w-44 rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="" disabled>Select...</option>
            {(question.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            className="w-full md:w-80 py-2 px-3 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 rounded-md shadow-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-sm"
            placeholder={question.placeholder || "Your Answer"}
            type="text"
            value={answers[question.id] || ""}
            disabled={isReviewMode}
            onChange={(event) => handleInput(question.id, event.target.value)}
          />
        )}
      </div>
    ));
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <header className="bg-surface-light dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => requestLeave(() => navigate("/dashboard"))}
            className="mr-6 flex items-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] mr-1">arrow_back</span>
            <span className="text-sm font-medium">Dashboard</span>
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <img src={logo} alt="BandUp" className="w-8 h-8" />
            <span className="text-xl font-bold text-primary tracking-tight">Band<span className="font-bold text-slate-800 dark:text-white">Up</span></span>
          </div>

          
          <div className="flex-1 flex justify-center">
            {hasStarted && !submissionResult && !showRestorePrompt && (
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${testMode === "timed" && test?.durationSeconds && test.durationSeconds - elapsedSeconds <= 60
                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 animate-pulse"
                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 shadow-sm"
                }`}>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                {testMode === "timed" && test?.durationSeconds
                  ? formatAudioTime(test.durationSeconds - elapsedSeconds)
                  : formatAudioTime(elapsedSeconds)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
          </div>
        </div>
      </header>

      
      {showRestorePrompt && (
        <div className="fixed bottom-24 right-6 z-[110] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl shadow-primary/5 border border-slate-200 dark:border-slate-800 p-4 w-[300px] flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary p-1.5 flex items-center justify-center rounded-md shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[16px]">history</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-0.5">Unfinished attempt</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  Saved answers found. Do you want to restore them?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleDiscard}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Start fresh
              </button>
              <button
                onClick={handleRestore}
                className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-primary hover:bg-blue-700 rounded-md transition-colors shadow-sm"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-serif">
              Really leave test?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              You haven't submitted your answers yet. All progress will be lost. Are you sure you
              want to exit?
            </p>
            <div className="flex items-center justify-end gap-3 flex-row pl-0">
              <button
                onClick={cancelLeave}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
              >
                Yes, Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <TextHighlighter className="flex-grow w-full relative flex flex-col">
        
        <div className="sticky top-16 z-40 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-[0_4px_10px_rgba(0,0,0,0.03)] w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  void togglePlayback();
                }}
                disabled={!currentAudioUrl}
                className="w-10 h-10 flex items-center justify-center shrink-0 rounded-full bg-primary hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-white"
              >
                <span className="material-symbols-outlined text-xl">
                  {isPlaying ? "pause" : "play_arrow"}
                </span>
              </button>

              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 w-24 text-center shrink-0">
                {currentLabel} / {totalLabel}
              </span>

              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={progressPercent}
                  onChange={(event) => handleSeek(event.target.value)}
                  disabled={!currentAudioUrl || duration <= 0}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </div>
        </div>

        <main className={`flex-grow w-full relative ${isReviewMode ? 'flex flex-col md:flex-row overflow-hidden' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24'}`} style={isReviewMode ? { height: 'calc(100vh - 128px)' } : {}}>
          {isReviewMode ? (
            <>
              
              <div className="w-full md:w-1/2 overflow-y-auto p-6 md:p-8 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 custom-scrollbar">
                {test.transcripts?.[currentPart] ? (
                  <>
                    <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100 font-serif border-b border-slate-200 dark:border-slate-800 pb-4">
                      Transcript - Part {currentPart}
                    </h2>
                    <div className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 font-serif leading-relaxed text-[15px]">
                      {(() => {
                        const rawText = test.transcripts[currentPart];
                        if (!isReviewMode) {
                          return rawText.replace(/\[\[\d+:(.*?)\]\]/g, '$1');
                        }
                        const parts = rawText.split(/(\[\[\d+:.*?\]\])/g);
                        return parts.map((part, index) => {
                          const match = part.match(/\[\[(\d+):(.*?)\]\]/);
                          if (match) {
                            const [_, qNum, content] = match;
                            return (
                              <span key={index} className="inline-flex items-center align-baseline">
                                <span className="bg-[#7FFFD4] dark:bg-emerald-800 text-slate-900 dark:text-emerald-50 px-1 py-0.5 box-decoration-clone leading-tight">
                                  {content}
                                </span>
                                <span className="inline-flex items-center justify-center font-sans font-bold text-[11px] leading-none border border-black dark:border-white text-black dark:text-white px-1.5 py-0.5 ml-0.5 bg-white dark:bg-slate-900">
                                  {qNum}
                                </span>
                              </span>
                            );
                          }
                          return <span key={index}>{part}</span>;
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 italic">No transcript available for this part.</div>
                )}
              </div>

              
              <div className="w-full md:w-1/2 bg-slate-50 dark:bg-slate-900 border-t md:border-t-0 flex flex-col relative">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                  <div className="max-w-3xl mx-auto pb-6">
                    <div className="mb-6 pb-4">
                      <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{test.notesTitle}</h1>
                      <p className="text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700 shadow-sm leading-relaxed">
                        Your answers have been checked. Correct answers are highlighted in green, and mistakes in red.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {renderQuestions()}
                    </div>
                  </div>
                </div>

                
                {isFullTest && (
                  <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <button
                        className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${currentPart === 1 ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-900 text-slate-100 shadow-sm"}`}
                        onClick={() => isFullTest && currentPart > 1 && setCurrentPart(p => p - 1)}
                        disabled={currentPart === 1}
                      >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                      </button>
                      <span className="font-bold text-slate-700 dark:text-slate-300">Part {currentPart}</span>
                      <button
                        className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${currentPart === 4 ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed" : "bg-slate-800 hover:bg-slate-900 text-slate-100 shadow-sm"}`}
                        onClick={() => isFullTest && currentPart < 4 && setCurrentPart(p => p + 1)}
                        disabled={currentPart === 4}
                      >
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    </div>
                    <button onClick={() => { setIsReviewMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-sm whitespace-nowrap">
                      Back to Results
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm mb-6">
                <div className={`px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between ${isFullTest ? 'bg-red-50 dark:bg-red-900/10' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Listening:{" "}
                    <span className="text-slate-900 dark:text-slate-100 normal-case">{test.title}</span>
                  </h2>
                </div>

                <div className="p-4 space-y-4 pt-4">
                  <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <div className="h-14 flex items-end gap-1">
                      {waveform.map((barHeight, index) => {
                        const barProgress = ((index + 1) / waveform.length) * 100;
                        const isActive = barProgress <= progressPercent;

                        return (
                          <span
                            key={index}
                            className={`flex-1 rounded-sm transition-colors ${isActive
                              ? "bg-primary"
                              : "bg-slate-300 dark:bg-slate-600"
                              }`}
                            style={{ height: `${barHeight}%` }}
                          />
                        );
                      })}
                    </div>

                    {isWaveformLoading ? (
                      <p className="mt-2 text-xs text-slate-500">Building waveform...</p>
                    ) : null}
                  </div>

                  {currentAudioUrl ? (
                    <audio ref={audioRef} src={currentAudioUrl} preload="metadata" className="hidden" />
                  ) : (
                    <p className="text-xs text-slate-500">
                      Audio URL is not set in API response (this is acceptable in fallback mode).
                    </p>
                  )}

                  {audioMessage ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{audioMessage}</p>
                  ) : null}

                  <p className="text-sm text-slate-600 dark:text-slate-400">{test.instruction}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6 sm:p-8">
                <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{test.notesTitle}</h1>
                    <span className="text-sm text-slate-500">
                      Answers: {answeredCount}/{test.questions.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {renderQuestions()}
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <h4 className="font-semibold mb-3">Attempt History</h4>
                {isHistoryLoading ? (
                  <p className="text-sm text-slate-500">Loading...</p>
                ) : history && history.length > 0 ? (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div key={item.id} className="text-sm flex justify-between gap-4">
                        <span className="truncate">{item.testTitle}</span>
                        <span className="text-slate-500">{item.scoreLabel}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No attempts yet.</p>
                )}
              </div>
              {isFullTest && (
                <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                  <div className="flex gap-4 overflow-x-auto slim-scrollbar items-center pb-2">
                    {[1, 2, 3, 4].map((partNum) => {
                      const isActive = currentPart === partNum;
                      const startQ = (partNum - 1) * 10 + 1;
                      return (
                        <button
                          key={partNum}
                          onClick={() => setCurrentPart(partNum)}
                          className={`flex-1 min-w-[220px] rounded-md border text-sm transition-colors flex items-center justify-center p-2.5 ${isActive
                            ? "border-red-200 bg-red-50 dark:bg-red-900/20 text-slate-900 dark:text-red-100 ring-1 ring-red-200 dark:ring-red-900/40"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900"
                            }`}
                        >
                          {isActive ? (
                            <div className="flex items-center gap-2">
                              <span className="font-bold whitespace-nowrap">Part {partNum}:</span>
                              <div className="flex gap-1 overflow-x-auto items-center">
                                {Array.from({ length: 10 }).map((_, i) => (
                                  <span key={i} className="w-5 h-5 flex items-center justify-center border border-slate-400 dark:border-slate-500 rounded-sm text-[10px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                    {startQ + i}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="font-bold">Part {partNum}: <span className="font-normal italic text-slate-500">10 questions</span></span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-center text-slate-500 italic mt-2 max-sm:hidden">Tip: Press F11 (Windows) or Ctrl+Cmd+F (Mac) to cycle between normal, focus, and fullscreen modes.</p>
                </div>
              )}
            </>
          )}
        </main>
      </TextHighlighter>

      {
        !isReviewMode && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 flex flex-col pointer-events-none">
            <footer className="border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] bg-slate-50 dark:bg-slate-800/80 pointer-events-auto backdrop-blur-sm">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                {isFullTest ? (
                  <div className="flex items-center gap-4">
                    <button
                      className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${!isFullTest || currentPart === 1
                        ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                        : "bg-slate-800 hover:bg-slate-900 text-slate-100 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm shadow-slate-900/20"
                        }`}
                      title="Previous Part"
                      onClick={() => isFullTest && currentPart > 1 && setCurrentPart(p => p - 1)}
                      disabled={!isFullTest || currentPart === 1}
                    >
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                    </button>
                    <button
                      className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${!isFullTest || currentPart === 4
                        ? "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                        : "bg-slate-800 hover:bg-slate-900 text-slate-100 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm shadow-slate-900/20"
                        }`}
                      title="Next Part"
                      onClick={() => isFullTest && currentPart < 4 && setCurrentPart(p => p + 1)}
                      disabled={!isFullTest || currentPart === 4}
                    >
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                ) : (
                  <div />
                )}

                <div className="flex flex-col items-end">
                  <button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 px-6 rounded-md shadow-md flex items-center transition-colors"
                  >
                    <span>{submitMutation.isPending ? "Submitting..." : "Submit Answers"}</span>
                    <span className="material-symbols-outlined ml-2 text-sm">send</span>
                  </button>
                  {submissionMessage && !submissionResult ? (
                    <p className="mt-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {submissionMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </footer>
          </div>
        )
      }

      
      {
        !hasStarted && !showRestorePrompt && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="bg-primary/10 dark:bg-primary/20 p-6 text-center border-b border-primary/20">
                <span className="material-symbols-outlined text-4xl text-primary mb-2">hotel_class</span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to Start?</h2>
                <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm">Choose how you want to take this test.</p>
              </div>
              <div className="p-6 space-y-4">
                <button
                  onClick={() => {
                    setTestMode("timed");
                    setHasStarted(true);
                  }}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">timer</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Real Test Simulation</h3>
                    <p className="text-sm text-slate-500 mt-1">Strict {Math.round(test.durationSeconds / 60)}-minute timer. Best for checking your actual band score progress.</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setTestMode("practice");
                    setHasStarted(true);
                  }}
                  className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-primary dark:border-slate-700 dark:hover:border-primary transition-colors group flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined">school</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Practice Mode</h3>
                    <p className="text-sm text-slate-500 mt-1">No time limit. Relax, listen carefully, and focus on accuracy and understanding.</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )
      }

      
      {
        submissionResult && submissionResult.detailedResults && !isReviewMode && (
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
              <div className="bg-slate-50 dark:bg-slate-800/80 p-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Test Complete</h2>
                  <div className="text-slate-500 mt-1 flex items-center gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, "0")} used
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${testMode === "timed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                      {testMode === "timed" ? "Timed Simulation" : "Practice Mode"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black text-primary scoreboard-font font-mono drop-shadow-sm">{submissionResult.scoreLabel}</div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mt-1">Final Score</div>
                </div>
              </div>

              <div className="p-0 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 shadow-sm border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-16 text-center">#</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-1/2">Your Answer</th>
                      <th className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300 w-1/2">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {submissionResult.detailedResults.map((res) => {
                      const qNumMatch = res.questionId.match(/\d+/);
                      const num = qNumMatch ? qNumMatch[0] : res.questionId;
                      return (
                        <tr key={res.questionId} className={`transition-colors ${res.isCorrect ? "bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/20" : "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"}`}>
                          <td className="py-3 px-4 text-center font-mono font-medium text-slate-500">{num}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`${res.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"} font-medium`}>
                                {res.userAnswer || <span className="text-slate-400 italic font-normal">blank</span>}
                              </span>
                              {res.isCorrect ? (
                                <span className="material-symbols-outlined text-green-500 text-[18px]">check_circle</span>
                              ) : (
                                <span className="material-symbols-outlined text-red-500 text-[18px]">cancel</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{res.correctAnswer}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 flex-wrap">
                <button
                  onClick={() => {
                    setSubmissionResult(null);
                    setHasStarted(false);
                    setElapsedSeconds(0);
                    setAnswers({});
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2 rounded-md font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={() => navigate("/tests/listening")}
                  className="px-5 py-2 rounded-md font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  Back to Library
                </button>
                <button
                  onClick={() => {
                    setIsReviewMode(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2 rounded-md font-medium bg-primary text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">plagiarism</span>
                  Review Answers
                </button>
              </div>
            </div>
          </div>
        )
      }

      
      {
        showExitConfirm && (
          <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800">
              
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-4xl text-amber-600 dark:text-amber-400">warning</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Leave this test?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your progress and timer will be <strong className="text-slate-700 dark:text-slate-300">permanently lost</strong>. You'll need to start from the beginning.
                </p>
              </div>

              
              <div className="px-6 pb-6 flex flex-col gap-2.5">
                <button
                  onClick={cancelLeave}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
                >
                  Continue Test
                </button>
                <button
                  onClick={confirmLeave}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200 dark:border-red-800/50"
                >
                  Leave & Discard Progress
                </button>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};

export default PracticeListening;
