function paging({ page = 1, limit = 12 } = {}) {
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { paging };
