---
name: agent-self-improvement
description: Create helper scripts, automate repetitive tasks, or scaffold custom workspace skills to continuously improve capabilities and project understanding.
---

# Agent Self-Improvement and Workspace Autotuning

This skill enables the agent to dynamically improve its capabilities, automate manual tasks, and capture project context by generating custom scripts and new workspace skills.

## Guidelines

Whenever you notice a repetitive task, a complex series of commands, or undocumented project-specific setup/flows, you should proactively create helper scripts or new custom skills.

### 1. Identify Opportunities for Improvement

Look for:

- Repetitive data seeding, database setup, or Docker commands.
- Complex log viewing, API endpoint testing, or token generation scripts.
- Code generation needs or template scaffolding.
- Project-specific code checks, linting, or validations.

### 2. Scaffold a New Helper Script or Skill

You can use the helper script `scaffold-skill.js` to initialize a new workspace skill or helper script.
To run the scaffolder:
`node .agents/skills/agent-self-improvement/scripts/scaffold-skill.js --name "<skill-name>" --description "<description>"`

Alternatively, manually create:

- `.agents/skills/<skill-name>/SKILL.md` with:
  ```yaml
  ---
  name: <skill-name>
  description: <description>
  ---
  # <Skill Name>
  ... instructions ...
  ```
- Any supporting scripts under `.agents/skills/<skill-name>/scripts/`.

### 3. Add to the Local Script Index

Keep a list of generated helper scripts and skills in `.agents/skills/agent-self-improvement/INDEX.md`, so future agents can easily find and reuse them.
You can view the existing list in [INDEX.md](file:///d:/Projects/Backend/bara-api/.agents/skills/agent-self-improvement/INDEX.md).
