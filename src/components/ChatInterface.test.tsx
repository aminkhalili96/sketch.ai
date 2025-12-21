import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from './ChatInterface';
import * as projectStore from '@/stores/projectStore';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock fetch
type FetchResponse = Pick<Response, 'json'>;
type FetchMock = (...args: Parameters<typeof fetch>) => Promise<FetchResponse>;
const mockFetch = vi.fn<FetchMock>();
global.fetch = mockFetch as unknown as typeof fetch;

describe('ChatInterface', () => {
    const mockAddMessage = vi.fn();
    const mockSetChatting = vi.fn();
    const mockSetError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(projectStore, 'useProjectStore').mockReturnValue({
            currentProject: {
                messages: [],
                description: 'test project',
                analysis: {},
                outputs: {},
                metadata: undefined,
            },
            addMessage: mockAddMessage,
            isChatting: false,
            setChatting: mockSetChatting,
            setError: mockSetError,
            pushOutputsSnapshot: vi.fn(),
            undoLastSnapshot: vi.fn(),
            outputSnapshots: [],
            replaceOutputs: vi.fn(),
        } as unknown as ReturnType<typeof projectStore.useProjectStore>);
    });

    it('renders correctly', () => {
        render(<ChatInterface />);
        expect(screen.getByText('Design Assistant')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
    });

    it('handles input change', () => {
        render(<ChatInterface />);
        const input = screen.getByPlaceholderText('Ask anything...');
        fireEvent.change(input, { target: { value: 'Hello' } });
        expect(input).toHaveValue('Hello');
    });

    it('sends message on button click', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: false, body: null } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, reply: 'Hi there' }),
            } as Response);

        render(<ChatInterface />);
        const input = screen.getByPlaceholderText('Ask anything...');
        fireEvent.change(input, { target: { value: 'Hello' } });

        const button = screen.getByRole('button', { name: '' }); // The button has an SVG icon
        fireEvent.click(button);

        expect(mockAddMessage).toHaveBeenCalledWith({ role: 'user', content: 'Hello' });
        expect(mockSetChatting).toHaveBeenCalledWith(true);

        await waitFor(() => {
            expect(mockAddMessage).toHaveBeenCalledWith({ role: 'assistant', content: 'Hi there' });
        });
    });

    it('handles API error', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: false, body: null } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: false, error: 'API Error' }),
            } as Response);

        render(<ChatInterface />);
        const input = screen.getByPlaceholderText('Ask anything...');
        fireEvent.change(input, { target: { value: 'Hello' } });

        const button = screen.getByRole('button', { name: '' });
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockSetError).toHaveBeenCalledWith('API Error');
        });
    });
});
