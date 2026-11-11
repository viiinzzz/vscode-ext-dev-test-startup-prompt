// Installs the .vsix matching the current package.json version into VS Code.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const vsix = path.join(root, `${pkg.name}-${pkg.version}.vsix`);

if (!fs.existsSync(vsix))
{
    console.error(`Not found: ${vsix}\nRun "npm run build" first.`);
    process.exit(1);
}

execSync(`code --install-extension "${vsix}" --force`, { stdio: 'inherit' });
