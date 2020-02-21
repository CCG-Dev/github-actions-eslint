const core = require('@actions/core');
const github = require('@actions/github');
const CLIEngine = require('eslint').CLIEngine;
const path = require('path');

const {
	GITHUB_REPOSITORY,
	GITHUB_SHA: headSha,
	GITHUB_WORKSPACE,
} = process.env;

const [owner, repo] = GITHUB_REPOSITORY.split('/');

const checkName = 'ESLint check';

const run = async () => {
	const token = core.getInput('repo-token', { required: true });

	const client = new github.GitHub(token);

	// create a check
	const { data: { id } } = await client.checks.create({
		owner,
		repo,
		head_sha: headSha,
		name: checkName,
	});

	try {
		// run eslint
		const { conclusion, output } = eslint();
		console.log(output.summary);

		// update check
		await batchChecksUpdate(client, {
			conclusion,
			output,
			owner,
			repo,
			check_run_id: id,
		});

		if (conclusion === 'failure') {
			process.exit(78);
		}
	} catch (error) {
		await client.checks.update({
			owner,
			repo,
			check_run_id: id,
			conclusion: 'failure',
		});
		console.error(error);
		setFailed(error);
	}
}

const eslint = () => {
	let cwd = core.getInput('working-directory');

	if (cwd && !path.isAbsolute(cwd)) {
		cwd = path.resolve(cwd);
	} else if (!cwd) {
		cwd = process.cwd();
	}

	core.debug(`Starting lint engine with cwd: ${cwd}`);

	const linter = new CLIEngine({
		extensions: ['.js', '.jsx'],
		ignorePath: '.gitignore',
		useEslintrc: false,
		cwd,
	});

	const report = linter.executeOnFiles(['.']);

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

const batchChecksUpdate = async (client, params) => {
	if (params.output.annotations.length > 50) {
		const batches = chunk(params.output.annotations);

		batches.map((batch) => {
			return client.checks.update({
				...params,
				output: {
					...params.output,
					annotations: batch,
				},
			});
		});

		return Promise.all(batches);
	} else {
		return client.checks.update(params);
	}
}

const chunk = (arr, size) =>
	Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
		arr.slice(i * size, i * size + size),
	);


const setFailed = (error) => {
	core.error(error.message);
	core.setFailed(error.message);
}

run().catch(err => setFailed(err));
