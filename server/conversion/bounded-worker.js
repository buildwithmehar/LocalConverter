import { parentPort, workerData } from 'node:worker_threads';
try {
  const { operation, text, options } = workerData;
  let result;
  if (operation === 'regex') {
    if (
      !/^[dgimsuvy]*$/.test(options.flags) ||
      new Set(options.flags).size !== options.flags.length
    )
      throw new Error('Choose valid, unique JavaScript regex flags.');
    const regex = new RegExp(options.pattern, options.flags);
    let match;
    const matches = [];
    while ((match = regex.exec(text)) && matches.length < 1000) {
      matches.push({
        index: match.index,
        end: match.index + match[0].length,
        value: match[0],
        groups: match.slice(1),
        namedGroups: match.groups || {},
      });
      if (!regex.global && !regex.sticky) break;
      if (match[0] === '')
        regex.lastIndex +=
          (regex.unicode || regex.unicodeSets) && text.codePointAt(regex.lastIndex) > 65535 ? 2 : 1;
    }
    result = { matches, truncated: matches.length === 1000 };
  } else if (operation === 'schema') {
    const { default: Ajv } = await import('ajv');
    const ajv = new Ajv({
      allErrors: false,
      strict: false,
      validateFormats: false,
      ownProperties: true,
      loopRequired: 50,
      loopEnum: 50,
    });
    const validate = ajv.compile(JSON.parse(options.schema));
    const valid = validate(JSON.parse(text));
    result = { valid, errors: validate.errors || [] };
  }
  parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
