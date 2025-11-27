
import fs from 'fs';
import path from 'path';

async function testUpload() {
    const boundary = '--------------------------1234567890';
    const projectId = 'test-project-123';
    const projectName = 'Test Project';
    const filename = 'test_video.mp4';
    const fileContent = 'fake video content';

    const body =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="projectId"\r\n\r\n` +
        `${projectId}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="projectName"\r\n\r\n` +
        `${projectName}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="video"; filename="${filename}"\r\n` +
        `Content-Type: video/mp4\r\n\r\n` +
        `${fileContent}\r\n` +
        `--${boundary}--\r\n`;

    console.log('Uploading video...');
    try {
        const res = await fetch('http://localhost:3000/api/project/upload', {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: body
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);

        if (res.ok) {
            console.log('✅ Upload test passed');
        } else {
            console.error('❌ Upload test failed');
        }

    } catch (e) {
        console.error('❌ Upload test error:', e);
    }
}

testUpload();
