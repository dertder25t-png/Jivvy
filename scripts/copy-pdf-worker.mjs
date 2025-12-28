import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfjsDistPath = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const workerDestPath = path.resolve(__dirname, '../public/pdf.worker.min.mjs');

function copyWorker() {
    try {
        // Ensure public directory exists
        const publicDir = path.dirname(workerDestPath);
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }

        if (fs.existsSync(pdfjsDistPath)) {
            fs.copyFileSync(pdfjsDistPath, workerDestPath);
            console.log('PDF worker copied successfully!');
        } else {
            console.error('PDF worker file not found at:', pdfjsDistPath);
            // Try finding .js version if .mjs missing
            const jsPath = pdfjsDistPath.replace('.mjs', '.js');
            if (fs.existsSync(jsPath)) {
                const destJs = workerDestPath.replace('.mjs', '.js');
                fs.copyFileSync(jsPath, destJs);
                console.log('PDF worker (JS) copied successfully!');
            } else {
                console.error('Could not find PDF worker file.');
                process.exit(1);
            }
        }
    } catch (err) {
        console.error('Error copying PDF worker:', err);
        process.exit(1);
    }
}

copyWorker();
