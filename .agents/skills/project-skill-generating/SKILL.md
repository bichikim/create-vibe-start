---
name: project-skill-generating
description: Use when creating or updating project-specific Codex skills for create-vibe-start, especially skills stored under .agents/skills with concise SKILL.md instructions and progressively loaded reference files.
---

# Project Skill Generating

## Core Workflow

- Create project-specific skills under `.agents/skills/<skill-name>/`.
- Put the required frontmatter and essential workflow in `SKILL.md`.
- Write concise, action-oriented instructions that tell the agent what to do.
- Split deeper guidance into reference files under `references/`.
- Link each reference file from `SKILL.md` with when to read it.
- Keep the first-read content focused on trigger, scope, file layout, and the next action.
- Use positive instructions such as `Create`, `Use`, `Write`, `Split`, `Link`, `Validate`, and `Report`.

## Skill Layout

```txt
.agents/skills/<skill-name>/
  SKILL.md
  references/
    authoring.md
    validation.md
```

## Progressive Reading

- For detailed authoring rules, read `references/authoring.md`.
- For review and validation steps, read `references/validation.md`.

## Completion

- Validate that `SKILL.md` has `name` and `description` frontmatter.
- Confirm referenced files exist at the paths listed in `SKILL.md`.
- Report the created or updated skill path and the reference files added.
