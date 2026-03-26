
export async function searchComponentPrice(query: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
        console.warn('TAVILY_API_KEY is not set');
        return 'Price data unavailable';
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: `current price of ${query} electronic component on DigiKey, Mouser, eBay, Alibaba`,
                search_depth: "basic",
                include_answer: true,
                max_results: 3
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.answer || 'Price data unavailable';
    } catch (error) {
        console.error('Error searching price:', error);
        return 'Price data unavailable';
    }
}
