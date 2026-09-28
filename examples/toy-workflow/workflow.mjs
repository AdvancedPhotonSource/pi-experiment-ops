import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const renderer = fileURLToPath(new URL('./render.py', import.meta.url));

export default {
  name: 'toy',
  version: 1,
  resolve(args) {
    if (Object.keys(args).some(key => !['input', 'outputDirectory'].includes(key)) || typeof args.input !== 'string' || !args.input.trim() || args.input.length > 4000) return { error: 'Expected input containing 1–4000 characters.' };
    if (typeof args.outputDirectory !== 'string' || !isAbsolute(args.outputDirectory)) return { error: 'outputDirectory must be an absolute path.' };
    const command = `python3 ${quote(renderer)} ${quote(args.outputDirectory)} ${quote(args.input)}`;
    return {
      hostCommands: [{ key: 'render', command }],
      script: `
        const generated = await runs.run('generate', {
          agent: 'reviewer', context: 'fresh', output: ${JSON.stringify(join(args.outputDirectory, 'generate.md'))},
          outputSchema: { type: 'object', properties: { title: { type: 'string' }, values: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 } }, required: ['title', 'values'], additionalProperties: false },
          task: 'PI_OPS_TOY_GENERATE\\nDescribe a toy dataset for: ' + ${JSON.stringify(args.input)} + '\\nSubmit a title and values (an array of three numbers) using structured_output.'
        });
        if (!generated.ok) throw new Error('Generation failed');
        const dataset = generated.structuredOutput;
        if (typeof dataset.title !== 'string' || !Array.isArray(dataset.values) || dataset.values.length !== 3 || !dataset.values.every(value => typeof value === 'number' && Number.isFinite(value))) throw new Error('Invalid dataset');
        const reviewed = await runs.run('review', {
          agent: 'reviewer', context: 'fresh', output: ${JSON.stringify(join(args.outputDirectory, 'review.md'))},
          outputSchema: { type: 'object', properties: { approved: { type: 'boolean' }, reason: { type: 'string' } }, required: ['approved', 'reason'], additionalProperties: false },
          task: 'PI_OPS_TOY_REVIEW\\nReview this dataset: ' + JSON.stringify(dataset) + '\\nRequirements: ' + ${JSON.stringify(args.input)} + '\\nSubmit approved (boolean) and reason (string) using structured_output.'
        });
        if (!reviewed.ok) throw new Error('Review failed');
        const review = reviewed.structuredOutput;
        if (review.approved !== true || typeof review.reason !== 'string') throw new Error('Review rejected');
        const rendered = await runs.host('render', { kind: 'command', command: ${JSON.stringify(command)}, timeoutMs: 30000 });
        if (!rendered.ok) throw new Error('Rendering failed');
        return { dataset, review, rendered };
      `,
    };
  },
};
