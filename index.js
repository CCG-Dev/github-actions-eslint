const core = require('@actions/core');
const github = require('@actions/github');

const {
	GITHUB_ACTOR: owner,
	GITHUB_REPOSITORY: repo,
	GITHUB_SHA: head_sha,
	GITHUB_WORKSPACE,
} = process.env;

async function run() {
	const token = core.getInput('repo-token', { required: true });

	const client = new github.GitHub(token);

	core.debug({
		token,
		owner,
		repo,
		head_sha,
		GITHUB_WORKSPACE,
	})

	// create a check
	const data = await client.checks.create({
		owner,
		repo,
		head_sha,
		name: 'ESLint Check',
	});

	core.debug(data);

	const { data: { id: check_run_id } } = await client.checks.create({
		owner,
		repo,
		head_sha,
		name: 'ESLint Check',
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
		core.error(error);
		core.setFailed(error.message);
	}
}

function eslint() {
	const eslint = require('eslint');

	const cli = new eslint.CLIEngine({
		extensions: ['.js', '.jsx', '.tsx'],
		ignorePath: '.gitignore'
	});

	const report = cli.executeOnFiles(['.']);

	// fixableErrorCount, fixableWarningCount are available too
	const { results, errorCount, warningCount } = report;

	const levels = ['', 'warning', 'failure'];

	const annotations = [];
	for (const result of results) {
		const { filePath, messages } = result;
		const path = filePath.substring(GITHUB_WORKSPACE.length + 1);
		for (const msg of messages) {
			const { line, severity, ruleId, message } = msg;
			const annotationLevel = levels[severity];
			annotations.push({
				path,
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

run();
