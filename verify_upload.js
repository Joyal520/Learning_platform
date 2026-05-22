const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('Starting Playwright verification test [V2]...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Log console messages from the browser
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    try {
        // 1. Navigate to login and click Dev Auto-Login
        console.log('Navigating to login page...');
        await page.goto('http://localhost:3000/#login');
        
        console.log('Waiting for login form...');
        await page.waitForSelector('#login-form', { timeout: 10000 });
        
        console.log('Clicking Dev Auto-Login test user button...');
        await page.click('#dev-auto-login');
        
        // Wait for successful login toast or navigation away from login
        console.log('Waiting for login to complete or error toast...');
        const loginSucceeded = await page.waitForFunction(() => {
            const hasChange = window.location.hash !== '#login' && window.location.hash !== '';
            const toasts = Array.from(document.querySelectorAll('.toast'));
            const hasError = toasts.some(t => t.classList.contains('error'));
            return hasChange || hasError;
        }, { timeout: 30000 });
        
        const hash = await page.evaluate(() => window.location.hash);
        if (hash === '#login' || hash === '') {
            const errorToast = await page.evaluate(() => {
                const toast = document.querySelector('.toast.error');
                return toast ? toast.innerText : 'Unknown Login Error';
            });
            throw new Error(`Login failed in browser: ${errorToast}`);
        }

        console.log('Logged in successfully. Current hash:', hash);

        // 2. Navigate to upload
        console.log('Navigating to upload page...');
        await page.goto('http://localhost:3000/#upload');
        await page.waitForSelector('#upload-form', { timeout: 10000 });

        // 3. Fill out the form
        console.log('Filling upload form...');
        await page.fill('input[name="title"]', 'Playwright Automated MP3 Test');
        
        // Select 'songs' category
        await page.selectOption('select[name="category"]', 'songs');
        
        // Click the first theme tag
        await page.waitForSelector('.theme-tag', { timeout: 5000 });
        await page.click('.theme-tag');
        
        // Select an audience level
        await page.selectOption('select[name="audience_level"]', 'elementary');

        // Verify the file upload input is visible
        console.log('Setting test audio file...');
        const filePath = path.resolve(__dirname, 'test_audio.mp3');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Test file not found at ${filePath}`);
        }
        await page.setInputFiles('input[name="file"]', filePath);

        // 4. Submit
        console.log('Submitting form...');
        await page.click('button[type="submit"]');

        // Wait for upload completion (toast containing 'success' or redirect)
        console.log('Waiting for upload to finish...');
        await page.waitForFunction(() => {
            const toasts = Array.from(document.querySelectorAll('.toast'));
            const isSuccess = toasts.some(t => t.innerText.toLowerCase().includes('success') || t.innerText.toLowerCase().includes('uploaded'));
            const isRedirect = window.location.hash === '#my-uploads' || window.location.hash === '#dashboard';
            return isSuccess || isRedirect;
        }, { timeout: 60000 });

        console.log('Upload successful! Current hash:', await page.evaluate(() => window.location.hash));

        // 5. Verify in Dashboard
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3000/#dashboard');
        
        // Wait for the moderation queue or uploaded works to load
        console.log('Waiting for dashboard data to load...');
        await page.waitForTimeout(5000); // Give it a moment to fetch from Supabase
        
        const pageContent = await page.content();
        if (pageContent.includes('Playwright Automated MP3 Test')) {
            console.log('✅ VERIFICATION PASSED: The uploaded MP3 was found in the dashboard/feed.');
        } else {
            console.log('❌ VERIFICATION FAILED: The uploaded MP3 was not visible in the dashboard.');
            console.log('Page content snapshot saved to test-failed-v2.html');
            fs.writeFileSync('test-failed-v2.html', pageContent);
        }

    } catch (e) {
        console.error('Test failed with error:', e);
        try {
            await page.screenshot({ path: 'error_screenshot_v2.png' });
            console.log('Saved screenshot to error_screenshot_v2.png');
        } catch (screenshotErr) {
            console.error('Failed to take screenshot:', screenshotErr);
        }
    } finally {
        await browser.close();
        console.log('Test complete.');
    }
})();
