const fs = require('fs');
const path = require('path');

const core = require('@actions/core');
const micromatch = require('micromatch');

import { fetchFilesBatchPR, fetchFilesBatchCommit } from './api';

export const filterFiles = (files, globs) => {
	const result = [];
	const filtered = micromatch(files, globs);

	for (const file of filtered) {
		if (fs.existsSync(path.resolve(file))) {
			result.push(path.resolve(file));
		}
	}

	return result;
};

const getFilesFromPR = async (client, prNumber) => {
	let files = [];
	let hasNextPage = true;
	let startCursor = undefined;

	while (hasNextPage) {
		try {
			const result = await fetchFilesBatchPR(client, prNumber, startCursor);

			files = files.concat(result.files);
			hasNextPage = result.hasNextPage;
			startCursor = result.endCursor;
		} catch (err) {
			core.error(err);
			core.setFailed('Error occurred getting changed files.');
			hasNextPage = false;
		}
	}

	return files;
}

export const getChangedFiles = async (
	client,
	filesGlob,
	prNumber,
	sha
) => {
	let files = [];

	if (prNumber) {
		files = await getFilesFromPR(client, prNumber);
	} else {
		files = await fetchFilesBatchCommit(client, sha);
	}

	return filterFiles(files, filesGlob);
}
