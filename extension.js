const vscode = require('vscode');

const DEV_LABEL = 'npm: dev';
const TEST_LABEL = 'npm: test';
const COMBINED_LABEL = 'dev + test';

const TASK_TEMPLATES = [
    {
        label: DEV_LABEL,
        type: 'shell',
        command: 'npm run dev',
        isBackground: true,
        problemMatcher: []
    },
    {
        label: TEST_LABEL,
        type: 'shell',
        command: 'npm run test',
        presentation: {
            panel: 'new',
            reveal: 'always',
            focus: false
        },
        problemMatcher: []
    },
    {
        label: COMBINED_LABEL,
        dependsOn: [DEV_LABEL, TEST_LABEL],
        dependsOrder: 'parallel'
    }
];

/**
 * Reads package.json from the workspace folder.
 * Returns the parsed object, or undefined if missing/unreadable.
 */
async function readPackageJson(folder) {
    try {
        const uri = vscode.Uri.joinPath(folder.uri, 'package.json');
        const bytes = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(bytes).toString('utf8'));
    } catch {
        return undefined;
    }
}

/**
 * True only if package.json has both a "dev" and a "test" script.
 */
function hasDevAndTestScripts(pkg) {
    const scripts = pkg && typeof pkg === 'object' ? pkg.scripts : undefined;
    return Boolean(
        scripts &&
        typeof scripts === 'object' &&
        scripts.dev &&
        scripts.test
    );
}

/**
 * Adds any missing task (by label) to .vscode/tasks.json.
 * Uses the VS Code configuration API, which edits tasks.json in place
 * (preserving comments and formatting) and creates it if needed.
 */
async function ensureTasks(folder) {
    const config = vscode.workspace.getConfiguration('tasks', folder.uri);
    const inspected = config.inspect('tasks');
    const existing = Array.isArray(inspected?.workspaceFolderValue)
        ? inspected.workspaceFolderValue
        : [];

    const existingLabels = new Set(
        existing.map(t => t && (t.label ?? t.taskName)).filter(Boolean)
    );

    const missing = TASK_TEMPLATES.filter(t => !existingLabels.has(t.label));
    if (missing.length === 0) {
        return;
    }

    const target = vscode.ConfigurationTarget.WorkspaceFolder;

    if (!config.inspect('version')?.workspaceFolderValue) {
        await config.update('version', '2.0.0', target);
    }
    await config.update('tasks', [...existing, ...missing], target);
}

async function runTask(taskName) {
    await vscode.commands.executeCommand(
        'workbench.action.tasks.runTask',
        taskName
    );
}

async function askToStartTask() {
    const config = vscode.workspace.getConfiguration('devTestStartup');
    const prompt = config.get('prompt', 'Do you want to start dev + test?');
    const taskName = config.get('taskName', COMBINED_LABEL);

    // Previously answered "Yes": start automatically without asking.
    if (config.get('autostart', false) === true) {
        await runTask(taskName);
        return;
    }

    const choice = await vscode.window.showInformationMessage(
        prompt,
        'Yes',
        'No'
    );

    if (choice === 'Yes') {
        // Remember the answer in the workspace settings (.vscode/settings.json).
        try {
            await config.update(
                'autostart',
                true,
                vscode.ConfigurationTarget.Workspace
            );
        } catch (err) {
            vscode.window.showWarningMessage(
                `Dev + Test: could not save autostart setting (${err.message || err})`
            );
        }
        await runTask(taskName);
    }
}

/**
 * Full flow: check package.json, make sure tasks exist, then ask.
 * Does nothing if the workspace has no package.json or lacks a
 * "dev" or "test" script.
 */
async function setupAndAsk() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }

    const pkg = await readPackageJson(folder);
    if (!hasDevAndTestScripts(pkg)) {
        return;
    }

    try {
        await ensureTasks(folder);
    } catch (err) {
        vscode.window.showErrorMessage(
            `Dev + Test: could not update tasks.json (${err.message || err})`
        );
        return;
    }

    await askToStartTask();
}

function activate(context) {
    const command = vscode.commands.registerCommand(
        'devTestStartup.start',
        setupAndAsk
    );
    context.subscriptions.push(command);

    // Run once when the extension activates for a workspace.
    setupAndAsk();
}

function deactivate() {}

module.exports = { activate, deactivate };
