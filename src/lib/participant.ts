/**
 * Participant Session Identification & Name Management
 * Non-invasive, browser-scoped persistent identifier for duplicate voting prevention.
 */

const PARTICIPANT_KEY = 'campus_vote_participant_id';
const PARTICIPANT_NAME_KEY = 'campus_vote_participant_name';
const VOTED_POLLS_KEY = 'campus_vote_voted_polls';

export function getParticipantId(): string {
  let id = localStorage.getItem(PARTICIPANT_KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(PARTICIPANT_KEY, id);
  }
  return id;
}

export function getParticipantName(): string {
  return localStorage.getItem(PARTICIPANT_NAME_KEY) || '';
}

export function saveParticipantName(name: string): void {
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(PARTICIPANT_NAME_KEY, trimmed);
  }
}

export interface LocalVoteRecord {
  votedAt: string;
  choiceSummary: string;
  selectedOptionId?: string;
  points?: number;
  isCorrect?: boolean;
  participantName?: string;
  responseTimeMs?: number;
}

export function recordLocalVote(
  pollId: string,
  choiceSummary: string,
  extra?: {
    selectedOptionId?: string;
    points?: number;
    isCorrect?: boolean;
    participantName?: string;
    responseTimeMs?: number;
  }
): void {
  try {
    const raw = localStorage.getItem(VOTED_POLLS_KEY);
    const map: Record<string, LocalVoteRecord> = raw ? JSON.parse(raw) : {};
    map[pollId] = {
      votedAt: new Date().toISOString(),
      choiceSummary,
      ...extra,
    };
    localStorage.setItem(VOTED_POLLS_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Error saving local vote record', err);
  }
}

export function getLocalVoteRecord(pollId: string): LocalVoteRecord | null {
  try {
    const raw = localStorage.getItem(VOTED_POLLS_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[pollId] || null;
  } catch {
    return null;
  }
}
