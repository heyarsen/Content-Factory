#!/usr/bin/env node

/**
 * KIE API Diagnostic Script
 * Tests the KIE API key and checks account credits
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

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_API_URL = 'https://api.kie.ai';

console.log('🔍 KIE API Diagnostic Tool\n');

if (!KIE_API_KEY) {
    console.error('❌ ERROR: KIE_API_KEY not found in environment variables');
    console.log('\nPlease set KIE_API_KEY in your .env file');
    process.exit(1);
}

console.log('✅ API Key found:', KIE_API_KEY.substring(0, 10) + '...' + KIE_API_KEY.substring(KIE_API_KEY.length - 4));

// Test 1: Check account credits
async function checkCredits() {
    console.log('\n📊 Test 1: Checking account credits...');
    try {
        const response = await axios.get(`${KIE_API_URL}/api/v1/account/credits`, {
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });

        console.log('✅ Credits check successful!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Credits check failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 401) {
                console.error('\n⚠️  DIAGNOSIS: Invalid or expired API key');
                console.error('   → Please check your API key at https://kie.ai/api-key');
            } else if (error.response.status === 402) {
                console.error('\n⚠️  DIAGNOSIS: Insufficient credits');
                console.error('   → Please add credits to your KIE account');
            }
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test 2: Try creating a minimal Sora task
async function testSoraTask() {
    console.log('\n🎬 Test 2: Testing Sora task creation...');
    try {
        const response = await axios.post(
            `${KIE_API_URL}/api/v1/jobs/createTask`,
            {
                model: 'sora-2-text-to-video',
                input: {
                    prompt: 'A cat sitting on a table',
                    aspect_ratio: 'landscape',
                    n_frames: '10',
                    remove_watermark: true,
                },
            },
            {
                headers: {
                    'Authorization': `Bearer ${KIE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );

        console.log('✅ Task creation successful!');
        console.log('Task ID:', response.data.data.taskId);
        console.log('Full response:', JSON.stringify(response.data, null, 2));

        return response.data.data.taskId;
    } catch (error) {
        console.error('❌ Task creation failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 401) {
                console.error('\n⚠️  DIAGNOSIS: Invalid or expired API key');
            } else if (error.response.status === 402) {
                console.error('\n⚠️  DIAGNOSIS: Insufficient credits in KIE account');
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

    console.log('\n📋 Test 3: Checking task status...');
    console.log('Waiting 5 seconds before checking...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        const response = await axios.get(`${KIE_API_URL}/api/v1/jobs/recordInfo`, {
            params: { taskId },
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        console.log('✅ Task status retrieved!');
        console.log('Status:', response.data.data.state);
        console.log('Full response:', JSON.stringify(response.data, null, 2));

        if (response.data.data.state === 'fail') {
            console.error('\n⚠️  Task failed with message:', response.data.data.failMsg || response.data.data.failCode);
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
    await checkCredits();
    const taskId = await testSoraTask();
    await checkTaskStatus(taskId);

    console.log('\n✅ Diagnostic complete!');
    console.log('\nIf all tests passed but videos still fail, the issue is likely:');
    console.log('1. Insufficient KIE credits');
    console.log('2. Model access restrictions on your account');
    console.log('3. KIE service issues');
    console.log('\nContact KIE support at support@kie.ai for assistance.');
}

runDiagnostics().catch(console.error);
