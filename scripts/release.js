// Usage: node scripts/release.js <major|minor>
// Bumps the version (commit + git tag), builds the .vsix, pushes, and
// publishes a GitHub release with the .vsix attached.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const type = process.argv[2];
if (!['major', 'minor'].includes(type))
{
    console.error('Usage: node scripts/release.js <major|minor>');
    process.exit(1);
}

const root = path.join(__dirname, '..');
const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { cwd: root, stdio: 'inherit' });
};
const read = (cmd) => execSync(cmd, { cwd: root }).toString().trim();

if (read('git status --porcelain'))
{
    console.error('Working tree is not clean. Commit or stash your changes first.');
    process.exit(1);
}

// 1. Bump version in package.json, commit, and create the vX.Y.Z tag.
run(`npm version ${type} -m "Release %s"`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;
const vsix = `${pkg.name}-${pkg.version}.vsix`;

// 2. Build the .vsix (named <name>-<version>.vsix by vsce).
run('npm run build');

// 3. Push the commit and the tag.
run('git push --follow-tags');

// 4. Create the GitHub release with the .vsix attached.
run(`gh release create ${tag} "${vsix}" --title "${tag}" --generate-notes`);

console.log(`\nReleased ${tag}`);
