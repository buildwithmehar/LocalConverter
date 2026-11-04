import { productivityTools } from '../../shared/productivity-tools.js';
import { decode } from './utility-common.js';
import { runProductivity } from './utility-productivity.js';
import { runData } from './utility-data.js';
export async function executeCore(operation, inputs, o, signal) {
  if (productivityTools.some((t) => t.id === operation)) {
    const text = decode(inputs[0].bytes, 1048576);
    if (['compare-text', 'compare-json'].includes(operation) && inputs[1])
      o = { ...o, second: decode(inputs[1].bytes, 1048576) };
    return runProductivity(operation, text, o, signal);
  }
  return runData(operation, inputs, o);
}
