#!/usr/bin/env node
// PreToolUse hook for the Bash tool. Blocks the few commands that
// permission globs in .claude/settings.json cannot reliably catch:
//   1. printing secret files (.env and friends) or the whole environment;
//   2. force-pushes, remote branch deletion, and any push that targets main.
// Exit code 2 blocks the call and shows stderr to Claude. Dependency-free.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// `.env`, `.env.local`, `.env.production`, ... but not `.env.example`.
const ENV_FILE = /(^|[\s'"=/<>|;&(])\.env(?!\.example\b)(\.[\w.-]+)?(?=$|[\s'"|;&)<>])/;
const SECRET_PATH = /([\w-]\.(pem|p12|pfx)|\bid_(rsa|ed25519)|service[-_]?account[\w.-]*\.json|\.credentials\.json)(?=$|[\s'"|;&)<>])/i;
const DUMP_ENV = /(^|[|;&]\s*|\b(?:sudo|exec)\s+)(printenv|env|export -p|set)\s*($|[|;&>])/;
const GIT_PUSH = /^(?:\S+=\S*\s+)*git(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+push\b/;

function pushSegments(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((part) => part.trim())
    .filter((part) => GIT_PUSH.test(part));
}

// Returns a block reason for one `git push ...` segment, or null.
// `currentBranch` is consulted only when no refspec is given, because a bare
// `git push` / `git push origin` pushes the checked-out branch.
function checkPush(segment, currentBranch) {
  const args = segment.slice(segment.search(/\bpush\b/) + 4).trim().split(/\s+/).filter(Boolean);
  const positional = [];
  for (const arg of args) {
    if (/^(--force|--force-with-lease|--force-if-includes|--mirror|--delete|--prune)(=|$)/.test(arg) || /^-[a-zA-Z]*[fd][a-zA-Z]*$/.test(arg)) {
      return `blocked \`git push ${arg}\`: force-push, mirror and remote branch deletion are never allowed (CLAUDE.md §4).`;
    }
    if (arg.startsWith('-')) continue;
    positional.push(arg);
    if (arg.startsWith('+')) return `blocked forced refspec \`${arg}\` (CLAUDE.md §4).`;
    if (arg.startsWith(':')) return `blocked delete refspec \`${arg}\` (CLAUDE.md §4).`;
  }
  const refspecs = positional.slice(1);
  const targets = refspecs.length ? refspecs.map((ref) => ref.split(':').pop()) : [currentBranch?.()];
  if (targets.some((target) => /^(refs\/heads\/)?main$/.test(target ?? ''))) {
    return 'blocked push to `main`: work on a feature branch and open a Draft PR (CLAUDE.md §6).';
  }
  return null;
}

export function evaluate(command, currentBranch = () => null) {
  if (typeof command !== 'string' || command.trim() === '') return null;
  if (ENV_FILE.test(command)) {
    return 'blocked: the command references a .env file. Secret values must never be read or printed (CLAUDE.md §4.5). Use .env.example for variable names.';
  }
  if (SECRET_PATH.test(command)) {
    return 'blocked: the command references a key/credential file (CLAUDE.md §4.5).';
  }
  if (DUMP_ENV.test(command)) {
    return 'blocked: dumping the whole environment can expose secrets (CLAUDE.md §4.5). Print a single non-secret variable instead.';
  }
  for (const segment of pushSegments(command)) {
    const reason = checkPush(segment, currentBranch);
    if (reason) return reason;
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return; // Not a hook payload; never block on parse errors.
  }
  const currentBranch = () => {
    try {
      return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: input?.cwd || process.cwd(), encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  };
  const reason = evaluate(input?.tool_input?.command, currentBranch);
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
