import test from '@lib/BaseTest';
import { chromium } from '@playwright/test';

// Stress Testing: Run n instances of both Chrome and Edge browsers simultaneously
test(`Verify Book Store Login - Multi-Browser Parallel Load Test (2 Chrome + 2 Edge)`, { tag: '@Smoke'}, async ({ page }) => {
    
    const CHROME_INSTANCES = 2;
    const EDGE_INSTANCES = 2;
    const TOTAL_INSTANCES = CHROME_INSTANCES + EDGE_INSTANCES;
    
    // Create an array to store all browser contexts
    const contexts = [];
    
    await test.step(`Launch ${CHROME_INSTANCES} Chrome and ${EDGE_INSTANCES} Edge browsers simultaneously`, async () => {
        // Launch Chrome instances
        const chromePromises = Array.from({ length: CHROME_INSTANCES }, async (_, index) => {
            const browser = await chromium.launch({
                channel: 'chrome',
                headless: false, // Set to true for headless mode
            });
            const context = await browser.newContext();
            const newPage = await context.newPage();
            
            return { 
                browser, 
                context, 
                newPage, 
                browserType: 'Chrome',
                instance: index + 1 
            };
        });

        // Launch Edge instances
        const edgePromises = Array.from({ length: EDGE_INSTANCES }, async (_, index) => {
            const browser = await chromium.launch({
                channel: 'msedge',
                headless: false, // Set to true for headless mode
            });
            const context = await browser.newContext();
            const newPage = await context.newPage();
            
            return { 
                browser, 
                context, 
                newPage, 
                browserType: 'Edge',
                instance: index + 1 
            };
        });

        // Launch all browsers simultaneously
        const allPromises = [...chromePromises, ...edgePromises];
        const results = await Promise.all(allPromises);
        contexts.push(...results);
        console.log(`✓ Launched ${CHROME_INSTANCES} Chrome + ${EDGE_INSTANCES} Edge instances (${TOTAL_INSTANCES} total) simultaneously`);
    });

    // Execute login test on all browsers in parallel
    await test.step(`Execute login on all ${TOTAL_INSTANCES} instances in parallel`, async () => {
        const loginPromises = contexts.map(async (ctx) => {
            try {
                const { newPage, browserType, instance } = ctx;
                const instanceLabel = `${browserType}-${instance}`;
                
                // Navigate to URL
                await newPage.goto('http://demoqa.com');
                console.log(`[${instanceLabel}] ✓ Navigated to application`);
                
                // Click on Book Store Application
                await newPage.click('text=Book Store Application');
                console.log(`[${instanceLabel}] ✓ Clicked on Book Store Application`);
                
                // Click on Login button
                await newPage.click('button:has-text("Login")');
                console.log(`[${instanceLabel}] ✓ Clicked Login button`);
                
                // Login (update credentials based on your application)
                await newPage.fill('input[id="userName"]', `user_${instance}`);
                await newPage.fill('input[id="password"]', 'TestPassword@123');
                console.log(`[${instanceLabel}] ✓ Entered credentials`);
                
                await newPage.click('button:has-text("Login")');
                console.log(`[${instanceLabel}] ✓ Submitted login form`);
                
                // Wait for profile page
                await newPage.waitForURL('**/profile', { timeout: 10000 });
                console.log(`[${instanceLabel}] ✓ Login successful - Profile page loaded`);
                
                return { 
                    browserType, 
                    instance, 
                    status: 'success',
                    message: `${instanceLabel} logged in successfully`
                };
            } catch (error) {
                console.log(`[${ctx.browserType}-${ctx.instance}] ✗ Failed: ${error.message}`);
                return { 
                    browserType: ctx.browserType, 
                    instance: ctx.instance, 
                    status: 'failed', 
                    message: `${ctx.browserType}-${ctx.instance} failed: ${error.message}`
                };
            }
        });

        const results = await Promise.all(loginPromises);
        
        // Generate summary report
        console.log(`\n${'='.repeat(60)}`);
        console.log(`PARALLEL EXECUTION SUMMARY REPORT`);
        console.log(`${'='.repeat(60)}`);
        
        const chromeResults = results.filter(r => r.browserType === 'Chrome');
        const edgeResults = results.filter(r => r.browserType === 'Edge');
        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.filter(r => r.status === 'failed').length;

        console.log(`\nChrome Results (${CHROME_INSTANCES} instances):`);
        chromeResults.forEach(r => {
            const icon = r.status === 'success' ? '✓' : '✗';
            console.log(`  ${icon} Chrome-${r.instance}: ${r.status.toUpperCase()}`);
        });

        console.log(`\nEdge Results (${EDGE_INSTANCES} instances):`);
        edgeResults.forEach(r => {
            const icon = r.status === 'success' ? '✓' : '✗';
            console.log(`  ${icon} Edge-${r.instance}: ${r.status.toUpperCase()}`);
        });

        console.log(`\n${'='.repeat(60)}`);
        console.log(`Total: ${successCount}/${TOTAL_INSTANCES} instances successful`);
        console.log(`Failed: ${failureCount}/${TOTAL_INSTANCES} instances`);
        console.log(`${'='.repeat(60)}\n`);

        // Assert that all tests passed
        if (failureCount > 0) {
            throw new Error(`${failureCount} instances failed. See logs above.`);
        }
    });

    // Close all browsers
    await test.step(`Close all ${TOTAL_INSTANCES} browser instances`, async () => {
        await Promise.all(
            contexts.map(ctx => ctx.browser.close())
        );
        console.log(`✓ Closed all browser instances`);
    });
}); 