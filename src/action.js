const core = require('@actions/core');
const github = require('@actions/github');
const eslint = require('eslint');
const path = require('path');

const getChangedFiles = require('./fileUtils').getChangedFiles;

// const {
// 	GITHUB_REPOSITORY,
// 	GITHUB_SHA: headSha,
// 	GITHUB_WORKSPACE,
// } = process.env;

const { GITHUB_WORKSPACE } = process.env;
const OWNER = github.context.repo.owner;
const REPO = github.context.repo.repo;
const CHECK_NAME = 'ESLint';

// const [owner, repo] = GITHUB_REPOSITORY.split('/');

// const checkName = 'ESLint check';

const getPrNumber = () => {
	const pullRequest = github.context.payload.pull_request;

	if (!pullRequest) {
		return;
	}

	return pullRequest.number;
};

const getSha = () => {
	const pullRequest = github.context.payload.pull_request;

	if (!pullRequest) {
		return github.context.sha;
	}

	return pullRequest.head.sha;
};

const processArrayInput = (key, required = false) => {
	return core
		.getInput(key, { required })
		.split(',')
		.map(e => e.trim());
};

const lint = (files) => {
	const extensions = processArrayInput('extensions', true);
	const ignoreGlob = processArrayInput('ignore');
	let cwd = core.getInput('working-directory');

	if (cwd && !path.isAbsolute(cwd)) {
		cwd = path.resolve(cwd);
	} else if (!cwd) {
		cwd = process.cwd();
	}

	core.debug(`Starting lint engine with cwd: ${cwd}`);

	const linter = new eslint.CLIEngine({
		extensions,
		ignorePattern: ignoreGlob,
		cwd,
	});

	return linter.executeOnFiles(files);
}

const processReport = (report) => {
	const { results } = report;
	const annotations = [];

	let errorCount = 0;

	for (const result of results) {
		const { filePath, messages } = result;

		for (const lintMessage of messages) {
			const { line, severity, ruleId, message } = lintMessage;

			core.debug(`Level ${severity} issue found on line ${line} [${ruleId}] ${message}`);

			// if ruleId is null, it's likely a parsing error, so let's skip it
			if (!ruleId) {
				continue;
			}

			if (severity === 2) {
				errorCount++;
			}

			annotations.push({
				path: filePath.replace(`${GITHUB_WORKSPACE}/`, ''),
				start_line: line,
				end_line: line,
				annotation_level: severity === 2 ? 'failure' : 'warning',
				message: `[${ruleId}] ${message}`,
			});
		}
	}

	return {
		conclusion: errorCount > 0 ? 'failure' : 'success',
		output: {
			title: CHECK_NAME,
			summary: `${errorCount} error(s) found`,
			annotations,
		},
	};
}

const run = async () => {
	const token = core.getInput('repo-token', { required: true });
	const filesGlob = processArrayInput('files');
	const prNumber = getPrNumber();

	try {
		const oktokit = new github.GitHub(token);
		core.info(`PR: ${prNumber}, SHA: ${getSha()}`);
		core.debug('Fetching files to lint.');
		const files = await getChangedFiles(oktokit, filesGlob, prNumber, getSha());
		core.debug(`${files.length} files match ${filesGlob}.`);

		if (files.length > 0) {
			const {
				data: { id: checkId },
			} = await oktokit.checks.create({
				owner: OWNER,
				repo: REPO,
				started_at: new Date().toISOString(),
				head_sha: getSha(),
				status: 'in_progress',
				name: CHECK_NAME,
			});
			const report = lint(files);
			const payload = processReport(report);
			const maxChunk = 50;

			if (payload.output) {
				let annotationLength = 0;
				if (payload.output.annotations) {
					annotationLength = Array.isArray(payload.output.annotations)
						? payload.output.annotations.length
						: 0;
				}

				if (annotationLength > maxChunk) {
					const chunks = Math.ceil(annotationLength / maxChunk);
					core.info(`There were ${annotationLength} annotations, splitting into ${chunks} requests`);
					for (let index = 0; index < chunks; index++) {
						const startIndex = index * maxChunk;
						const endIndex = startIndex + maxChunk;
						core.info(`Applying annotations ${startIndex} to ${startIndex + maxChunk}...`);
						const returnValue = await oktokit.checks.update({
							owner: OWNER,
							repo: REPO,
							completed_at: new Date().toISOString(),
							status: endIndex <= annotationLength ? 'in_progress' : 'completed',
							check_run_id: checkId,
							conclusion: payload.conclusion,
							output: {
								...payload.output,
								annotations: payload.output.annotations.slice(startIndex, endIndex),
							},
						});
						core.debug(`Got response with status of ${returnValue.status}, ${returnValue.data}`);
					}
				} else if (annotationLength <= maxChunk) {
					await oktokit.checks.update({
						owner: OWNER,
						repo: REPO,
						completed_at: new Date().toISOString(),
						status: 'completed',
						check_run_id: checkId,
						...payload,
					});
				}
			}
		} else {
			core.info('No files to lint.');
		}
	} catch (err) {
		core.setFailed(err.message ? err.message : 'Error linting files.');
	}
}

