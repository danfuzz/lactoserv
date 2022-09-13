import { JsonExpander } from '@this/json';

import * as fs from 'node:fs/promises';

const doExpand = async (value) => {
  const jx = new JsonExpander();
  return jx.expandAsync(value);
};

const thisDir = new URL('.', import.meta.url).pathname;
const fileName = 'some-file.json';
const filePath = `${thisDir}/${fileName}`;
let fileText;
let fileJson;

beforeAll(async () => {
  fileText = await fs.readFile(filePath, 'utf-8');
  fileJson = JSON.parse(fileText);
});

test('simple test for type `text` (as default type)', async () => {
  const orig = { $readFile: filePath };
  const result = await doExpand(orig);
  expect(result).toBe(fileText);
});

test('simple test for type `text`', async () => {
  const orig = { $readFile: filePath, type: 'text' };
  const result = await doExpand(orig);
  expect(result).toBe(fileText);
});

test('simple test for type `json`', async () => {
  const orig = { $readFile: filePath, type: 'json' };
  const result = await doExpand(orig);
  expect(result).toEqual({
    selfExpectation: fileJson.selfExpectation,
    ...fileJson.selfExpectation
  });
});

test('simple test for type `rawJson`', async () => {
  const orig = { $readFile: filePath, type: 'rawJson' };
  const result = await doExpand(orig);
  expect(result).toEqual(fileJson);
});
