const ApiError = require('../utils/ApiError');

function friendly(issue) {
  if (/received undefined/i.test(issue.message)) return 'This field is required.';
  if (/^Invalid input/i.test(issue.message)) return 'This value is not valid.';
  return issue.message;
}

function formatIssues(issues) {
  const details = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!details[key]) details[key] = friendly(issue);
  }
  return details;
}

// Validates body / query / params with Zod schemas. Unknown keys are dropped,
// and handlers read only from req.valid — which is the mass-assignment guard.
function validate(schemas) {
  return function validator(req, _res, next) {
    req.valid = req.valid || {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', formatIssues(result.error.issues));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

module.exports = { validate, formatIssues };
