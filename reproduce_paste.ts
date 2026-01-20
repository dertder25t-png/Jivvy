
import { parseHtmlToBlocks } from './lib/html-parser';

const googleDocsSimulatedHtml = `
<html>
<body>
    <p style="margin-left: 0pt;">Part 1: The Modern Era</p>
    <p style="margin-left: 36pt;">2 events marking the Modern Era?</p>
    <ul style="margin-left: 72pt;">
        <li><span style="font-weight: 400;">Renaissance</span></li>
        <li><span style="font-weight: 400;">Reformation</span></li>
    </ul>
    <p style="margin-left: 0pt;">Part 2: The Thirty Years War</p>
    <p style="margin-left: 36pt;">Dates?</p>
    <p style="margin-left: 72pt;">1618-1648</p>
</body>
</html>
`;

const blocks = parseHtmlToBlocks(googleDocsSimulatedHtml);
console.log(JSON.stringify(blocks, null, 2));
