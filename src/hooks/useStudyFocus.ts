import { useState } from 'react';

export type StudyFocus = 'auto' | 'review' | 'corrections' | 'structures';

export const STUDY_FOCUS_OPTIONS: Array<{ id: StudyFocus; label: string }> = [
  { id: 'auto', label: 'Use signals' },
  { id: 'review', label: 'Repertoire review' },
  { id: 'corrections', label: 'Game corrections' },
  { id: 'structures', label: 'Structures' },
];

const STORAGE_KEY = 'tabiya.study-focus.v1';

function readFocus(): StudyFocus {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return STUDY_FOCUS_OPTIONS.some((option) => option.id === stored) ? (stored as StudyFocus) : 'auto';
}

export function useStudyFocus(): [StudyFocus, (focus: StudyFocus) => void] {
  const [focus, setFocusState] = useState<StudyFocus>(readFocus);
  const setFocus = (next: StudyFocus): void => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setFocusState(next);
  };
  return [focus, setFocus];
}

