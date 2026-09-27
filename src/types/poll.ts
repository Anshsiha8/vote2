export type PollType = 'yes_no' | 'multiple_choice' | 'rating' | 'quiz';

export type PollStatus = 'draft' | 'active' | 'closed';

export type QuizState = 'lobby' | 'countdown' | 'active' | 'question_ended' | 'completed';

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  option_order: number;
}

export interface QuizQuestion {
  id: string;
  poll_id: string;
  question_text: string;
  options: PollOption[];
  correct_option_id?: string | null;
  time_limit_seconds: number;
  question_order: number;
}

export interface Poll {
  id: string;
  title: string;
  question: string;
  type: PollType;
  status: PollStatus;
  join_code: string;
  created_at: string;
  options?: PollOption[];
  correct_option_id?: string | null;
  quiz_started_at?: string | null;
  time_limit_seconds?: number;
  // Multi-question quiz support:
  questions?: QuizQuestion[];
  current_question_index?: number;
  quiz_state?: QuizState;
  countdown_end_at?: string | null;
  question_started_at?: string | null;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  question_id?: string | null;
  question_index?: number | null;
  option_id?: string | null;
  rating_value?: number | null;
  participant_id: string;
  participant_name?: string | null;
  response_time_ms?: number | null;
  points?: number | null;
  is_correct?: boolean | null;
  created_at: string;
}

export interface OptionResult {
  id: string;
  text: string;
  order: number;
  count: number;
  percentage: number;
  isCorrect?: boolean;
}

export interface RatingBreakdown {
  rating: number; // 1 to 5
  count: number;
  percentage: number;
}

export interface QuizLeaderboardEntry {
  rank: number;
  participantId: string;
  participantName: string;
  points: number; // cumulative total points across all questions
  responseTimeMs: number;
  isCorrect: boolean;
  selectedOptionText?: string;
  answeredAt: string;
  questionsAnswered?: number;
}

export interface PodiumEntry {
  rank: number;
  participantId?: string;
  participantName: string;
  points: number;
  isCorrect?: boolean;
}

export interface PollResults {
  poll: Poll;
  totalResponses: number;
  options: OptionResult[];
  averageRating?: number;
  ratingBreakdown?: RatingBreakdown[];
  leaderboard?: QuizLeaderboardEntry[];
  topThree?: PodiumEntry[];
  totalQuizParticipants?: number;
  currentQuestionIndex?: number;
  totalQuestions?: number;
}
