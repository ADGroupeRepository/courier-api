import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper script to automatically scaffold new agent skills inside the workspace
function main() {
  const args = process.argv.slice(2);
  const params = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith('--')) {
        params[key] = val;
        i++;
      } else {
        params[key] = true;
      }
    }
  }

  const name = params.name;
  const description = params.description;

  if (!name || !description) {
    console.error('Usage: node scaffold-skill.js --name "<skill-name>" --description "<description>" [--script "<script-name>"]');
    process.exit(1);
  }

  // Normalize name to kebab-case
  const skillId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const skillsDir = path.resolve(__dirname, '..', '..');
  const targetSkillDir = path.join(skillsDir, skillId);
  const targetSkillFile = path.join(targetSkillDir, 'SKILL.md');

  if (fs.existsSync(targetSkillDir)) {
    console.error(`Error: Skill directory ${skillId} already exists at ${targetSkillDir}`);
    process.exit(1);
  }

  fs.mkdirSync(targetSkillDir, { recursive: true });

  const skillContent = `---
name: ${skillId}
description: ${description}
---

# ${name}

Describe the purpose, trigger conditions, and instructions for the ${name} skill here.

## How to Use
Detail the specific commands, scripts, or behaviors expected.

## Supporting Scripts
If there are scripts under this skill, document them below.
`;

  fs.writeFileSync(targetSkillFile, skillContent, 'utf8');
  console.log(`Successfully created new skill structure:`);
  console.log(`- Folder: .agents/skills/${skillId}`);
  console.log(`- Manifest: .agents/skills/${skillId}/SKILL.md`);

  // Optionally scaffold a script file
  if (params.script) {
    const scriptName = params.script.endsWith('.js') ? params.script : `${params.script}.js`;
    const scriptDir = path.join(targetSkillDir, 'scripts');
    fs.mkdirSync(scriptDir, { recursive: true });
    
    const scriptPath = path.join(scriptDir, scriptName);
    const scriptContent = `/**
 * Helper script for ${name}
 */
console.log('Running script for ${name}...');
`;
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    console.log(`- Script: .agents/skills/${skillId}/scripts/${scriptName}`);
  }

  // Update index
  const selfImprovementDir = path.resolve(__dirname, '..');
  const indexFile = path.join(selfImprovementDir, 'INDEX.md');
  const date = new Date().toISOString().split('T')[0];
  const newEntry = `| [${name}](file:///d:/Projects/Backend/bara-api/.agents/skills/${skillId}/SKILL.md) | \`${skillId}\` | ${description} | ${date} |\n`;

  if (fs.existsSync(indexFile)) {
    fs.appendFileSync(indexFile, newEntry, 'utf8');
  } else {
    const initialIndexContent = `# Workspace Generated Skills & Scripts Index

This index tracks custom helper scripts and agent skills generated to automate, support, or document the workspace.

| Skill / Script Name | Folder Identifier | Description | Date Created |
| --- | --- | --- | --- |
${newEntry}`;
    fs.writeFileSync(indexFile, initialIndexContent, 'utf8');
  }
  console.log(`Updated INDEX.md at .agents/skills/agent-self-improvement/INDEX.md`);
}

main();
