
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://127.0.0.1:3000';
let projectId = '';
let uploadedFileName = 'test_video.mp4';

async function runStep(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    try {
        await fn();
        console.log('✅ Passed');
    } catch (e) {
        console.log('❌ Failed');
        console.error(`  Error: ${e.message}`);
        process.exit(1);
    }
}

async function verifyProduction() {
    console.log('🚀 Starting Full System Verification...\n');

    // 1. Health Check
    await runStep('Health Check', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    // 2. Settings - Get
    await runStep('Get Settings', async () => {
        const res = await fetch(`${BASE_URL}/api/settings`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!data.email) throw new Error('Invalid settings data');
    });

    // 3. Settings - Update Profile
    await runStep('Update Profile', async () => {
        const res = await fetch(`${BASE_URL}/api/settings/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: 'Test', lastName: 'User' })
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    // 4. Create Project
    await runStep('Create Project', async () => {
        const res = await fetch(`${BASE_URL}/api/project/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName: 'Prod Test Project', template: 'blank' })
        });
        const data = await res.json();
        if (!data.success) throw new Error('Creation failed');
        projectId = data.projectId;
    });

    // 5. Upload File
    await runStep('Upload File', async () => {
        const boundary = '--------------------------1234567890';
        const fileContent = 'fake video content';
        const body =
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="projectId"\r\n\r\n` +
            `${projectId}\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="projectName"\r\n\r\n` +
            `Prod Test Project\r\n` +
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="video"; filename="${uploadedFileName}"\r\n` +
            `Content-Type: video/mp4\r\n\r\n` +
            `${fileContent}\r\n` +
            `--${boundary}--\r\n`;

        const res = await fetch(`${BASE_URL}/api/project/upload`, {
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`Status ${res.status}: ${txt}`);
        }
    });

    // 6. List Files
    await runStep('List Files', async () => {
        const res = await fetch(`${BASE_URL}/api/history/${projectId}/files`);
        const files = await res.json();
        const found = files.find(f => f.title === uploadedFileName);
        if (!found) throw new Error('Uploaded file not found');
    });

    // 7. Rename File
    await runStep('Rename File', async () => {
        const newName = 'renamed_video.mp4';
        const res = await fetch(`${BASE_URL}/api/history/${projectId}/files/${uploadedFileName}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newName })
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        uploadedFileName = newName; // Update for next steps
    });

    // 8. Soft Delete File
    await runStep('Soft Delete File', async () => {
        const res = await fetch(`${BASE_URL}/api/history/${projectId}/files/${uploadedFileName}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    // 9. Restore File
    await runStep('Restore File', async () => {
        const res = await fetch(`${BASE_URL}/api/history/${projectId}/files/${uploadedFileName}/restore`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    // 10. Permanent Delete File
    await runStep('Permanent Delete File', async () => {
        // First soft delete again
        await fetch(`${BASE_URL}/api/history/${projectId}/files/${uploadedFileName}`, { method: 'DELETE' });
        // Then permanent delete
        const res = await fetch(`${BASE_URL}/api/history/${projectId}/files/${uploadedFileName}?permanent=true`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    // 11. Delete Project
    await runStep('Delete Project', async () => {
        const res = await fetch(`${BASE_URL}/api/history/${projectId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
    });

    console.log('\n🎉 All Systems Operational! Production Ready.');
}

verifyProduction();
