const Counter = require('../models/counter');

async function getNextReceiptNumber(companyId, session = null) {

    const counter = await Counter.findOneAndUpdate(
        { companyId, type: "saleReceipt" },
        { $inc: { value: 1 } },
        { new: true, upsert: true, session }
    );

    const number = counter.value.toString().padStart(6, "0");
    const year = new Date().getFullYear().toString().slice(-2);

    return `REC-${year}-${number}`;
}

module.exports = {
    getNextReceiptNumber
};