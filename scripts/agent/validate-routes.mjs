#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parseRoutes } from './agent-router.mjs';

const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_YELLOW = '\x1b[33m';
const COLOR_CYAN = '\x1b[36m';
const COLOR_RESET = '\x1b[0m';

function getSubdirectories(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(file => fs.statSync(path.join(dirPath, file)).isDirectory());
}

function normalizePath(p) {
  return path.normalize(p).replace(/\\/g, '/').replace(/\/$/, '');
}

function main() {
  console.log(`${COLOR_CYAN}Starting Route Validation...${COLOR_RESET}`);

  const routesPath = path.resolve('docs/task-routes.md');
  if (!fs.existsSync(routesPath)) {
    console.error(`${COLOR_RED}Error: docs/task-routes.md not found!${COLOR_RESET}`);
    process.exit(1);
  }

  const routesContent = fs.readFileSync(routesPath, 'utf-8');
  const routes = parseRoutes(routesContent);

  // Collect all verify paths normalized
  const verifyPaths = [];
  routes.forEach(route => {
    route.verify.forEach(v => {
      verifyPaths.push({
        raw: v,
        normalized: normalizePath(v),
        routeName: route.name
      });
    });
  });

  const missingDirectories = [];

  // 1. Check src/features/
  const featuresDir = path.resolve('src/features');
  const features = getSubdirectories(featuresDir);
  console.log(`Checking ${features.length} frontend features...`);
  features.forEach(feature => {
    const targetPath = normalizePath(`src/features/${feature}`);
    const isMapped = verifyPaths.some(vp => 
      targetPath === vp.normalized || targetPath.startsWith(vp.normalized) || vp.normalized.startsWith(targetPath)
    );
    if (!isMapped) {
      missingDirectories.push(`src/features/${feature}`);
    }
  });

  // 2. Check electron/backend/
  const backendDir = path.resolve('electron/backend');
  const backendModules = getSubdirectories(backendDir);
  console.log(`Checking ${backendModules.length} backend modules...`);
  backendModules.forEach(module => {
    // Ignore shared or standard node helper directories if needed, but check them generally
    if (module === 'shared') return; // shared folder is a helper
    const targetPath = normalizePath(`electron/backend/${module}`);
    const isMapped = verifyPaths.some(vp => 
      targetPath === vp.normalized || targetPath.startsWith(vp.normalized) || vp.normalized.startsWith(targetPath)
    );
    if (!isMapped) {
      missingDirectories.push(`electron/backend/${module}`);
    }
  });

  if (missingDirectories.length > 0) {
    console.error(`\n${COLOR_RED}Validation FAILED! The following directories have no matching route in docs/task-routes.md:${COLOR_RESET}`);
    missingDirectories.forEach(dir => console.error(`  - ${COLOR_YELLOW}${dir}${COLOR_RESET}`));
    console.error(`\n${COLOR_CYAN}Please add these directories to the appropriate "**Verify**" section in docs/task-routes.md.${COLOR_RESET}`);
    process.exit(1);
  }

  console.log(`\n${COLOR_GREEN}Validation PASSED! All core features and modules are mapped in task-routes.md.${COLOR_RESET}`);
  process.exit(0);
}

main();
