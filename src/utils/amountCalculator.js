const amounts = (items, taxRate = 0.16) =>{
    let subTotal = 0;
    let tax = 0;
    let totalAmount = 0;

    items.forEach(item => {
        const itemTotal = item.quantity * item.unitPrice;
        subTotal += itemTotal;
    });

    tax = subTotal * taxRate;
    totalAmount = subTotal + tax;

    return { subTotal, tax, totalAmount };
}

module.exports = {amounts};