const mongoose = require("mongoose");

function buildInvoiceFilter(companyId, query) {
  const { client, status, startDate, endDate } = query;
  const filter = { companyId };

  if (client && mongoose.Types.ObjectId.isValid(client)) {
    filter.clientId = client;
  }

  if (status && status !== "all") {
    filter.status = status;
  }

  if (startDate && endDate) {
    filter.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  console.log(filter)

  return filter;
}

module.exports = { buildInvoiceFilter };
