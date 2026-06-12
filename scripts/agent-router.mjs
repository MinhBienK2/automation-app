#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const USAGE = `
\x1b[1m\x1b[36mAgent Workspace Router & Context Optimizer\x1b[0m
Automates task routing, limits token consumption, and enforces TDD/Docs requirements.

\x1b[1mUsage:\x1b[0m
  node scripts/agent-router.mjs [options]

\x1b[1mOptions:\x1b[0m
  --file <path>    Find and display the route details for a specific file.
  --diff           Automatically detect modified files using git and show unified routes.
  --query <text>   Search for routes by name or keyword.
  --check          Run vitest checks and typechecks for matched routes.
  --help           Show this help menu.
`;

// Color helper functions
const info = (msg) => `\x1b[36m${msg}\x1b[0m`;
const success = (msg) => `\x1b[32m\x1b[1m${msg}\x1b[0m`;
const warn = (msg) => `\x1b[33m\x1b[1m${msg}\x1b[0m`;
const error = (msg) => `\x1b[31m\x1b[1m${msg}\x1b[0m`;
const bold = (msg) => `\x1b[1m${msg}\x1b[0m`;

export function parseRoutes(markdownContent) {
  const lines = markdownContent.split('\n');
  const routes = [];
  let currentRoute = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('### ')) {
      if (currentRoute) {
        routes.push(currentRoute);
      }
      currentRoute = {
        name: line.replace('### ', '').trim(),
        read: [],
        verify: [],
        checks: []
      };
    } else if (currentRoute && line.startsWith('- ')) {
      const cleanLine = line.replace('- ', '').trim();
      if (cleanLine.startsWith('**Read**:')) {
        const paths = cleanLine.replace('**Read**:', '').split(',').map(p => p.trim());
        currentRoute.read = paths.map(p => {
          const cleanPath = p.replace(/\s*\(.*\)$/, '').replace(/`/g, '').trim();
          // If not starting with docs/ and not existing at root, assume under docs/
          if (fs.existsSync(cleanPath)) return cleanPath;
          const docsPath = path.join('docs', cleanPath);
          if (fs.existsSync(docsPath)) return docsPath;
          return cleanPath;
        });
      } else if (cleanLine.startsWith('**Verify**:')) {
        const paths = cleanLine.replace('**Verify**:', '').split(',').map(p => p.trim().replace(/\s*\(.*\)$/, '').replace(/`/g, '').trim());
        currentRoute.verify = paths;
      } else if (cleanLine.startsWith('**Checks**:')) {
        currentRoute.checks = cleanLine.replace('**Checks**:', '').split(',').map(p => p.trim().replace(/`/g, ''));
      } else if (cleanLine.startsWith('**E2E commands**:')) {
        currentRoute.e2e = cleanLine.replace('**E2E commands**:', '').split(',').map(p => p.trim().replace(/`/g, ''));
      }
    }
  }
  if (currentRoute) {
    routes.push(currentRoute);
  }
  return routes;
}

export function findRouteForFile(filePath, routes) {
  const normPath = path.normalize(filePath).replace(/\\/g, '/');
  
  let bestRoute = null;
  let bestMatchScore = 0; // 3 = exact verify, 2 = prefix verify, 1 = read match

  for (const route of routes) {
    // Check verify paths
    for (const v of route.verify) {
      const normV = path.normalize(v).replace(/\\/g, '/');
      if (normPath === normV) {
        return { route, score: 3 };
      }
      // If v is a directory (e.g. src/features/evidence/), check if file starts with it
      if (normPath.startsWith(normV)) {
        if (bestMatchScore < 2) {
          bestRoute = route;
          bestMatchScore = 2;
        }
      }
    }

    // Check read paths as fallback
    for (const r of route.read) {
      const normR = path.normalize(r).replace(/\\/g, '/');
      if (normPath === normR || normPath.startsWith(normR)) {
        if (bestMatchScore < 1) {
          bestRoute = route;
          bestMatchScore = 1;
        }
      }
    }
  }

  return bestRoute ? { route: bestRoute, score: bestMatchScore } : null;
}

function getGitStatusFiles() {
  try {
    const stdout = execSync('git status --porcelain', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    return stdout.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.match(/^(\S+)\s+(.+)$/);
        if (parts) {
          let filePath = parts[2];
          if (filePath.startsWith('"') && filePath.endsWith('"')) {
            filePath = filePath.substring(1, filePath.length - 1);
          }
          return { status: parts[1], path: filePath };
        }
        return null;
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function printRoute(route, matchingFiles = []) {
  console.log(`\n================================================================================`);
  console.log(`${bold('ROUTE MATCHED:')} ${success(route.name)}`);
  if (matchingFiles.length > 0) {
    console.log(`${bold('Reason (Affected Files):')}`);
    matchingFiles.forEach(f => console.log(`  - \x1b[90m[${f.status || 'FILE'}]\x1b[0m ${f.path}`));
  }
  console.log(`================================================================================`);

  console.log(`\n${bold(info('1. DOCUMENTATION TO READ (Open these files to review invariants):'))}`);
  route.read.forEach(p => console.log(`  - ${path.normalize(p)}`));

  if (route.verify.length > 0) {
    console.log(`\n${bold(info('2. FILE BOUNDARIES TO VERIFY & MODIFY:'))}`);
    route.verify.forEach(p => console.log(`  - ${path.normalize(p)}`));
  }

  if (route.checks.length > 0) {
    console.log(`\n${bold(info('3. VERIFICATION CHECKS TO RUN:'))}`);
    route.checks.forEach(c => console.log(`  - ${c}`));
  }

  // TDD Alert Logic
  console.log(`\n${bold(info('4. TDD COMPLIANCE CHECKS:'))}`);
  const hasTestsChanged = matchingFiles.some(f => 
    f.path.includes('.test.') || f.path.includes('.spec.') || f.path.startsWith('tests/')
  );

  const hasSourceChanged = matchingFiles.some(f => 
    !f.path.includes('.test.') && !f.path.includes('.spec.') && 
    (f.path.startsWith('src/') || f.path.startsWith('electron/'))
  );

  if (hasSourceChanged && !hasTestsChanged) {
    console.log(`  ${warn('[WARNING] TDD Violation Danger!')}`);
    console.log(`  You have modified source files but no test files were added/modified in git.`);
    console.log(`  TDD Rule: You MUST write a failing test BEFORE adding production code.`);
  } else if (hasTestsChanged) {
    console.log(`  ${success('[OK]')} Test file modifications detected. Ensure you ran the test failing first!`);
  } else {
    console.log(`  No code files changed. TDD checks not triggered.`);
  }
  console.log(`================================================================================\n`);
}

function runChecksForRoutes(matchedRoutes) {
  if (matchedRoutes.size === 0) {
    console.log(warn('No matched routes to check.'));
    return;
  }

  console.log(bold('\nRunning verification checks...'));

  // Run TypeScript check
  console.log(info('\nStep 1: Running TypeScript Compiler Check...'));
  try {
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log(success('TypeScript compilation check passed!'));
  } catch (err) {
    console.error(error('TypeScript compiler check failed. Please fix compile errors.'));
    process.exit(1);
  }

  // Run Vitest checks
  const testCmds = new Set();
  for (const route of matchedRoutes) {
    route.checks.forEach(c => {
      if (c.startsWith('npm test --') || c.startsWith('npm run test --')) {
        testCmds.add(c);
      }
    });
  }

  if (testCmds.size > 0) {
    console.log(info('\nStep 2: Running Unit/Integration Tests...'));
    for (const cmd of testCmds) {
      console.log(bold(`Running: ${cmd}`));
      try {
        execSync(cmd, { stdio: 'inherit' });
        console.log(success(`Test command succeeded: ${cmd}`));
      } catch (err) {
        console.error(error(`Test command failed: ${cmd}`));
        process.exit(1);
      }
    }
  } else {
    console.log(warn('\nNo specific Vitest command found for these routes. Running full test suite...'));
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log(success('Full test suite passed!'));
    } catch (err) {
      console.error(error('Full test suite failed.'));
      process.exit(1);
    }
  }
}

// MAIN FUNCTION
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  // Load task routes
  const routesPath = path.resolve('docs/task-routes.md');
  if (!fs.existsSync(routesPath)) {
    console.error(error(`Error: Cannot find docs/task-routes.md at ${routesPath}`));
    process.exit(1);
  }
  const routesContent = fs.readFileSync(routesPath, 'utf-8');
  const routes = parseRoutes(routesContent);

  if (args.includes('--file')) {
    const fileIndex = args.indexOf('--file') + 1;
    const filePath = args[fileIndex];
    if (!filePath) {
      console.error(error('Error: Please specify a file path after --file.'));
      process.exit(1);
    }
    const match = findRouteForFile(filePath, routes);
    if (match) {
      printRoute(match.route, [{ status: 'TARGET', path: filePath }]);
      
      if (args.includes('--check')) {
        runChecksForRoutes(new Set([match.route]));
      }
    } else {
      console.log(warn(`No matching route found for file: ${filePath}. Defaulting to 'Fix A Bug' or 'Refactor A Module' route.`));
      const fallback = routes.find(r => r.name.toLowerCase().includes('fix a bug') || r.name.toLowerCase().includes('refactor'));
      if (fallback) {
        printRoute(fallback, [{ status: 'FALLBACK', path: filePath }]);
      }
    }
    process.exit(0);
  }

  if (args.includes('--diff')) {
    const gitFiles = getGitStatusFiles();
    if (gitFiles.length === 0) {
      console.log(success('No modified or untracked files detected in git repository. Workspace is clean.'));
      process.exit(0);
    }

    const matchedRoutes = new Map(); // route.name -> { route, files: [] }
    
    for (const f of gitFiles) {
      const match = findRouteForFile(f.path, routes);
      if (match) {
        if (!matchedRoutes.has(match.route.name)) {
          matchedRoutes.set(match.route.name, { route: match.route, files: [] });
        }
        matchedRoutes.get(match.route.name).files.push(f);
      }
    }

    if (matchedRoutes.size === 0) {
      console.log(warn('Modified files detected, but none matched a specific route. Using fallback.'));
      const fallback = routes.find(r => r.name.toLowerCase().includes('fix a bug'));
      if (fallback) {
        printRoute(fallback, gitFiles);
        if (args.includes('--check')) {
          runChecksForRoutes(new Set([fallback]));
        }
      }
    } else {
      const uniqueRoutes = new Set();
      for (const [_, item] of matchedRoutes) {
        printRoute(item.route, item.files);
        uniqueRoutes.add(item.route);
      }

      if (args.includes('--check')) {
        runChecksForRoutes(uniqueRoutes);
      }
    }
    process.exit(0);
  }

  if (args.includes('--query')) {
    const queryIndex = args.indexOf('--query') + 1;
    const queryText = args[queryIndex];
    if (!queryText) {
      console.error(error('Error: Please specify query text.'));
      process.exit(1);
    }
    const matches = routes.filter(r => 
      r.name.toLowerCase().includes(queryText.toLowerCase()) ||
      r.read.some(p => p.toLowerCase().includes(queryText.toLowerCase())) ||
      r.verify.some(p => p.toLowerCase().includes(queryText.toLowerCase()))
    );

    if (matches.length === 0) {
      console.log(warn(`No routes match query: "${queryText}"`));
    } else {
      console.log(success(`Found ${matches.length} matching routes:`));
      matches.forEach(r => printRoute(r));
    }
    process.exit(0);
  }

  console.log(USAGE);
}

// Only run main if file executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('agent-router.mjs')) {
  main();
}
