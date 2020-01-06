import { parentPort, workerData } from 'worker_threads';

globalThis.globalValue = 42;

function valueResolution(value) {
  const src = Object.entries(value).map(
    ([exportName, exportValue]) =>
      `export const ${exportName} = ${JSON.stringify(exportValue)};`
  ).join('\n');
  return {
    url: `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`,
    format: 'module',
  };
}

export async function resolve(specifier, referrer, parentResolve) {
  if (!specifier.startsWith('test!')) {
    return parentResolve(specifier, referrer);
  }

  switch (specifier.substr(5)) {
    case 'worker_threads':
      return valueResolution({ parentPort, workerData });

    case 'globalValue':
      return valueResolution({ globalValue: globalThis.globalValue });
  }

  throw new Error('Invalid test case');
}
