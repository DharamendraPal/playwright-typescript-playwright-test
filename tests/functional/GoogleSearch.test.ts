import test from '@lib/BaseTest';
import { chromium } from '@playwright/test';

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay between min and max milliseconds
const randomDelay = (min: number, max: number) => delay(Math.random() * (max - min) + min);

// Array of realistic user agents
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0'
];

// Interface for Network Metrics
interface NetworkMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalDataTransferred: number;
    requestTypes: { [key: string]: number };
    averageResponseTime: number;
}

// Interface for Performance Metrics
interface PerformanceMetrics {
    pageLoadTime: number;
    domContentLoadedTime: number;
    resourcesDownloadTime: number;
    jsHeapUsed: number;
    jsHeapLimit: number;
}

// Helper function to capture network metrics
const captureNetworkMetrics = (networkRequests: any[]): NetworkMetrics => {
    const metrics: NetworkMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalDataTransferred: 0,
        requestTypes: {},
        averageResponseTime: 0
    };

    let totalResponseTime = 0;

    networkRequests.forEach(request => {
        metrics.totalRequests++;
        const method = request.method || 'unknown';
        metrics.requestTypes[method] = (metrics.requestTypes[method] || 0) + 1;

        // Count successful vs failed
        if (request.status && request.status >= 200 && request.status < 400) {
            metrics.successfulRequests++;
        } else if (request.status) {
            metrics.failedRequests++;
        }

        // Add response size
        if (request.responseSize) {
            metrics.totalDataTransferred += request.responseSize;
        }

        // Calculate response time
        if (request.responseTime) {
            totalResponseTime += request.responseTime;
        }
    });

    metrics.averageResponseTime = networkRequests.length > 0 ? totalResponseTime / networkRequests.length : 0;

    return metrics;
};

// Helper function to capture performance metrics from page
const capturePerformanceMetrics = async (page: any): Promise<PerformanceMetrics> => {
    const perfMetrics = await page.evaluate(() => {
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paintEntries = performance.getEntriesByType('paint');
        const resourceEntries = performance.getEntriesByType('resource');

        let pageLoadTime = 0;
        let domContentLoadedTime = 0;
        let resourcesDownloadTime = 0;

        if (navTiming) {
            pageLoadTime = navTiming.loadEventEnd - navTiming.fetchStart;
            domContentLoadedTime = navTiming.domContentLoadedEventEnd - navTiming.fetchStart;
        }

        // Sum up resource download times
        resourceEntries.forEach((entry: PerformanceResourceTiming) => {
            resourcesDownloadTime += entry.duration;
        });

        const memory = (performance as any).memory || { usedJSHeapSize: 0, jsHeapSizeLimit: 0 };

        return {
            pageLoadTime,
            domContentLoadedTime,
            resourcesDownloadTime,
            jsHeapUsed: memory.usedJSHeapSize || 0,
            jsHeapLimit: memory.jsHeapSizeLimit || 0
        };
    });

    return perfMetrics;
};

// Parameterized search terms for each browser instance
const searchTermsConfig = {
    Chrome: {
        1: 'Playwright',
        2: 'Selenium'
    },
    Edge: {
        1: 'Cypress',
        2: 'UFT'
    }
};

// Helper function to get search term for specific browser and instance
const getSearchTerm = (browserType: string, instance: number): string => {
    const config = searchTermsConfig[browserType as keyof typeof searchTermsConfig];
    if (config && config[instance as keyof typeof config]) {
        return config[instance as keyof typeof config];
    }
    return 'Test'; // Default fallback
};

