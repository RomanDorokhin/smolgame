import { describe, it, expect } from 'vitest';
import {
  INTERVIEW_QUESTIONS,
  getFilledFields,
  getProgressPercentage,
  isGameSpecComplete,
  getNextQuestion,
  buildGamePrompt,
} from './interviewFlow';
import type { GameSpec } from './types';

describe('Interview Flow', () => {
  describe('getFilledFields', () => {
    it('should return empty array for empty GameSpec', () => {
      const spec: GameSpec = {};
      expect(getFilledFields(spec)).toEqual([]);
    });

    it('should return filled fields', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap to match',
      };
      const filled = getFilledFields(spec);
      expect(filled).toContain('genre');
      expect(filled).toContain('mechanics');
      expect(filled.length).toBe(2);
    });

    it('should ignore empty strings', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: '',
        visuals: '  ',
      };
      const filled = getFilledFields(spec);
      expect(filled).toEqual(['genre']);
    });
  });

  describe('getProgressPercentage', () => {
    it('should return 0 for empty GameSpec', () => {
      const spec: GameSpec = {};
      expect(getProgressPercentage(spec)).toBe(0);
    });

    it('should return 100 for complete GameSpec', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap',
        visuals: 'pixel',
        audience: 'kids',
        story: 'collect gems',
        progression: 'harder',
        special_features: 'power-ups',
      };
      expect(getProgressPercentage(spec)).toBe(100);
    });

    it('should calculate percentage correctly', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap',
      };
      const progress = getProgressPercentage(spec);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });

  describe('isGameSpecComplete', () => {
    it('should return false for empty GameSpec', () => {
      const spec: GameSpec = {};
      expect(isGameSpecComplete(spec)).toBe(false);
    });

    it('should return true for complete GameSpec', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap',
        visuals: 'pixel',
        audience: 'kids',
        story: 'collect gems',
        progression: 'harder',
        special_features: 'power-ups',
      };
      expect(isGameSpecComplete(spec)).toBe(true);
    });

    it('should return false if any field is missing', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap',
        visuals: 'pixel',
        audience: 'kids',
        story: 'collect gems',
        progression: 'harder',
        // missing special_features
      };
      expect(isGameSpecComplete(spec)).toBe(false);
    });
  });

  describe('getNextQuestion', () => {
    it('should return first question for empty GameSpec', () => {
      const spec: GameSpec = {};
      const nextQ = getNextQuestion(spec);
      expect(nextQ).not.toBeNull();
      expect(nextQ?.field).toBe('genre');
    });

    it('should return next unanswered question', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
      };
      const nextQ = getNextQuestion(spec);
      expect(nextQ).not.toBeNull();
      expect(nextQ?.field).toBe('mechanics');
    });

    it('should return null when all questions answered', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap',
        visuals: 'pixel',
        audience: 'kids',
        story: 'collect gems',
        progression: 'harder',
        special_features: 'power-ups',
      };
      const nextQ = getNextQuestion(spec);
      expect(nextQ).toBeNull();
    });
  });

  describe('buildGamePrompt', () => {
    it('should include all technical requirements', () => {
      const spec: GameSpec = {
        genre: 'puzzle',
        mechanics: 'tap to match',
        visuals: 'colorful',
        audience: 'kids',
        story: 'save the kingdom',
        progression: 'increasing difficulty',
        special_features: 'power-ups',
      };
      const prompt = buildGamePrompt(spec);

      // Check for key technical requirements
      expect(prompt).toContain('static HTML/CSS/JS');
      expect(prompt).toContain('iframe');
      expect(prompt).toContain('Touch controls');
      expect(prompt).toContain('Portrait');
      expect(prompt).toContain('localStorage');
      expect(prompt).toContain('Game Over');
      expect(prompt).toContain('Pause');
      expect(prompt).toContain('44x44px');
      expect(prompt).toContain('16px');
    });

    it('should include GameSpec details', () => {
      const spec: GameSpec = {
        genre: 'action',
        mechanics: 'swipe to move',
      };
      const prompt = buildGamePrompt(spec);

      expect(prompt).toContain('action');
      expect(prompt).toContain('swipe to move');
    });

    it('should handle empty GameSpec', () => {
      const spec: GameSpec = {};
      const prompt = buildGamePrompt(spec);

      // Should still include technical requirements
      expect(prompt).toContain('TECHNICAL REQUIREMENTS');
      expect(prompt).toContain('Not specified');
    });
  });

  describe('INTERVIEW_QUESTIONS', () => {
    it('should have 7 questions', () => {
      expect(INTERVIEW_QUESTIONS.length).toBe(7);
    });

    it('should have unique field mappings', () => {
      const fields = INTERVIEW_QUESTIONS.map((q) => q.field);
      const uniqueFields = new Set(fields);
      expect(uniqueFields.size).toBe(fields.length);
    });

    it('should cover all GameSpec fields', () => {
      const specFields: (keyof GameSpec)[] = [
        'genre',
        'mechanics',
        'visuals',
        'audience',
        'story',
        'progression',
        'special_features',
      ];
      const questionFields = INTERVIEW_QUESTIONS.map((q) => q.field);

      specFields.forEach((field) => {
        expect(questionFields).toContain(field);
      });
    });
  });
});
