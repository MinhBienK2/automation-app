#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';

async function processLog() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  let inStackTrace = false;
  let skippedStackTraceCount = 0;
  let inPassedGroup = false;
  let passedCount = 0;

  for await (const line of rl) {
    const trimmed = line.trim();

    // 1. Condense passed unit tests to avoid verbose success logs
    if (trimmed.startsWith('✓') || trimmed.includes('✓')) {
      passedCount++;
      inPassedGroup = true;
      continue;
    } else if (inPassedGroup && trimmed !== '') {
      // Print a summary of passed tests before showing other lines
      if (passedCount > 0) {
        console.log(`  ✓ ${passedCount} tests passed (condensed)`);
        passedCount = 0;
      }
      inPassedGroup = false;
    }

    // 2. Identify and prune library stack traces (node_modules)
    if (trimmed.startsWith('at ') && (trimmed.includes('node_modules') || trimmed.includes('node:internal'))) {
      if (!inStackTrace) {
        inStackTrace = true;
        skippedStackTraceCount = 1;
      } else {
        skippedStackTraceCount++;
      }
      continue;
    }

    if (inStackTrace && (!trimmed.startsWith('at ') || !(trimmed.includes('node_modules') || trimmed.includes('node:internal')))) {
      if (skippedStackTraceCount > 0) {
        console.log(`      ... skipped ${skippedStackTraceCount} internal stack frames`);
      }
      inStackTrace = false;
      skippedStackTraceCount = 0;
    }

    // Print standard line
    console.log(line);
  }

  // Final flush of remaining summaries
  if (passedCount > 0) {
    console.log(`  ✓ ${passedCount} tests passed (condensed)`);
  }
  if (skippedStackTraceCount > 0) {
    console.log(`      ... skipped ${skippedStackTraceCount} internal stack frames`);
  }
}

processLog().catch(err => {
  console.error('Error in context-shrinker:', err);
  process.exit(1);
});