// Stress Testing: Run n instances of both Chrome and Edge browsers with anti-bot measures
test(`Verify Google Search for Multiple Terms - Multi-Browser Parallel Test`, { tag: '@Smoke'}, async ({ page }) => {
    
    const CHROME_INSTANCES = 2;
    const EDGE_INSTANCES = 2;
    const TOTAL_INSTANCES = CHROME_INSTANCES + EDGE_INSTANCES;
    
    // Create an array to store all browser contexts
    const contexts = [];
    
    await test.step(`Launch ${CHROME_INSTANCES} Chrome and ${EDGE_INSTANCES} Edge browsers with staggered delays`, async () => {
        // Launch Chrome instances with delays
        const chromePromises = Array.from({ length: CHROME_INSTANCES }, async (_, index) => {
            // Add staggered delay to avoid CAPTCHA
            await randomDelay(2000, 4000);
            
            const browser = await chromium.launch({
                channel: 'chrome',
                headless: false,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--no-default-browser-check'
                ]
            });
            
            const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            const context = await browser.newContext({
                userAgent: userAgent,
                locale: 'en-US',
                timezoneId: 'America/New_York',
            });
            
            // Set anti-detection properties
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
            });
            
            const newPage = await context.newPage();
            
            return { 
                browser, 
                context, 
                newPage, 
                browserType: 'Chrome',
                instance: index + 1 
            };
        });

        // Launch Edge instances with delays
        const edgePromises = Array.from({ length: EDGE_INSTANCES }, async (_, index) => {
            // Add staggered delay to avoid CAPTCHA
            await randomDelay(2000, 4000);
            
            const browser = await chromium.launch({
                channel: 'msedge',
                headless: false,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--no-first-run',
                    '--no-default-browser-check'
                ]
            });
            
            const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
            const context = await browser.newContext({
                userAgent: userAgent,
                locale: 'en-US',
                timezoneId: 'America/New_York',
            });
            
            // Set anti-detection properties
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
            });
            
            const newPage = await context.newPage();
            
            return { 
                browser, 
                context, 
                newPage, 
                browserType: 'Edge',
                instance: index + 1 
            };
        });

        // Launch all browsers sequentially with delays to avoid CAPTCHA
        const allPromises = [...chromePromises, ...edgePromises];
        const results = await Promise.all(allPromises);
        contexts.push(...results);
        console.log(`Launched ${CHROME_INSTANCES} Chrome + ${EDGE_INSTANCES} Edge instances (${TOTAL_INSTANCES} total) with anti-bot measures`);
    });

    // Execute Google search on all browsers in parallel
    await test.step(`Execute Google search on all ${TOTAL_INSTANCES} instances in parallel`, async () => {
        const searchPromises = contexts.map(async (ctx) => {
            try {
                const { newPage, browserType, instance } = ctx;
                const instanceLabel = `${browserType}-${instance}`;
                const networkData: any[] = [];

                // Setup network interception to capture requests
                await newPage.on('response', async (response) => {
                    try {
                        const request = response.request();
                        const headers = response.headers();
                        const contentLength = parseInt(headers['content-length'] || '0', 10);

                        networkData.push({
                            url: request.url(),
                            method: request.method(),
                            status: response.status(),
                            resourceType: request.resourceType(),
                            responseSize: contentLength,
                            responseTime: 0
                        });
                    } catch (e) {
                        // Silently handle errors in response interception
                    }
                });

                // Navigate to Google with random delay
                await randomDelay(1000, 2000);
                await newPage.goto('https://www.google.com/', { waitUntil: 'domcontentloaded' });
                console.log(`[${instanceLabel}] Navigated to Google.com`);
                
                // Check if CAPTCHA is present
                const captchaPresent = await newPage.locator('[data-callback="recaptchaCallback"]').isVisible().catch(() => false);
                if (captchaPresent) {
                    console.log(`[${instanceLabel}] CAPTCHA detected. Waiting 30 seconds for manual solving or bypass...`);
                    // Wait up to 30 seconds for CAPTCHA to be solved or page to change
                    await newPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                }
                
                // Fill search box with parameterized search term
                const searchTerm = getSearchTerm(browserType, instance);
                const searchBox = await newPage.locator('textarea[name="q"]').first();
                await randomDelay(500, 1500);
                await searchBox.fill(searchTerm);
                console.log(`[${instanceLabel}] Entered "${searchTerm}" in search box`);
                
                // Press Enter to search with random delay
                await randomDelay(500, 1200);
                await searchBox.press('Enter');
                console.log(`[${instanceLabel}] Pressed Enter to search`);
                
                // Wait for search results page to load (URL changes from / to /search)
                await newPage.waitForURL('**/search**', { timeout: 15000 });
                
                // Wait for page to be fully loaded
                await newPage.waitForLoadState('networkidle');
                console.log(`[${instanceLabel}] Search results loaded successfully`);

                // Capture performance metrics
                const perfMetrics = await capturePerformanceMetrics(newPage);
                const networkMetrics = captureNetworkMetrics(networkData);

                // Log network metrics
                console.log(`[${instanceLabel}] Network Metrics:`);
                console.log(`  - Total Requests: ${networkMetrics.totalRequests}`);
                console.log(`  - Successful: ${networkMetrics.successfulRequests}, Failed: ${networkMetrics.failedRequests}`);
                console.log(`  - Data Transferred: ${(networkMetrics.totalDataTransferred / 1024).toFixed(2)} KB`);
                console.log(`  - Avg Response Time: ${networkMetrics.averageResponseTime.toFixed(2)} ms`);

                // Log performance metrics
                console.log(`[${instanceLabel}] Performance Metrics:`);
                console.log(`  - Page Load Time: ${perfMetrics.pageLoadTime.toFixed(2)} ms`);
                console.log(`  - DOM Content Loaded Time: ${perfMetrics.domContentLoadedTime.toFixed(2)} ms`);
                console.log(`  - Resources Download Time: ${perfMetrics.resourcesDownloadTime.toFixed(2)} ms`);
                console.log(`  - JS Heap Used: ${(perfMetrics.jsHeapUsed / 1024 / 1024).toFixed(2)} MB`);
                console.log(`  - JS Heap Limit: ${(perfMetrics.jsHeapLimit / 1024 / 1024).toFixed(2)} MB`);
                
                return { 
                    browserType, 
                    instance, 
                    status: 'success',
                    message: `${instanceLabel} search completed successfully`,
                    networkMetrics,
                    perfMetrics
                };
            } catch (error) {
                console.log(`[${ctx.browserType}-${ctx.instance}] ✗ Failed: ${error.message}`);
                return { 
                    browserType: ctx.browserType, 
                    instance: ctx.instance, 
                    status: 'failed', 
                    message: `${ctx.browserType}-${ctx.instance} failed: ${error.message}`,
                    networkMetrics: null,
                    perfMetrics: null
                };
            }
        });

        const results = await Promise.all(searchPromises);
        
        // Generate summary report with metrics
        console.log(`\n${'='.repeat(80)}`);
        console.log(`GOOGLE SEARCH PARALLEL EXECUTION - DETAILED REPORT WITH NETWORK & PERFORMANCE`);
        console.log(`${'='.repeat(80)}`);
        
        const chromeResults = results.filter(r => r.browserType === 'Chrome');
        const edgeResults = results.filter(r => r.browserType === 'Edge');
        const successCount = results.filter(r => r.status === 'success').length;
        const failureCount = results.filter(r => r.status === 'failed').length;

        // Chrome Results with Metrics
        console.log(`\nCHROME RESULTS (${CHROME_INSTANCES} instances):`);
        console.log(`${'─'.repeat(80)}`);
        chromeResults.forEach((r, idx) => {
            const icon = r.status === 'success' ? '✓' : '✗';
            console.log(`\n  ${icon} Chrome-${r.instance}: ${r.status.toUpperCase()}`);
            
            if (r.networkMetrics) {
                console.log(`    ├─ Network Metrics:`);
                console.log(`    │  ├─ Total Requests: ${r.networkMetrics.totalRequests}`);
                console.log(`    │  ├─ Successful: ${r.networkMetrics.successfulRequests} | Failed: ${r.networkMetrics.failedRequests}`);
                console.log(`    │  ├─ Data Transferred: ${(r.networkMetrics.totalDataTransferred / 1024).toFixed(2)} KB`);
                console.log(`    │  └─ Avg Response Time: ${r.networkMetrics.averageResponseTime.toFixed(2)} ms`);
            }
            
            if (r.perfMetrics) {
                console.log(`    └─ Performance Metrics:`);
                console.log(`       ├─ Page Load Time: ${r.perfMetrics.pageLoadTime.toFixed(2)} ms`);
                console.log(`       ├─ DOM Content Loaded: ${r.perfMetrics.domContentLoadedTime.toFixed(2)} ms`);
                console.log(`       ├─ Resources Download: ${r.perfMetrics.resourcesDownloadTime.toFixed(2)} ms`);
                console.log(`       ├─ JS Heap Used: ${(r.perfMetrics.jsHeapUsed / 1024 / 1024).toFixed(2)} MB`);
                console.log(`       └─ JS Heap Limit: ${(r.perfMetrics.jsHeapLimit / 1024 / 1024).toFixed(2)} MB`);
            }
        });

        // Edge Results with Metrics
        console.log(`\nEDGE RESULTS (${EDGE_INSTANCES} instances):`);
        console.log(`${'─'.repeat(80)}`);
        edgeResults.forEach((r, idx) => {
            const icon = r.status === 'success' ? '✓' : '✗';
            console.log(`\n  ${icon} Edge-${r.instance}: ${r.status.toUpperCase()}`);
            
            if (r.networkMetrics) {
                console.log(`    ├─ Network Metrics:`);
                console.log(`    │  ├─ Total Requests: ${r.networkMetrics.totalRequests}`);
                console.log(`    │  ├─ Successful: ${r.networkMetrics.successfulRequests} | Failed: ${r.networkMetrics.failedRequests}`);
                console.log(`    │  ├─ Data Transferred: ${(r.networkMetrics.totalDataTransferred / 1024).toFixed(2)} KB`);
                console.log(`    │  └─ Avg Response Time: ${r.networkMetrics.averageResponseTime.toFixed(2)} ms`);
            }
            
            if (r.perfMetrics) {
                console.log(`    └─ Performance Metrics:`);
                console.log(`       ├─ Page Load Time: ${r.perfMetrics.pageLoadTime.toFixed(2)} ms`);
                console.log(`       ├─ DOM Content Loaded: ${r.perfMetrics.domContentLoadedTime.toFixed(2)} ms`);
                console.log(`       ├─ Resources Download: ${r.perfMetrics.resourcesDownloadTime.toFixed(2)} ms`);
                console.log(`       ├─ JS Heap Used: ${(r.perfMetrics.jsHeapUsed / 1024 / 1024).toFixed(2)} MB`);
                console.log(`       └─ JS Heap Limit: ${(r.perfMetrics.jsHeapLimit / 1024 / 1024).toFixed(2)} MB`);
            }
        });

        // Summary Statistics
        console.log(`\n${'='.repeat(80)}`);
        console.log(`OVERALL SUMMARY:`);
        console.log(`${'='.repeat(80)}`);
        console.log(`Total: ${successCount}/${TOTAL_INSTANCES} instances successful`);
        console.log(`Failed: ${failureCount}/${TOTAL_INSTANCES} instances`);

        if (successCount > 0) {
            const avgPageLoadTime = results
                .filter(r => r.perfMetrics)
                .reduce((sum, r) => sum + r.perfMetrics.pageLoadTime, 0) / successCount;
            const avgDataTransferred = results
                .filter(r => r.networkMetrics)
                .reduce((sum, r) => sum + r.networkMetrics.totalDataTransferred, 0) / successCount;

            console.log(`\nAverage Metrics Across All Successful Instances:`);
            console.log(`  - Avg Page Load Time: ${avgPageLoadTime.toFixed(2)} ms`);
            console.log(`  - Avg Data Transferred: ${(avgDataTransferred / 1024).toFixed(2)} KB`);
        }

        console.log(`${'='.repeat(80)}\n`);

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
        console.log(`Closed all browser instances`);
    });
}); 