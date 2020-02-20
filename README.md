# ESlint Github Action

This action executes ESlint check using the repo's eslint config and provides annotations.

## Inputs

### `repo-token`

**Required** The GITHUB_TOKEN secret.

## Example usage

uses: ccg-dev/github-actions-eslint@master
with:
	repo-token: 'YOURTOKENHERE'
