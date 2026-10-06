'use strict';
// Post-measurement structural/render QA only. This does not claim human review.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const now = () => new Date().toISOString();
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sha = file => {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) h.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
};
const existsWithin = (root, file) => file === root || file.startsWith(root + path.sep);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function bounded(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(resolve, ms); })]); }
  finally { clearTimeout(timer); }
}

function argumentsFrom(argv) {
  const args = {config: 'config/local.json'};
  if (argv.includes('--help')) return {help: true};
  for (let i = 0; i < argv.length; i++) {
    assert(['--config', '--run-dir'].includes(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith('--'), 'Use --config FILE --run-dir RUN');
    args[argv[i].slice(2)] = argv[++i];
  }
  assert(args['run-dir'], '--run-dir is required');
  return args;
}

async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  if (args.help) { console.log('node analysis/validate_report.cjs --config config/local.json --run-dir results/RUN/formal\nRuns after timing and quality. Uses configured Chrome with --disable-gpu; writes validation/report-visual-qa.json and report-preview/.'); return; }
  const config = read(path.resolve(ROOT, args.config));
  const run = path.resolve(ROOT, args['run-dir']);
  const reportRoot = path.join(run, 'analysis');
  const validation = path.join(run, 'validation');
  const screenshotRoot = path.join(validation, 'report-preview');
  const output = path.join(validation, 'report-visual-qa.json');
  for (const file of [path.join(ROOT, 'results/gpu-session.lock'), path.join(run, 'gpu-session.lock'), path.join(path.dirname(run), 'gpu-session.lock')]) assert(!fs.existsSync(file), 'GPU collection is locked: ' + file);
  const runtime = read(path.join(run, 'runtime-cleanup.json'));
  assert(runtime.complete === true && runtime.passed === true && runtime.gpuLockReleased === true && runtime.finishedAt && runtime.children.every(child => child.alive === false), 'Performance collection/cleanup must be complete');
  assert(read(path.join(reportRoot, 'analysis-qa.json')).passed === true, 'Analysis QA has not passed');
  const buildPath = path.join(reportRoot, 'build-receipt.json');
  const build = read(buildPath);
  assert(build.complete === true, 'Report build incomplete');
  for (const item of build.outputs) {
    const file = path.resolve(run, item.path);
    assert(existsWithin(reportRoot, file) && fs.statSync(file).isFile(), 'Report output escapes analysis directory');
    assert(sha(file) === item.sha256, 'Report changed since build receipt: ' + item.path);
  }
  fs.mkdirSync(screenshotRoot, {recursive: true});
  const qa = {schema: 'mac-portable-report-render-qa-v1', passed: false, complete: false,
    startedAt: now(), humanVisualReview: false, configPath: path.resolve(ROOT, args.config), runDirectory: run,
    reportBuildSha256: sha(buildPath), analysisQaSha256: sha(path.join(reportRoot, 'analysis-qa.json')),
    scriptSha256: sha(__filename), browserArgs: ['--disable-gpu'], reportOutputFilesVerified: build.outputs.length,
    pageChecks: [], links: [], screenshots: [], consoleErrors: [], pageErrors: [], requestFailures: [],
    externalRequests: [], ownedCleanup: {complete: false}};
  let server, browserServer, browser, context, interrupted = null, closePromise;
  const sockets = new Set();
  const children = [];
  async function closeOwned() {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      if (browser) await bounded(browser.close().catch(() => {}), 10000);
      if (browserServer) {
        await bounded(browserServer.close().catch(() => {}), 10000);
        const child = browserServer.process();
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        if (child.exitCode === null && child.signalCode === null) await bounded(new Promise(resolve => child.once('exit', resolve)), 3000);
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        if (child.exitCode === null && child.signalCode === null) await bounded(new Promise(resolve => child.once('exit', resolve)), 3000);
      }
      for (const socket of sockets) socket.destroy();
      if (server?.listening) await new Promise(resolve => server.close(resolve));
    })();
    return closePromise;
  }
  const onSignal = signal => {
    interrupted = signal; qa.interruptedBy = signal;
    // Abort active page work, while final cleanup retains ownership of any
    // server/browser whose asynchronous launch finishes after this signal.
    if (browser) browser.close().catch(() => {});
  };
  const onSigint = () => onSignal('SIGINT');
  const onSigterm = () => onSignal('SIGTERM');
  process.on('SIGINT', onSigint); process.on('SIGTERM', onSigterm);
  const guard = () => { assert(!interrupted, 'Interrupted by ' + interrupted); };
  try {
    const types = {'.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.tex': 'text/plain; charset=utf-8'};
    server = http.createServer((req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const file = path.resolve(reportRoot, '.' + pathname);
        assert(existsWithin(reportRoot, file) && fs.existsSync(file) && fs.statSync(file).isFile(), 'Missing/escaped report asset');
        assert(existsWithin(reportRoot, fs.realpathSync(file)), 'Symlink escapes report directory');
        res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
        fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const base = 'http://127.0.0.1:' + server.address().port;
    qa.server = {host: '127.0.0.1', port: server.address().port, root: reportRoot};
    const moduleName = config.playwrightModule || 'playwright';
    const resolvedModule = path.isAbsolute(moduleName) || moduleName.startsWith('.') ? path.resolve(ROOT, moduleName) : moduleName;
    const {chromium} = require(resolvedModule);
    guard();
    const executable = path.resolve(ROOT, config.chromeExecutable);
    qa.browserExecutable = executable; qa.browserExecutableSha256 = sha(executable);
    browserServer = await chromium.launchServer({executablePath: executable, headless: true, args: ['--disable-gpu']});
    children.push({kind: 'report-only-chrome', pid: browserServer.process().pid});
    guard();
    browser = await chromium.connect(browserServer.wsEndpoint());
    guard();
    qa.browserVersion = browser.version();
    context = await browser.newContext({viewport: {width: 1400, height: 1000}, deviceScaleFactor: 1});
    guard();
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', error => qa.pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') qa.consoleErrors.push(message.text()); });
    page.on('requestfailed', request => qa.requestFailures.push({url: request.url(), error: request.failure()?.errorText}));
    page.on('request', request => { if (!request.url().startsWith(base + '/')) qa.externalRequests.push(request.url()); });
    const assets = new Map();
    async function shot(name, locator) {
      guard();
      const file = path.join(screenshotRoot, name + '.png');
      if (locator) await locator.screenshot({path: file}); else await page.screenshot({path: file});
      qa.screenshots.push({path: path.relative(run, file), sha256: sha(file), bytes: fs.statSync(file).size});
    }
    for (const viewport of [{name: 'desktop', width: 1400, height: 1000}, {name: 'mobile', width: 390, height: 844}]) {
      await page.setViewportSize({width: viewport.width, height: viewport.height});
      for (const name of ['index.html', 'captures.html']) {
        guard();
        const response = await page.goto(base + '/' + name, {waitUntil: 'load'});
        assert(response.status() === 200, 'Report page did not load');
        await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; });
        await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
        const observed = await page.evaluate(() => ({
          innerWidth, clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth, rootScrollWidth: document.documentElement.scrollWidth,
          images: [...document.images].map(i => ({src: i.getAttribute('src'), naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight})),
          references: [...document.querySelectorAll('[href],[src]')].flatMap(node => ['href', 'src'].filter(k => node.hasAttribute(k)).map(k => ({tag: node.tagName, attribute: k, value: node.getAttribute(k)}))),
          anchors: [...document.querySelectorAll('[id]')].map(n => n.id),
        }));
        assert(observed.innerWidth === viewport.width && observed.clientWidth === viewport.width, 'Viewport CSS width differs; check mobile viewport metadata');
        assert(observed.bodyScrollWidth <= viewport.width + 1 && observed.rootScrollWidth <= viewport.width + 1, 'Body horizontal overflow: ' + viewport.name + '/' + name);
        assert(observed.images.length > 0 && observed.images.every(image => image.naturalWidth > 0), 'Missing decoded image');
        for (const reference of observed.references) {
          const value = reference.value;
          assert(value && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith('//') && !value.startsWith('/'), 'Asset/link must be relative: ' + value);
          const target = new URL(value, base + '/' + name);
          assert(target.origin === base, 'External asset/link');
          const file = path.resolve(reportRoot, '.' + decodeURIComponent(target.pathname));
          assert(existsWithin(reportRoot, file) && fs.existsSync(file) && fs.statSync(file).isFile(), 'Relative reference escapes or is missing: ' + value);
          assert(existsWithin(reportRoot, fs.realpathSync(file)), 'Reference symlink escapes report');
          if (target.hash && target.pathname === '/' + name) assert(observed.anchors.includes(decodeURIComponent(target.hash.slice(1))), 'Missing local anchor: ' + value);
          const normalized = target.pathname;
          if (!assets.has(normalized)) {
            const fetched = await context.request.get(base + normalized);
            assert(fetched.status() === 200, 'Linked asset is unreachable: ' + value);
            await fetched.dispose();
            assets.set(normalized, {path: path.relative(reportRoot, file), status: 200, sha256: sha(file), bytes: fs.statSync(file).size});
          }
        }
        qa.pageChecks.push({page: name, viewport, images: observed.images.length, references: observed.references.length,
          bodyScrollWidth: observed.bodyScrollWidth, rootScrollWidth: observed.rootScrollWidth,
          allImagesDecoded: true, bodyOverflow: false, tableScrollAllowed: true});
        await page.evaluate(() => scrollTo(0, 0));
        await shot(viewport.name + '-' + name.replace('.html', '') + '-top');
        if (name === 'index.html' && viewport.name === 'desktop') {
          await shot('desktop-main-speed-table', page.locator('#e2e'));
          await shot('desktop-completion-fps-plot', page.locator('img[src="full-model-completed-fps.png"]'));
          await shot('desktop-quality-table-and-plot', page.locator('#quality'));
          await shot('desktop-timer-domain-diagnostics', page.locator('#timer-domains'));
        }
        if (name === 'captures.html') await shot(viewport.name + '-gallery-first-scene', page.locator('section').first());
      }
    }
    qa.links = [...assets.values()].sort((a, b) => a.path.localeCompare(b.path));
    qa.relativeAssetsVerified = qa.links.length;
    assert(!qa.pageErrors.length && !qa.consoleErrors.length && !qa.requestFailures.length && !qa.externalRequests.length, 'Page JavaScript/console/network errors or external resources');
    guard(); qa.complete = true;
  } catch (error) {
    qa.error = error.stack || String(error);
    process.exitCode = 1;
  } finally {
    await closeOwned();
    qa.ownedCleanup = {complete: !server?.listening && children.every(child => !alive(child.pid)),
      serverListening: Boolean(server?.listening), children: children.map(child => ({...child, alive: alive(child.pid)})),
      noGpuCollectionStarted: true, finishedAt: now()};
    qa.finishedAt = now();
    qa.passed = qa.complete && qa.ownedCleanup.complete && !interrupted && !qa.error;
    if (!qa.passed) process.exitCode = interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : 1;
    fs.writeFileSync(output, JSON.stringify(qa, null, 2) + '\n');
    process.removeListener('SIGINT', onSigint); process.removeListener('SIGTERM', onSigterm);
  }
  console.log(JSON.stringify({passed: qa.passed, receipt: output, screenshots: qa.screenshots.length, humanVisualReview: false}));
}

module.exports = {argumentsFrom};
if (require.main === module) main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
