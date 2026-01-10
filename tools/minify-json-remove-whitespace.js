const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
    console.error('Usage: node tools/minify_json.js <input_file> <output_file>');
    process.exit(1);
}

const inputPath = path.resolve(inputFile);
const outputPath = path.resolve(outputFile);

console.log(`Reading from: ${inputPath}`);

fs.readFile(inputPath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }

    try {
        const json = JSON.parse(data);
        const minified = JSON.stringify(json); // No spacing arguments = minified

        console.log(`Writing to: ${outputPath}`);
        fs.writeFile(outputPath, minified, (err) => {
            if (err) {
                console.error(`Error writing file: ${err.message}`);
                process.exit(1);
            }
            console.log('Minification complete.');
        });
    } catch (parseError) {
        console.error(`Error parsing JSON: ${parseError.message}`);
        process.exit(1);
    }
});
