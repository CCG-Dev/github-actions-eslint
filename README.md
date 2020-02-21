# ESlint Github Action

This action executes ESlint check using the repo's eslint config and provides annotations.

## Inputs

### `repo-token`

**Required** The GITHUB_TOKEN secret.

## Example usage

```
name: ESLint

on: pull_request

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1
      - uses: ccg-dev/github-actions-eslint@master
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```
