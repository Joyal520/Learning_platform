const { pathToFileURL } = require('url');
const path = require('path');

module.exports = async function handler(req, res) {
    const modulePath = path.join(__dirname, '..', 'features', 'exam2', 'exam-engine.mjs');
    const { handleExamApiRequest } = await import(pathToFileURL(modulePath).href);
    return handleExamApiRequest(req, res);
};
