const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
    // The config files are CommonJS tooling, not application source.
    { ignores: ["dist/*", "coverage/*", "*.config.js"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
);