run();

// const run = async () => {
// 	const token = core.getInput('repo-token', { required: true });

// 	const client = new github.GitHub(token);

// 	// create a check
// 	const { data: { id } } = await client.checks.create({
// 		owner,
// 		repo,
// 		head_sha: headSha,
// 		name: checkName,
// 	});

// 	try {
// 		// run eslint
// 		const { conclusion, output } = eslint();
// 		console.log(output.summary);

// 		// update check
// 		await batchChecksUpdate(client, {
// 			conclusion,
// 			output,
// 			owner,
// 			repo,
// 			check_run_id: id,
// 		});

// 		if (conclusion === 'failure') {
// 			process.exit(78);
// 		}
// 	} catch (error) {
// 		await client.checks.update({
// 			owner,
// 			repo,
// 			check_run_id: id,
// 			conclusion: 'failure',
// 		});
// 		console.error(error);
// 		setFailed(error);
// 	}
// }

// const eslint = () => {
// 	let cwd = core.getInput('working-directory');

// 	if (cwd && !path.isAbsolute(cwd)) {
// 		cwd = path.resolve(cwd);
// 	} else if (!cwd) {
// 		cwd = process.cwd();
// 	}

// 	core.debug(`Starting lint engine with cwd: ${cwd}`);

// 	const linter = new CLIEngine({
// 		extensions: ['.js', '.jsx'],
// 		ignorePath: '.gitignore',
// 		useEslintrc: false,
// 		cwd,
// 	});

// 	const report = linter.executeOnFiles(['.']);

// 	// fixableErrorCount, fixableWarningCount are available too
// 	const { results, errorCount, warningCount } = report;

// 	const levels = ['', 'warning', 'failure'];

// 	const annotations = [];
// 	for (const result of results) {
// 		const { filePath, messages } = result;
// 		const resultPath = filePath.substring(GITHUB_WORKSPACE.length + 1);
// 		for (const msg of messages) {
// 			const { line, severity, ruleId, message } = msg;
// 			const annotationLevel = levels[severity];
// 			annotations.push({
// 				path: resultPath,
// 				start_line: line,
// 				end_line: line,
// 				annotation_level: annotationLevel,
// 				message: `[${ruleId}] ${message}`
// 			});
// 		}
// 	}

// 	return {
// 		conclusion: errorCount > 0 ? 'failure' : 'success',
// 		output: {
// 			title: checkName,
// 			summary: `${errorCount} error(s), ${warningCount} warning(s) found`,
// 			annotations
// 		}
// 	};
// }

// const batchChecksUpdate = async (client, params) => {
// 	if (params.output.annotations.length > 50) {
// 		const batches = chunk(params.output.annotations);

// 		batches.map((batch) => {
// 			return client.checks.update({
// 				...params,
// 				output: {
// 					...params.output,
// 					annotations: batch,
// 				},
// 			});
// 		});

// 		return Promise.all(batches);
// 	} else {
// 		return client.checks.update(params);
// 	}
// }

// const chunk = (arr, size) =>
// 	Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
// 		arr.slice(i * size, i * size + size),
// 	);


// const setFailed = (error) => {
// 	core.error(error.message);
// 	core.setFailed(error.message);
// }

// run().catch(err => setFailed(err));
