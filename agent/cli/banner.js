import chalk from 'chalk';

const ART = `
   █████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗  ██╗
  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝╚██╗██╔╝
  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    ╚███╔╝
  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║    ██╔██╗
  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██╔╝ ██╗
  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝`;

export function printBanner() {
  console.log(chalk.cyan(ART));
  console.log(chalk.gray('  autonomous on-chain agents · base sepolia'));
  console.log();
}

export function section(title) {
  console.log(chalk.bold.cyan(`\n  ${title}`));
  console.log(chalk.gray(`  ${'─'.repeat(title.length)}\n`));
}

export const ok    = msg => console.log(chalk.green('  ✓ ') + msg);
export const warn  = msg => console.log(chalk.yellow('  ⚠ ') + msg);
export const info  = msg => console.log(chalk.blue('  → ') + msg);
export const err   = msg => console.log(chalk.red('  ✗ ') + msg);
export const dim   = msg => console.log(chalk.gray('    ' + msg));
