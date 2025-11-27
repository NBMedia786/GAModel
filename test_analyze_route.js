// import fetch from 'node-fetch'; // Native fetch in Node v18+

async function testAnalyzeRoute() {
    const projectId = 'hist-1764219203851'; // Use the ID from the screenshot
    const url = `http://localhost:3000/api/project/${projectId}/analyze`;

    console.log(`Testing POST ${url}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: 'Test prompt' }),
        });

        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            console.log("✅ Route exists and is reachable.");
            // We expect a stream, but for this test, just knowing it's not 404 is enough.
            // We can abort or just read a bit.
            // Since it's a stream, we might not get a full body immediately if we await json()
            // But status 200 is what we want.
        } else {
            console.log("❌ Route failed.");
            const text = await response.text();
            console.log("Response:", text);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testAnalyzeRoute();
