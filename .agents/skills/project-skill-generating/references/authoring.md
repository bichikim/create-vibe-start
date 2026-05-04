# Skill Authoring

## Frontmatter

- Set `name` to a short kebab-case skill name.
- Set `description` to the situations where the skill should trigger.
- Include the target project name or domain when the skill is project-specific.

## First-Read Content

- Start with the smallest workflow that lets the agent act correctly.
- Describe the skill scope, expected output, and file layout.
- Point to reference files for detailed procedures.
- Keep examples short and directly tied to this project.

## Instruction Style

- Write instructions as positive actions.
- Use verbs such as `Create`, `Use`, `Prefer`, `Keep`, `Split`, `Link`, `Check`, and `Report`.
- Phrase constraints as the desired shape of the output.
- Prefer concrete paths and file names over broad descriptions.

## Reference Files

- Put detailed guidance in `references/`.
- Give each reference file one clear purpose.
- Mention each reference path in `SKILL.md`.
- Add a short note in `SKILL.md` explaining when the agent should read each reference.
