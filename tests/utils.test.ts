import { withBackoff } from '../src/utils/backoff';

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');

describe('withBackoff', () => {
  let mockFn: jest.Mock;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  beforeEach(() => {
    mockFn = jest.fn();
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it('should succeed on first try', async () => {
    mockFn.mockResolvedValue('success');
    const p = withBackoff(mockFn, 3, 10);
    const assertion = expect(p).resolves.toBe('success');
    await jest.runAllTimersAsync();
    await assertion;
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry the function and eventually succeed', async () => {
    mockFn
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const p = withBackoff(mockFn, 4, 10);
    const assertion = expect(p).resolves.toBe('success');
    await jest.runAllTimersAsync();
    await assertion;
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw the last error after all attempts fail', async () => {
    const finalError = new Error('Final failure');
    mockFn.mockRejectedValue(finalError);

    const p = withBackoff(mockFn, 3, 10);
    const assertion = expect(p).rejects.toBe(finalError);
    await jest.runAllTimersAsync();
    await assertion;
    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});