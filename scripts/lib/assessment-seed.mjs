import {
  metadataSchema,
  definitionSchema,
  ruleInputSchema,
} from '../../packages/shared/dist/index.js';

// Read only the fixed INSERT grammar used by the checked-in seed. Never execute
// SQL text over REST, evaluate expressions, or duplicate questionnaire content.
export function sqlSeedRows(sql, tableNames) {
  const tables = Object.fromEntries(tableNames.map((table) => [table, []]));
  for (const line of sql.split(/\r?\n/)) {
    const match = line.match(
      /^insert into public\.(\w+)\(([^)]+)\) values\((.*)\)(?: on conflict\(slug\) do nothing)?;$/,
    );
    if (!match || !(match[1] in tables)) continue;
    const columns = match[2].split(',').map((value) => value.trim());
    const token =
      /'(?:[^']|'')*'(?:\s*::jsonb)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?/g;
    const tokens = [...match[3].matchAll(token)].map((value) => value[0]);
    if (
      tokens.length !== columns.length ||
      match[3].replace(token, '').replace(/[,\s]/g, '')
    )
      throw new Error('Seed INSERT format changed; inspect the SQL seed.');
    const values = tokens.map((value) => {
      const json = value.endsWith('::jsonb');
      const text = json ? value.slice(0, -7).trim() : value;
      if (text.startsWith("'")) {
        const decoded = text.slice(1, -1).replaceAll("''", "'");
        return json ? JSON.parse(decoded) : decoded;
      }
      return JSON.parse(text);
    });
    tables[match[1]].push(
      Object.fromEntries(
        columns.map((column, index) => [column, values[index]]),
      ),
    );
  }
  return tables;
}
export function assessmentSeedDefinitions(sql) {
  const tables = sqlSeedRows(sql, [
    'assessment_types',
    'assessment_versions',
    'assessment_questions',
    'assessment_options',
    'recommendation_rules',
  ]);
  if (tables.assessment_types.length !== 4)
    throw new Error(
      'Expected the four versioned educational seed assessments.',
    );
  return tables.assessment_types.map((type) => {
    const { id, ...metadata } = type;
    const versions = tables.assessment_versions.filter(
      (version) => version.assessment_id === id,
    );
    if (versions.length !== 1)
      throw new Error('Each seed assessment must have one definition.');
    const version = versions[0];
    const questions = tables.assessment_questions
      .filter((question) => question.assessment_version_id === version.id)
      .sort((a, b) => a.display_order - b.display_order)
      .map((question) => ({
        id: question.id,
        question_text: question.question_text,
        question_type: 'single_choice',
        is_required: question.is_required,
        options: tables.assessment_options
          .filter((option) => option.question_id === question.id)
          .sort((a, b) => a.display_order - b.display_order)
          .map((option) => ({
            id: option.id,
            option_text: option.option_text,
            score: option.score,
          })),
      }));
    return {
      id,
      metadata: metadataSchema.parse(metadata),
      definition: definitionSchema.parse({
        scoring_config: version.scoring_config,
        questions,
      }),
      rules: tables.recommendation_rules
        .filter((rule) => rule.assessment_id === id)
        .map((rule) => {
          const { id: ruleId, ...input } = rule;
          return { id: ruleId, ...ruleInputSchema.parse(input) };
        }),
    };
  });
}
