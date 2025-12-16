import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfjsDistPath = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const workerDestPath = path.resolve(__dirname, '../public/pdf.worker.min.mjs');

async function copyWorker() {
    try {
        if (await fs.pathExists(pdfjsDistPath)) {
            await fs.copy(pdfjsDistPath, workerDestPath, { overwrite: true });
            console.log('PDF worker copied successfully!');
        } else {
            console.error('PDF worker file not found at:', pdfjsDistPath);
            // Try finding .js version if .mjs missing
            const jsPath = pdfjsDistPath.replace('.mjs', '.js');
            if (await fs.pathExists(jsPath)) {
                await fs.copy(jsPath, workerDestPath.replace('.mjs', '.js'), { overwrite: true });
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
