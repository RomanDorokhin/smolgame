/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sanitizes LLM output intended for file content.
 * Handles common hallucinations like wrapping code in markdown blocks
 * or including conversational filler.
 */
export function sanitizeFileContent(content: string): string {
  let sanitized = content.trim();

  // 1. Check for triple backtick wrapping
  // Pattern: ```language\n(code)\n```
  const codeBlockRegex = /^```(?:\w+)?\n([\s\S]*?)\n```$/;
  const match = sanitized.match(codeBlockRegex);
  if (match) {
    sanitized = match[1];
  }

  // 2. Remove common conversational markers if they appear at the very beginning
  const conversationalMarkers = [
    /^Here is the (?:updated |corrected |complete )?code:\n/i,
    /^Certainly! Here is the code:\n/i,
    /^I have updated the file as requested:\n/i,
    /^Sure, here is the implementation:\n/i,
  ];

  for (const marker of conversationalMarkers) {
    if (marker.test(sanitized)) {
      sanitized = sanitized.replace(marker, '').trim();
    }
  }

  return sanitized;
}

/**
 * Checks if the content likely contains "slop" (conversational text mixed with code).
 * Returns a warning message if detected, or null otherwise.
 */
export function detectOutputSlop(content: string): string | null {
  const conversationalKeywords = [
    'i hope this helps',
    'let me know if',
    'as requested',
    'i have updated',
    'here is the',
  ];

  const lowerContent = content.toLowerCase();
  const lineCount = content.split('\n').length;
  
  // If a small file contains many conversational keywords, it's likely slop
  const keywordCount = conversationalKeywords.filter(k => lowerContent.includes(k)).length;
  
  if (keywordCount >= 2 && lineCount < 20) {
    return 'Warning: Output content contains conversational markers. Ensure it only contains code.';
  }

  return null;
}
