import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Actually, let's just manually parse .env to be sure exactly what we are reading, avoiding library assumptions.

function parseEnv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^OPENAI_API_KEY=(.*)$/);
            if (match) {
                let val = match[1].trim();
                // naive quote removal if user added them
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                return val;
            }
        }
    } catch {
        return null;
    }
}

async function verify() {
    const envPath = path.resolve(process.cwd(), '.env');
    const envLocalPath = path.resolve(process.cwd(), '.env.local');

    let apiKey = parseEnv(envLocalPath) || parseEnv(envPath);

    console.log("Checking API Key Configuration...");

    if (!apiKey) {
        console.error("❌ OPENAI_API_KEY not found in .env.local or .env");
        return;
    }

    console.log(`Key found: Yes`);
    console.log(`Key length: ${apiKey.length}`);
    console.log(`Starts with 'sk-': ${apiKey.startsWith('sk-') ? 'Yes' : 'No ❌'}`);
    console.log(`Ends with newline/whitespace: ${apiKey.trim() !== apiKey ? 'Yes ❌' : 'No'}`);

    // Show first 3 and last 3 chars safely
    if (apiKey.length > 10) {
        console.log(`Masked Key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`);
    }

    // Try initializing client
    try {
        const openai = new OpenAI({ apiKey: apiKey.trim() }); // Trim here for the test
        console.log("Attempting to list models...");
        const list = await openai.models.list();
        console.log("✅ API Login Successful!");
        console.log(`Available models: ${list.data.length} found.`);
    } catch (error) {
        console.error("❌ API Call Failed:");
        console.error(error.message);
    }
}

verify();
