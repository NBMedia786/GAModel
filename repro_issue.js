

async function test() {
    const url = 'http://localhost:3000/project/hist-12345';
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    const text = await res.text();
    console.log(`Body: ${text.substring(0, 500)}`);
}

test();
