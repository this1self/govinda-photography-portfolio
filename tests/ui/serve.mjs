import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
const headerLines = (await readFile(path.join(root, '_headers'), 'utf8')).split('\n');
const globalHeaders = {};
for (const line of headerLines.slice(1)) {
    if (!line.trim()) break;
    const match = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (match) globalHeaders[match[1]] = match[2];
}
const server = http.createServer(async (request, response) => {
    try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
        let file = path.resolve(root, '.' + pathname);
        if (file !== root && !file.startsWith(root + path.sep)) {
            response.writeHead(403).end(); return;
        }
        if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
        let bytes;
        let status = 200;
        try { bytes = await readFile(file); }
        catch { file = path.join(root, '404.html'); bytes = await readFile(file); status = 404; }
        response.writeHead(status, { ...globalHeaders, 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
        response.end(bytes);
    } catch { response.writeHead(400).end(); }
});
server.listen(4321, '127.0.0.1', () => console.log('Portfolio UI test server: http://127.0.0.1:4321'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
