module.exports = {
	extends: [
		"eslint:recommended",
		"google",
		"prettier"
	],
	rules: {
		"no-console": 0,
		"max-len": [
			1,
			100,
			2
		]
	},
	parserOptions: {
		ecmaVersion: 2019,
		ecmaFeatures: {
			modules: true,
			spread: true,
			restParams: true
		},
		sourceType: "module"
	},
	env: {
		es6: true,
		amd: true,
		node: true
	},
	overrides: [
		{
			files: [
				"*.test.js"
			],
			rules: {
				"no-undef": "off"
			}
		}
	]
};
