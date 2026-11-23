// @firebase/util ships this entrypoint as untransformed ESM, which Jest cannot
// parse. It only supplies build-time defaults that tests never rely on.
module.exports = {
    getDefaultsFromPostinstall: () => undefined,
};
