const core = require('@actions/core');
const github = require('@actions/github');
const CLIEngine = require('eslint').CLIEngine;
const path = require('path');

const {
	GITHUB_REPOSITORY,
	GITHUB_SHA: head_sha,
	GITHUB_WORKSPACE,
} = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');

const checkName = 'ESLint check';

async function run() {
	const token = core.getInput('repo-token', { required: true });

	const client = new github.GitHub(token);

	// create a check
	const { data: { id: check_run_id } } = await client.checks.create({
		owner,
		repo,
		head_sha,
		name: checkName,
	});

	try {
		// run eslint
		const { conclusion, output } = eslint();
		console.log(output.summary);

		// update check
		await client.checks.update({
			owner,
			repo,
			check_run_id,
			conclusion,
			output,
		});

		if (conclusion === 'failure') {
			process.exit(78);
		}
	} catch (error) {
		await client.checks.update({
			owner,
			repo,
			check_run_id,
			conclusion: 'failure',
		});
		console.error(error);
		setFailed(error);
	}
}

function eslint() {
	let cwd = core.getInput('working-directory');

	if (cwd && !path.isAbsolute(cwd)) {
		cwd = path.resolve(cwd);
	} else if (!cwd) {
		cwd = process.cwd();
	}

	core.debug(`Starting lint engine with cwd: ${cwd}`);

	const cli = new CLIEngine({
		extensions: ['.js'],
		ignorePath: '.gitignore',
		cwd,
	});

	const report = cli.executeOnFiles(['.']);

	// fixableErrorCount, fixableWarningCount are available too
	const { results, errorCount, warningCount } = report;

	const levels = ['', 'warning', 'failure'];

	const annotations = [];
	for (const result of results) {
		const { filePath, messages } = result;
		const resultPath = filePath.substring(GITHUB_WORKSPACE.length + 1);
		for (const msg of messages) {
			const { line, severity, ruleId, message } = msg;
			const annotationLevel = levels[severity];
			annotations.push({
				path: resultPath,
				start_line: line,
				end_line: line,
				annotation_level: annotationLevel,
				message: `[${ruleId}] ${message}`
			});
		}
	}

	return {
		conclusion: errorCount > 0 ? 'failure' : 'success',
		output: {
			title: checkName,
			summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
			annotations
		}
	};
}

function setFailed(error) {
	core.error(error.message);
	core.setFailed(error.message);
}

run().catch(err => setFailed(err));
