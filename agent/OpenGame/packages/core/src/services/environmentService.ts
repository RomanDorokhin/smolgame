/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isCommandAvailable } from '../utils/shell-utils.js';

export interface DependencyReport {
  tool: string;
  available: boolean;
  version?: string;
  error?: string;
}

export class EnvironmentService {
  /**
   * Checks for common development tools and returns a report.
   */
  static async checkDependencies(): Promise<DependencyReport[]> {
    const tools = [
      'node',
      'npm',
      'yarn',
      'pnpm',
      'bun',
      'git',
      'docker',
      'podman',
    ];

    const reports: DependencyReport[] = [];

    for (const tool of tools) {
      const { available, error } = isCommandAvailable(tool);
      reports.push({
        tool,
        available,
        error: error?.message,
      });
    }

    return reports;
  }

  /**
   * Generates a markdown report of the environment dependencies.
   */
  static async getMarkdownReport(): Promise<string> {
    const reports = await this.checkDependencies();
    
    let report = '### System Dependencies Check\n\n';
    report += '| Tool | Status | Details |\n';
    report += '| :--- | :--- | :--- |\n';

    for (const r of reports) {
      const status = r.available ? '✅ Available' : '❌ Missing';
      const details = r.available ? '-' : (r.error || 'Not found in PATH');
      report += `| \`${r.tool}\` | ${status} | ${details} |\n`;
    }

    report += '\n> [!IMPORTANT]\n';
    report += '> If a tool is marked as "Missing", do NOT attempt to use it or its related commands (e.g., if `npm` is missing, do not try to run `npm install`). Use alternative tools if available.\n';

    return report;
  }
}
