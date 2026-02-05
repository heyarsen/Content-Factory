#!/usr/bin/env node

/**
 * Poyo API Diagnostic Script
 * Tests the Poyo API key and checks Sora 2 task flow
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../../.env') });

const POYO_API_KEY = process.env.POYO_API_KEY;
const POYO_API_URL = 'https://api.poyo.ai';

console.log('🔍 Poyo API Diagnostic Tool\n');

if (!POYO_API_KEY) {
    console.error('❌ ERROR: POYO_API_KEY not found in environment variables');
    console.log('\nPlease set POYO_API_KEY in your .env file');
    process.exit(1);
}

console.log('✅ API Key found:', POYO_API_KEY.substring(0, 10) + '...' + POYO_API_KEY.substring(POYO_API_KEY.length - 4));

// Test 2: Try creating a minimal Sora task
async function testSoraTask() {
    console.log('\n🎬 Test 1: Testing Sora task creation...');
    try {
        const response = await axios.post(
            `${POYO_API_URL}/api/generate/submit`,
            {
                model: 'sora-2-private',
                callback_url: 'https://example.com/callback',
                input: {
                    prompt: 'A cat sitting on a table',
                    aspect_ratio: '16:9',
                    duration: 10,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${POYO_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        console.log('✅ Task creation successful!');
        console.log('Task ID:', response.data.data.task_id);
        console.log('Full response:', JSON.stringify(response.data, null, 2));

        return response.data.data.task_id;
    } catch (error) {
        console.error('❌ Task creation failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 401) {
                console.error('\n⚠️  DIAGNOSIS: Invalid or expired API key');
            } else if (error.response.status === 402) {
                console.error('\n⚠️  DIAGNOSIS: Insufficient credits in Poyo account');
            } else if (error.response.status === 422) {
                console.error('\n⚠️  DIAGNOSIS: Invalid request parameters');
            } else if (error.response.status === 501) {
                console.error('\n⚠️  DIAGNOSIS: Model not available or access denied');
            }
        } else {
            console.error('Error:', error.message);
        }
        return null;
    }
}

// Test 3: Check task status
async function checkTaskStatus(taskId) {
    if (!taskId) return;

    console.log('\n📋 Test 2: Checking task status...');
    console.log('Waiting 5 seconds before checking...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const response = await axios.get(`${POYO_API_URL}/api/task/status`, {
            params: { task_id: taskId },
            headers: {
                Authorization: `Bearer ${POYO_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        console.log('✅ Task status retrieved!');
        console.log('Status:', response.data.data.status);
        console.log('Full response:', JSON.stringify(response.data, null, 2));

        if (response.data.data.status === 'failed') {
            console.error('\n⚠️  Task failed with message:', response.data.data.error?.message);
        }
    } catch (error) {
        console.error('❌ Status check failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Run all tests
async function runDiagnostics() {
    const taskId = await testSoraTask();
    await checkTaskStatus(taskId);

    console.log('\n✅ Diagnostic complete!');
    console.log('\nIf all tests passed but videos still fail, the issue is likely:');
    console.log('1. Insufficient Poyo credits');
    console.log('2. Model access restrictions on your account');
    console.log('3. Poyo service issues');
    console.log('\nContact Poyo support for assistance.');
}

runDiagnostics().catch(console.error);
