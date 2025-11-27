import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
    console.log('🚀 Starting Server Verification...');

    // 1. Health Check
    try {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (res.ok) {
            const data = await res.json();
            console.log('✅ Health Check Passed:', data);
        } else {
            console.error('❌ Health Check Failed:', res.status, res.statusText);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Health Check Connection Failed:', e.message);
        process.exit(1);
    }

    // 2. Create Project
    let projectId;
    try {
        const res = await fetch(`${BASE_URL}/api/project/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectName: 'Test Project', template: 'blank' })
        });
        const data = await res.json();
        if (data.success) {
            projectId = data.projectId;
            console.log('✅ Project Creation Passed:', projectId);
        } else {
            console.error('❌ Project Creation Failed:', data);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Project Creation Error:', e.message);
        process.exit(1);
    }

    // 3. List Projects
    try {
        const res = await fetch(`${BASE_URL}/api/history/list`);
        const projects = await res.json();
        const found = projects.find(p => p.id === projectId);
        if (found) {
            console.log('✅ List Projects Passed: Found created project');
        } else {
            console.error('❌ List Projects Failed: Created project not found');
        }
    } catch (e) {
        console.error('❌ List Projects Error:', e.message);
    }

    // 4. Delete Project
    if (projectId) {
        try {
            const res = await fetch(`${BASE_URL}/api/history/${projectId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                console.log('✅ Delete Project Passed');
            } else {
                console.error('❌ Delete Project Failed:', data);
            }
        } catch (e) {
            console.error('❌ Delete Project Error:', e.message);
        }
    }

    console.log('🎉 Verification Complete!');
}

runTests();
