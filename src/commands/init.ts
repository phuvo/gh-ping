import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { getGlobalConfigDir } from '../utils/paths.js';

/**
 * Get the path to the example config file bundled with the package
 */
function getExampleConfigPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // From dist/commands/init.js -> project root
  return join(__dirname, '..', '..', 'config.example.js');
}

/**
 * Read the example config template
 */
function getConfigTemplate(): string {
  const examplePath = getExampleConfigPath();
  return readFileSync(examplePath, 'utf8');
}

interface InitOptions {
  force?: boolean;
  local?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  // Determine target path
  const targetPath = options.local
    ? join(process.cwd(), 'gh-ping.config.js')
    : join(getGlobalConfigDir(), 'config.js');

  // Check if file exists
  if (existsSync(targetPath) && !options.force) {
    console.error(chalk.red('✖ Config file already exists:'), targetPath);
    console.error(chalk.gray('  Use --force to overwrite'));
    process.exit(1);
  }

  // Create directory if needed
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write config file
  const template = getConfigTemplate();
  writeFileSync(targetPath, template, 'utf8');

  console.log(chalk.green('✔ Config file created:'), targetPath);
  console.log();
  console.log('Next steps:');
  console.log(chalk.gray('  1. Edit the config file to customize filters'));
  console.log(chalk.gray('  2. Run'), chalk.cyan('gh-ping test'), chalk.gray('to verify setup'));
  console.log(chalk.gray('  3. Run'), chalk.cyan('gh-ping start'), chalk.gray('to start the daemon'));
}
