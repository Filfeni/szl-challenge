import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Calculator from './Calculator';
import { ApiError, calculate, type CalculateResponse } from '../api/calculatorClient';

vi.mock('../api/calculatorClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/calculatorClient')>();
  return { ...actual, calculate: vi.fn() };
});

const calculateMock = vi.mocked(calculate);

function setup() {
  const user = userEvent.setup();
  render(<Calculator />);
  return { user };
}

function opButton(label: string) {
  return screen.getByRole('button', { name: label });
}

function submitButton() {
  return screen.getByRole('button', { name: /calculate|calculating/i });
}

function display() {
  return screen.getByRole('status');
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function fillBoth(user: ReturnType<typeof userEvent.setup>, a: string, b: string) {
  await user.type(screen.getByLabelText('First number'), a);
  await user.type(screen.getByLabelText('Second number'), b);
}

beforeEach(() => {
  calculateMock.mockReset();
});

describe('Calculator', () => {
  describe('operations', () => {
    it('starts on Add with two inputs', () => {
      setup();

      expect(opButton('Add')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('First number')).toBeInTheDocument();
      expect(screen.getByLabelText('Second number')).toBeInTheDocument();
      expect(submitButton()).toHaveTextContent('Calculate (Add)');
    });

    it('renders a button for every operation', () => {
      setup();
      const group = screen.getByRole('group', { name: 'Operation' });

      expect(within(group).getAllByRole('button')).toHaveLength(7);
    });

    it('switches the pressed operation and submit label', async () => {
      const { user } = setup();

      await user.click(opButton('Multiply'));

      expect(opButton('Multiply')).toHaveAttribute('aria-pressed', 'true');
      expect(opButton('Add')).toHaveAttribute('aria-pressed', 'false');
      expect(submitButton()).toHaveTextContent('Calculate (Multiply)');
    });

    it('hides the second input for square root and brings it back after', async () => {
      const { user } = setup();

      await user.click(opButton('Square root'));

      expect(screen.queryByLabelText('Second number')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Number')).toBeInTheDocument();

      await user.click(opButton('Power'));

      expect(screen.getByLabelText('First number')).toBeInTheDocument();
      expect(screen.getByLabelText('Second number')).toBeInTheDocument();
    });

    it('keeps typed values when switching operations', async () => {
      const { user } = setup();
      await fillBoth(user, '4', '5');

      await user.click(opButton('Square root'));
      await user.click(opButton('Subtract'));

      expect(screen.getByLabelText('First number')).toHaveValue('4');
      expect(screen.getByLabelText('Second number')).toHaveValue('5');
    });
  });

  describe('field errors', () => {
    it('shows errors for both empty fields without calling the API', async () => {
      const { user } = setup();

      await user.click(submitButton());

      const a = screen.getByLabelText('First number');
      const b = screen.getByLabelText('Second number');
      expect(a).toHaveAttribute('aria-invalid', 'true');
      expect(a).toHaveAccessibleDescription('Enter a number.');
      expect(b).toHaveAttribute('aria-invalid', 'true');
      expect(b).toHaveAccessibleDescription('Enter a number.');
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('shows an error only on the invalid field', async () => {
      const { user } = setup();
      await fillBoth(user, '3', 'abc');

      await user.click(submitButton());

      expect(screen.getByLabelText('First number')).not.toHaveAttribute('aria-invalid');
      expect(screen.getByLabelText('Second number')).toHaveAccessibleDescription('"abc" is not a valid number.');
      expect(calculateMock).not.toHaveBeenCalled();
    });

    it('does not validate the hidden second input for square root', async () => {
      calculateMock.mockResolvedValue({ operation: 'sqrt', a: 9, result: 3 });
      const { user } = setup();
      await user.click(opButton('Square root'));
      await user.type(screen.getByLabelText('Number'), '9');

      await user.click(submitButton());

      expect(calculateMock).toHaveBeenCalledWith({ operation: 'sqrt', a: 9, b: undefined }, expect.any(AbortSignal));
    });

    it('clears field errors once the input is fixed', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 1, b: 2, result: 3 });
      const { user } = setup();
      await user.click(submitButton());

      await fillBoth(user, '1', '2');
      await user.click(submitButton());

      expect(screen.getByLabelText('First number')).not.toHaveAttribute('aria-invalid');
      expect(screen.getByLabelText('Second number')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
    });

    it('drops the second-number error after a trip through square root', async () => {
      const { user } = setup();
      await user.click(submitButton());
      await user.click(opButton('Square root'));
      await user.click(opButton('Add'));

      expect(screen.getByLabelText('Second number')).not.toHaveAttribute('aria-invalid');
      expect(screen.getByLabelText('First number')).toHaveAccessibleDescription('Enter a number.');
    });

    it('keeps field errors when switching between two-number operations', async () => {
      const { user } = setup();
      await user.click(submitButton());
      await user.click(opButton('Multiply'));

      expect(screen.getByLabelText('Second number')).toHaveAccessibleDescription('Enter a number.');
    });

    // Documents current behaviour (suspected bug): a failed validation leaves the old result up.
    it('keeps the previous result on screen when the next submit fails validation', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 1, b: 2, result: 3 });
      const { user } = setup();
      await fillBoth(user, '1', '2');
      await user.click(submitButton());
      await screen.findByText('1 + 2 =');

      await user.clear(screen.getByLabelText('Second number'));
      await user.click(submitButton());

      expect(screen.getByLabelText('Second number')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('1 + 2 =')).toBeInTheDocument();
    });
  });

  describe('results', () => {
    it('sends parsed numbers and shows the expression and result', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 1.5, b: 2, result: 3.5 });
      const { user } = setup();
      await fillBoth(user, ' 1.5 ', '2');

      await user.click(submitButton());

      expect(calculateMock).toHaveBeenCalledWith({ operation: 'add', a: 1.5, b: 2 }, expect.any(AbortSignal));
      expect(await screen.findByText('1.5 + 2 =')).toBeInTheDocument();
      expect(within(display()).getByText('3.5')).toBeInTheDocument();
    });

    it('formats float noise out of the result', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 0.1, b: 0.2, result: 0.30000000000000004 });
      const { user } = setup();
      await fillBoth(user, '0.1', '0.2');

      await user.click(submitButton());

      expect(await screen.findByText('0.3')).toBeInTheDocument();
    });

    it('shows a unary expression for square root', async () => {
      calculateMock.mockResolvedValue({ operation: 'sqrt', a: 16, result: 4 });
      const { user } = setup();
      await user.click(opButton('Square root'));
      await user.type(screen.getByLabelText('Number'), '16');

      await user.click(submitButton());

      expect(await screen.findByText('√16 =')).toBeInTheDocument();
      expect(within(display()).getByText('4')).toBeInTheDocument();
    });

    it('uses the symbol of the chosen operation', async () => {
      calculateMock.mockResolvedValue({ operation: 'divide', a: 10, b: 4, result: 2.5 });
      const { user } = setup();
      await user.click(opButton('Divide'));
      await fillBoth(user, '10', '4');

      await user.click(submitButton());

      expect(await screen.findByText('10 ÷ 4 =')).toBeInTheDocument();
    });

    it('falls back to the submitted b when the response leaves it out', async () => {
      calculateMock.mockResolvedValue({ operation: 'add', a: 1, result: 6 } as CalculateResponse);
      const { user } = setup();
      await fillBoth(user, '1', '5');

      await user.click(submitButton());

      expect(await screen.findByText('1 + 5 =')).toBeInTheDocument();
    });
  });

  describe('error messages', () => {
    async function submitWithError(err: unknown) {
      calculateMock.mockRejectedValue(err);
      const { user } = setup();
      await fillBoth(user, '1', '0');
      await user.click(submitButton());
      return screen.findByRole('alert');
    }

    it.each([
      ['DIVISION_BY_ZERO', "You can't divide by zero."],
      ['NEGATIVE_SQRT', "You can't take the square root of a negative number."],
      ['NOT_FINITE', 'The result is too large to represent.'],
      ['NETWORK', 'Could not reach the calculator service. Is the backend running?'],
    ])('shows a friendly message for %s', async (code, message) => {
      const alert = await submitWithError(new ApiError(code, 'raw server text', 400));

      expect(alert).toHaveTextContent(message);
    });

    it('falls back to the server message for unknown codes', async () => {
      const alert = await submitWithError(new ApiError('INVALID_OPERAND', 'b must be a number', 400));

      expect(alert).toHaveTextContent('b must be a number');
    });

    it('shows a generic message for non-API errors', async () => {
      const alert = await submitWithError(new TypeError('boom'));

      expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    });

    it('replaces an earlier result with the error', async () => {
      calculateMock
        .mockResolvedValueOnce({ operation: 'add', a: 1, b: 2, result: 3 })
        .mockRejectedValueOnce(new ApiError('NETWORK', 'down', 0));
      const { user } = setup();
      await fillBoth(user, '1', '2');
      await user.click(submitButton());
      await screen.findByText('1 + 2 =');

      await user.click(submitButton());

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.queryByText('1 + 2 =')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('disables the submit button while waiting and restores it after', async () => {
      const pending = deferred<CalculateResponse>();
      calculateMock.mockReturnValue(pending.promise);
      const { user } = setup();
      await fillBoth(user, '2', '3');

      await user.click(submitButton());

      expect(submitButton()).toBeDisabled();
      expect(submitButton()).toHaveTextContent('Calculating…');
      expect(display()).toBeEmptyDOMElement();

      await act(async () => pending.resolve({ operation: 'add', a: 2, b: 3, result: 5 }));

      expect(submitButton()).toBeEnabled();
      expect(submitButton()).toHaveTextContent('Calculate (Add)');
      expect(within(display()).getByText('5')).toBeInTheDocument();
    });

    it('restores the button after a failure', async () => {
      const pending = deferred<CalculateResponse>();
      calculateMock.mockReturnValue(pending.promise);
      const { user } = setup();
      await fillBoth(user, '2', '3');
      await user.click(submitButton());

      await act(async () => pending.reject(new ApiError('NETWORK', 'down', 0)));

      expect(submitButton()).toBeEnabled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('aborts the in-flight request when a new one starts and ignores its failure', async () => {
      const first = deferred<CalculateResponse>();
      const second = deferred<CalculateResponse>();
      calculateMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const { user } = setup();
      await fillBoth(user, '2', '3');
      await user.click(submitButton());

      // The button is disabled while loading, so submit the form directly.
      const form = submitButton().closest('form')!;
      act(() => form.requestSubmit());

      const firstSignal = calculateMock.mock.calls[0][1]!;
      const secondSignal = calculateMock.mock.calls[1][1]!;
      expect(firstSignal.aborted).toBe(true);
      expect(secondSignal.aborted).toBe(false);

      await act(async () => first.reject(new DOMException('aborted', 'AbortError')));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(submitButton()).toBeDisabled();

      await act(async () => second.resolve({ operation: 'add', a: 2, b: 3, result: 5 }));
      expect(within(display()).getByText('5')).toBeInTheDocument();
    });
  });
});
