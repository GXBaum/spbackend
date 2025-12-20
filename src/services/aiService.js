import OpenAI from 'openai';


export async function aiService(systemPrompt, prompt) {

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    //console.log('OPENROUTER_API_KEY', OPENROUTER_API_KEY);

    const openai = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: OPENROUTER_API_KEY,
        defaultHeaders: {
            // 'HTTP-Referer': process.env.SITE_URL || '',
            // 'X-Title': process.env.SITE_TITLE || '',
        },
    });

    if (!prompt || !systemPrompt) {
        throw new Error('Prompt is required');
    }
    if (!OPENROUTER_API_KEY) {
        throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    const completion = await openai.chat.completions.create({
        models: ["x-ai/grok-4.1-fast", "x-ai/grok-4-fast", "openai/gpt-5-nano", /*"openai/gpt-oss-120b"*/], // openrouter has a max of 3
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        max_tokens: 10000, // TODO: change
    });

    return completion;
}