const core = require('@actions/core');
const github = require('@actions/github');

const OWNER = github.context.repo.owner;
const REPO = github.context.repo.repo;

export const fetchFilesBatchPR = async (
	client,
	prNumber,
	startCursor,
	owner = OWNER,
	repo = REPO
) => {
	const { repository } = await client.graphql(
		`
    query ChangedFilesBatch($owner: String!, $repo: String!, $prNumber: Int!, $startCursor: String) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          files(first: 100, after: $startCursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
            edges {
              cursor
              node {
                path
              }
            }
          }
        }
      }
    }
  `,
		{ owner, repo, prNumber, startCursor }
	);

	const pr = repository.pullRequest;

	if (!pr || !pr.files) {
		core.info(`No PR or PR files detected`);
		return { files: [] };
	}

	core.info(`PR with files detected: ${pr.files.edges.map(e => e.node.path)}`);

	return {
		...pr.files.pageInfo,
		files: pr.files.edges.map(e => e.node.path),
	};
}

export const fetchFilesBatchCommit = async (
	client,
	sha,
	owner = OWNER,
	repo = REPO
) => {
	try {
		const resp = await client.repos.getCommit({
			owner,
			repo,
			ref: sha,
		});

		const filesChanged = resp.data.files.map(f => f.filename);

		core.info(`Files changed: ${filesChanged}`);

		return filesChanged;
	} catch (err) {
		core.error(err);
		return [];
	}
}
