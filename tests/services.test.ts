
import { safeJson } from '../src/services/llm/chain.orchestrator';

describe('safeJson', () => {
  it('should parse a valid JSON string correctly', () => {
    const jsonString = '{"key": "value", "number": 123}';
    const expected = { key: 'value', number: 123 };
    expect(safeJson(jsonString)).toEqual(expected);
  });

  it('should extract and parse a JSON object surrounded by other text', () => {
    const messyString = 'Here is the JSON: { "name": "Test", "data": [1, 2] } Thanks';
    const expected = { name: 'Test', data: [1, 2] };
    expect(safeJson(messyString)).toEqual(expected);
  });

  it('should extract and parse a JSON object with leading/trailing whitespace and newlines', () => {
    const messyString = '\n   { "a": { "b": "c" } }   \n';
    const expected = { a: { b: 'c' } };
    expect(safeJson(messyString)).toEqual(expected);
  });

  it('should throw an error for a string with no JSON object', () => {
    const invalidString = 'This is just a regular string.';
    expect(() => safeJson(invalidString)).toThrow('LLM did not return valid JSON');
  });

  it('should throw an error for a malformed JSON string', () => {
    const malformedString = '{"key": "value", "malformed'; // Malformed JSON
    expect(() => safeJson(malformedString)).toThrow(); // Check for any parsing error
  });

  it('should throw an error for an empty string', () => {
    const emptyString = '';
    expect(() => safeJson(emptyString)).toThrow('LLM did not return valid JSON');
  });
});
